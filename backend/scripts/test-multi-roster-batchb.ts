import "dotenv/config";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { AdminRole, UniversityVerificationSourceType, UniversityRosterImportStatus } from "../src/generated/prisma/client";
import { createUniversityRosterImport } from "../src/services/universityRosterImport.service";
import { verifyStudentAgainstUniversityRoster } from "../src/services/universityRosterVerification.service";
import { enableOfficialRoster, archiveUniversityRoster } from "../src/controllers/adminRosterActivation.controller";
import { updateInstitutionRollout } from "../src/controllers/adminInstitutionRollout.controller";

let passed = 0;
function check(condition: unknown, message: string) {
  assert.ok(condition, message);
  passed++;
  console.log(`PASS ${passed}: ${message}`);
}
function response() {
  const state: { status: number; body: any } = {status:200,body:null};
  const res: any = {
    status(code: number) { state.status = code; return res; },
    json(data: any) { state.body=data; return res; },
  };
  return {res,state};
}
async function main() {
  const suffix=randomUUID().slice(0,10);
  const admin=await prisma.admin.create({data:{
    name:"Batch B Test Super Admin",email:`batchb-${suffix}@example.invalid`,passwordHash:"integration-test-only",role:AdminRole.super_admin,
  }});
  let universityId: string | null = null;
  try {
    const university=await prisma.university.create({data:{
      name:`Batch B Test University ${suffix}`,shortName:`BB${suffix}`,slug:`batch-b-test-${suffix}`,
      country:"Nigeria",state:"Rivers",city:"Port Harcourt",active:true,
    }});
    universityId=university.id;
    const reason="Official student register certified by designated institution records office.";
    const first=await createUniversityRosterImport({universityId,importedByAdminId:admin.id,
      originalFileName:"computer-science.csv",academicSession:"2026/2027",sourceIssuer:"University Registrar — Computer Science",
      csvText:"matric_number,full_name,student_status\nBATCHB001,Ada Obi,active\nBATCHB002,Zara Okon,active\n",
    });
    check(first.status===UniversityRosterImportStatus.active,"First departmental roster is active");
    const second=await createUniversityRosterImport({universityId,importedByAdminId:admin.id,
      originalFileName:"maths.csv",academicSession:"2026/2027",sourceIssuer:"University Registrar — Mathematics",
      csvText:"matric_number,full_name,student_status\nBATCHB001,Ada Obi,active\nBATCHB003,Bola Ade,active\n",
    });
    check(second.archivedPreviousRosterCount===0,"Second import does not archive earlier active source");
    check(await prisma.universityRosterImport.count({where:{universityId,status:UniversityRosterImportStatus.active}})===2,"Both rosters remain active");

    const pending=await verifyStudentAgainstUniversityRoster({universityId,matricNumber:"BATCHB001",fullName:"Ada Obi"});
    check(pending.outcome==="no_active_roster","Uploaded but uncertified roster cannot verify anyone");
    const certify=async (id:string,unit:string) => {
      const {res,state}=response();
      await enableOfficialRoster({admin,params:{universityId,rosterImportId:id},body:{
        reason,scope:"department",sourceUnit:unit,officialSourceConfirmed:true,
      }} as any,res);
      return state;
    };
    const certificationA=await certify(first.id,"Computer Science");
    check(certificationA.status===200 && certificationA.body.success,"Super Admin can certify scoped departmental roster A");
    const certificationB=await certify(second.id,"Mathematics");
    check(certificationB.status===200 && certificationB.body.success,"Independent departmental roster B remains certifiable");
    const verified=await verifyStudentAgainstUniversityRoster({universityId,matricNumber:"BATCHB001",fullName:"Ada Obi"});
    check(verified.outcome==="verified","Consistent overlapping identity verifies once across two sources");
    const onlyB=await verifyStudentAgainstUniversityRoster({universityId,matricNumber:"BATCHB003",fullName:"Bola Ade"});
    check(onlyB.outcome==="verified","Student found in second roster can verify");
    const nameWrong=await verifyStudentAgainstUniversityRoster({universityId,matricNumber:"BATCHB003",fullName:"Different Person"});
    check(nameWrong.outcome==="name_mismatch" && nameWrong.definitive,"Name mismatch remains a definitive block");

    const conflict=await createUniversityRosterImport({universityId,importedByAdminId:admin.id,
      originalFileName:"transfers.csv",academicSession:"2026/2027",sourceIssuer:"University Registrar — Transfers",
      csvText:"matric_number,full_name,student_status\nBATCHB001,Ada Obi,inactive\nBATCHB004,Chika Okeke,active\n",
    });
    await certify(conflict.id,"Transfers");
    const disputed=await verifyStudentAgainstUniversityRoster({universityId,matricNumber:"BATCHB001",fullName:"Ada Obi"});
    check(disputed.outcome==="roster_configuration_conflict" && !disputed.matched,"Conflicting active status blocks automatic verification");

    const archived=response();
    await archiveUniversityRoster({admin,params:{universityId,rosterImportId:conflict.id},body:{reason:"Source was withdrawn for status conflicts; archive safely.",confirmed:true}} as any,archived.res);
    check(archived.state.status===200 && archived.state.body.success,"Conflicting roster can be archived with reason and confirmation");
    const restored=await verifyStudentAgainstUniversityRoster({universityId,matricNumber:"BATCHB001",fullName:"Ada Obi"});
    check(restored.outcome==="verified","Archiving conflict removes only that source contribution");
    check(await prisma.universityRosterImport.count({where:{universityId,status:UniversityRosterImportStatus.active}})===2,"Unrelated active sources survive archival");

    const opened=response();
    await updateInstitutionRollout({admin,params:{universityId},body:{sellerApplicationsOpen:true,reason:"Campus has staff assigned for manual student verification."}} as any,opened.res);
    check(opened.state.status===200,"Seller applications can open by audited Super Admin action");
    const stateAfterOpen=await prisma.university.findUniqueOrThrow({where:{id:universityId}});
    check(stateAfterOpen.sellerApplicationsOpen && stateAfterOpen.manualReviewEnabled && stateAfterOpen.studentVerificationEnabled,"Opening applications also enables manual verification");
    check(stateAfterOpen.primaryVerificationSource===UniversityVerificationSourceType.roster_import,"Opening applications does not disable certified roster source");
    const closed=response();
    await updateInstitutionRollout({admin,params:{universityId},body:{sellerApplicationsOpen:false,reason:"Pause intake but preserve existing pending manual reviews."}} as any,closed.res);
    const stateAfterClose=await prisma.university.findUniqueOrThrow({where:{id:universityId}});
    check(closed.state.status===200 && !stateAfterClose.sellerApplicationsOpen && stateAfterClose.manualReviewEnabled,"Closing applications preserves manual-review workflow");
    const auditEvents=await prisma.adminAuditLog.findMany({where:{actorAdminId:admin.id}});
    check(auditEvents.some(a=>a.action==="university_roster_source_archived") && auditEvents.some(a=>a.action==="institution_rollout_changed"),"Archive and seller policies have audit records");
    console.log(`\nBatch B integration tests: ${passed} passed / 0 failed`);
  } finally {
    // Only test-created records are deleted; existing campus data is untouched.
    await prisma.adminAuditLog.deleteMany({where:{actorAdminId:admin.id}});
    if (universityId) {
      await prisma.universityRosterImport.deleteMany({where:{universityId}});
      await prisma.university.delete({where:{id:universityId}});
    }
    await prisma.admin.delete({where:{id:admin.id}});
  }
}
main().catch(error=>{console.error("Batch B integration failed:",error);process.exitCode=1;}).finally(async()=>{await prisma.$disconnect();});
