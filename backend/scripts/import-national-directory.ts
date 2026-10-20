/**
 * CampusMart national directory importer. DRY RUN by default.
 * Designed for the NUC table and NBTE institution extracts.
 *
 * From backend:
 * npx.cmd tsx scripts/import-national-directory.ts data/nuc-universities-reviewed.csv
 * npx.cmd tsx scripts/import-national-directory.ts data/nbte-polytechnics-starter.csv
 *
 * To execute, specify (PowerShell):
 * $env:CAMPUSMART_DIRECTORY_CONFIRM="YES"
 * $env:CAMPUSMART_DIRECTORY_ACTOR_EMAIL="your-existing-super-admin-email"
 * $env:CAMPUSMART_DIRECTORY_REASON="Initial verified national directory import"
 * npx.cmd tsx scripts/import-national-directory.ts data/nuc-universities-reviewed.csv
 * Remove env vars after use.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  AdminRole, InstitutionKind, NotificationType,
} from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

const norm = (s: string) => s.normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/&/g, "and")
  .replace(/[^a-z0-9]+/g, " ").trim();
const slug = (s: string) => norm(s).replace(/\s+/g, "-");
const allowedStates = new Set([
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
]);
const officialHosts = new Set(["enuc.nuc.edu.ng","nuc.edu.ng","www.nuc.edu.ng","nbte.gov.ng","www.nbte.gov.ng","web.nbte.gov.ng","www.web.nbte.gov.ng"]);
const legacyAliases: Record<string, string> = {
  [norm("Rivers State University of Science & Technology, Port Harcourt, Rivers State")]: norm("Rivers State University"),
  [norm("University of Port-Harcourt, Port-Harcourt")]: norm("University of Port Harcourt"),
  [norm("Ignatius Ajuru University of Education, Rumuolumeni")]: norm("Ignatius Ajuru University of Education"),
  [norm("PAMO University of Medical Sciences, Port-Harcourt, Rivers State")]: norm("PAMO University of Medical Sciences"),
  [norm("University of Uyo, Uyo")]: norm("University of Uyo"),
};

type InstitutionRow = {
  name: string; shortName: string; state: string; city: string;
  kind: InstitutionKind; featuredInSignup: boolean;
  sourceAuthority: string; sourceUrl: string;
};

function parseCsv(data: string): string[][] {
  const rows: string[][] = []; let current: string[] = []; let cell=""; let quoted=false;
  for(let i=0;i<data.length;i++) {
    const c=data[i];
    if(c==='"') { if(quoted && data[i+1]==='"'){cell+='"';i++;} else quoted=!quoted; }
    else if(c===',' && !quoted) {current.push(cell.trim());cell="";}
    else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&data[i+1]==='\n')i++;current.push(cell.trim());if(current.some(Boolean))rows.push(current);cell="";current=[];}
    else cell+=c;
  }
  if(quoted)throw Error("Invalid CSV quotes; no records imported.");
  current.push(cell.trim());if(current.some(Boolean))rows.push(current);
  return rows;
}

function readInstitutions(csv: string): InstitutionRow[] {
  const rows=parseCsv(csv);const head=rows.shift()?.map(s=>s.replace(/^\uFEFF/,"").trim());
  if(!head)throw Error("CSV missing header.");
  for(const field of ["name","shortName","state","city","kind","featuredInSignup","sourceAuthority","sourceUrl"])
    if(!head.includes(field))throw Error("Missing required CSV column: "+field);
  const at=(r:string[],key:string)=>r[head.indexOf(key)]?.normalize("NFKC").trim()||"";
  const seen=new Set<string>();
  return rows.map((r,i)=>{
    const name=at(r,"name"), shortName=at(r,"shortName"), state=at(r,"state"), city=at(r,"city"), kind=at(r,"kind") as InstitutionKind;
    const sourceAuthority=at(r,"sourceAuthority"), sourceUrl=at(r,"sourceUrl"), featured=at(r,"featuredInSignup").toLowerCase();
    if(!name||!shortName||!city||!allowedStates.has(state)||!Object.values(InstitutionKind).includes(kind)||!['true','false'].includes(featured))
      throw Error(`Invalid required data at CSV line ${i+2}: ${name}`);
    if(!["NUC","NBTE"].includes(sourceAuthority))throw Error(`Invalid regulator on CSV line ${i+2}`);
    if((sourceAuthority==="NUC"&&kind!==InstitutionKind.university)||(sourceAuthority==="NBTE"&&kind!==InstitutionKind.polytechnic))
      throw Error(`Regulator/category mismatch at line ${i+2}`);
    let u:URL;try{u=new URL(sourceUrl);}catch{throw Error(`Invalid source URL on line ${i+2}`);}
    if(u.protocol!=="https:"||!officialHosts.has(u.hostname))throw Error(`Unapproved source hostname on line ${i+2}`);
    const key=norm(name)+"|"+norm(state);
    if(seen.has(key))throw Error(`Duplicate CSV entry: ${name} (${state})`);
    seen.add(key);
    return {name,shortName,state,city,kind,featuredInSignup:featured==='true',sourceAuthority,sourceUrl};
  });
}

function resolveExisting(
  row: InstitutionRow,
  all: {id:string;name:string;shortName:string;slug:string;state:string;institutionKind:InstitutionKind}[]
) {
  const target=legacyAliases[norm(row.name)] || norm(row.name);
  const rowBase=norm(row.name.split(",")[0]);
  const matches=all.filter(x=>norm(x.state)===norm(row.state) && (
    norm(x.name)===target || norm(x.name)===norm(row.name) || norm(x.slug)===norm(row.name)
    || norm(x.slug)===target || (norm(x.name)===rowBase && rowBase.length>15)
  ));
  if(matches.length>1)throw Error(`Ambiguous existing institution matches: ${row.name}. Resolve manually before import.`);
  if(matches[0] && matches[0].institutionKind!==row.kind)throw Error(`Existing institution type differs: ${row.name}.`);
  return matches[0]??null;
}

async function main(){
  const file=process.argv[2];if(!file)throw Error("Pass a source CSV path.");
  const list=readInstitutions(readFileSync(file,"utf8"));
  if(list.length===0)throw Error("Empty directory: nothing to import.");
  const all=await prisma.university.findMany({select:{id:true,name:true,shortName:true,slug:true,state:true,institutionKind:true}});
  const inserts:InstitutionRow[]=[];const matched: {source:string;existing:string}[]=[];
  const usedSlugs=new Set(all.map(x=>x.slug));
  for(const row of list){
    const existing=resolveExisting(row,all);
    if(existing){matched.push({source:row.name,existing:existing.name});continue;}
    const s=slug(row.name);
    if(usedSlugs.has(s))throw Error(`Slug collision ${s} across different states. Aborted.`);
    if(all.some(x=>norm(x.name)===norm(row.name)&&norm(x.state)!==norm(row.state))) {
      // Same names in different states can be legitimate, but need a unique slug.
      throw Error(`Cross-state name collision: ${row.name}. Resolve manually.`);
    }
    usedSlugs.add(s);inserts.push(row);
  }
  console.log(JSON.stringify({mode:process.env.CAMPUSMART_DIRECTORY_CONFIRM==="YES"?"IMPORT":"DRY RUN",file:basename(file),total:list.length,preserveExisting:matched.length,wouldInsert:inserts.length,
    rivers:inserts.filter(x=>x.state==="Rivers").map(x=>x.name),
    missingCity:inserts.filter(x=>x.city==="Not specified").length,
    matchedSample:matched.slice(0,12)},null,2));
  if(process.env.CAMPUSMART_DIRECTORY_CONFIRM!=="YES") {
    console.log("DRY RUN: no database changes. Review names, conflicts and unknown cities first."); return;
  }
  const email=(process.env.CAMPUSMART_DIRECTORY_ACTOR_EMAIL??"").trim();
  const reason=(process.env.CAMPUSMART_DIRECTORY_REASON??"").trim();
  if(!email || reason.length<15)throw Error("Import requires CAMPUSMART_DIRECTORY_ACTOR_EMAIL and CAMPUSMART_DIRECTORY_REASON (15+ characters).");
  const admin=await prisma.admin.findUnique({where:{email},select:{id:true,active:true,role:true}});
  if(!admin?.active || admin.role!==AdminRole.super_admin)throw Error("Importer requires an active Super Admin actor. Nothing changed.");
  let created=0, notifications=0;
  // Transactions ensure each university and its audit entry commit together.
  for(let i=0;i<inserts.length;i+=15){
    const batch=inserts.slice(i,i+15);
    const count=await prisma.$transaction(async(tx)=>{
      let notices=0;
      for(const item of batch){
        const newInstitution=await tx.university.create({data:{name:item.name,shortName:item.shortName,slug:slug(item.name),country:"Nigeria",state:item.state,city:item.city,
          institutionKind:item.kind,active:true,featuredInSignup:item.featuredInSignup,sellerApplicationsOpen:false,studentVerificationEnabled:false,
          manualReviewEnabled:false,matricValidationEnabled:false}});
        await tx.adminAuditLog.create({data:{actorAdminId:admin.id,action:"institution.official_directory_import",targetType:"university",targetId:newInstitution.id,
          reason,beforeState:null,afterState:JSON.stringify({name:newInstitution.name,state:newInstitution.state,kind:newInstitution.institutionKind,active:true,
            sellerApplicationsOpen:false,studentVerificationEnabled:false,featuredInSignup:newInstitution.featuredInSignup,source:item.sourceAuthority,sourceUrl:item.sourceUrl})}});
        const claims=await tx.user.findMany({where:{universityId:null,fallbackState:{equals:item.state,mode:"insensitive"},
          OR:[{fallbackUniversityName:{equals:item.name,mode:"insensitive"}},{fallbackUniversityName:{equals:item.name.split(",")[0],mode:"insensitive"}},
              {fallbackUniversityName:{equals:item.shortName,mode:"insensitive"}}]},select:{id:true},take:1000});
        if(claims.length){await tx.notification.createMany({data:claims.map(x=>({userId:x.id,type:NotificationType.university_available,
          title:`${item.name} is now on CampusMart`,message:"Confirm your university in your profile to begin verification. Your account remains unchanged.",href:"/profile"}))});notices+=claims.length;}
      }
      return notices;
    },{timeout:120000,maxWait:30000});
    created+=batch.length;notifications+=count;
    console.log(`Imported ${created}/${inserts.length} new institutions and audit events.`);
  }
  console.log(`COMPLETE: created ${created}; matched existing IDs ${matched.length}; link notifications ${notifications}. Seller onboarding and verification DISABLED for all new institutions.`);
}
main().catch(e=>{console.error("IMPORT FAILED:",e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
