import "dotenv/config";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { AdminRole, UserRole } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

const secret = process.env.ADMIN_JWT_SECRET;
if (!secret) throw Error("ADMIN_JWT_SECRET is required");
const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let superId = "", modId = "", campusId = "", vendorId = "";
let passed = 0, failed = 0;
function check(test: unknown, name: string) { if (test) passed++; else failed++; console.log(`${test ? "PASS" : "FAIL"} ${passed + failed}: ${name}`); }
function token(id: string, role: AdminRole) { return jwt.sign({adminId:id,role,tokenType:"admin"}, secret!, {algorithm:"HS256",issuer:"campusmart-admin",audience:"campusmart-admin",expiresIn:"20m"}); }
async function main() {
  const admin = await prisma.admin.create({data:{name:"Expansion Admin",email:`expansion-admin-${tag}@example.com`,passwordHash:"TEST",role:AdminRole.super_admin}});superId=admin.id;
  const mod = await prisma.admin.create({data:{name:"Expansion Moderator",email:`expansion-mod-${tag}@example.com`,passwordHash:"TEST",role:AdminRole.marketplace_moderator}});modId=mod.id;
  const campus = await prisma.university.create({data:{name:`Expansion Test ${tag}`,shortName:"TEST",slug:`expansion-${tag}`,state:"Rivers",city:"Port Harcourt"}});campusId=campus.id;
  const vendor = await prisma.user.create({data:{name:"Expansion Seller",email:`expansion-vendor-${tag}@example.com`,passwordHash:"TEST",role:UserRole.vendor,universityId:campus.id,
    vendorProfile:{create:{businessName:"Expansion Store",businessDescription:"Testing only",pickupLocation:"Campus gate"}}}});vendorId=vendor.id;
  const server=await new Promise<ReturnType<typeof app.listen>>((resolve,reject)=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));s.once("error",reject);});
  try {
    const addr=server.address();if(!addr||typeof addr==="string")throw Error("No port");const base=`http://127.0.0.1:${addr.port}`;
    async function req(path:string,t?:string,method="GET",body?:unknown){const r=await fetch(base+path,{method,headers:{...(t?{Authorization:`Bearer ${t}`}:{}) ,...(body!==undefined?{"Content-Type":"application/json"}:{})},body:body!==undefined?JSON.stringify(body):undefined});return {status:r.status,data:await r.json() as any};}
    const sa=token(superId,AdminRole.super_admin),moderator=token(modId,AdminRole.marketplace_moderator);
    const badge=`/api/admin/seller-recognition/${vendorId}/badges/rising_star`;
    check((await req("/api/admin/seller-recognition")).status===401,"Anonymous recognition forbidden");
    check((await req("/api/admin/seller-recognition",moderator)).status===200,"Marketplace moderator can inspect recognition candidates");
    check((await req(badge,moderator,"PATCH",{active:true,reason:"Test badge issuance for moderator"})).status===403,"Moderator cannot grant badge");
    check((await req(badge,sa,"PATCH",{active:true})).status===400,"Super Admin must give reason");
    check((await req(`/api/admin/seller-recognition/${vendorId}/badges/not_a_badge`,sa,"PATCH",{active:true,reason:"Long enough test reason"})).status===400,"Unknown badge rejected");
    const grant=await req(badge,sa,"PATCH",{active:true,reason:"Testing audited recognition grant"});
    check(grant.status===200&&grant.data?.badge?.active===true,"Super Admin can grant audited badge");
    check((await req(badge,sa,"PATCH",{active:true,reason:"Testing duplicate badge cannot be granted"})).status===409,"Duplicate grant rejected");
    const awards=await prisma.sellerBadgeAward.findMany({where:{vendorId,active:true}});
    check(awards.length===1,"Badge persisted exactly once");
    const logs=await prisma.adminAuditLog.findMany({where:{targetId:vendorId}});
    check(logs.some(l=>l.action==="seller_badge_granted"&&l.actorAdminId===superId),"Actor and action audited");
    check(logs.some(l=>l.reason==="Testing audited recognition grant"),"Mandatory reason audited");
    const rev=await req(badge,sa,"PATCH",{active:false,reason:"Test revocation after validating grant"});
    check(rev.status===200&&rev.data?.badge?.active===false,"Badge can be revoked");
    check((await prisma.sellerBadgeAward.count({where:{vendorId,active:true}}))===0,"Revoked badge no longer public-active");
    check((await req(`/api/admin/universities/${campusId}/rollout`,sa,"PATCH",{sellerApplicationsOpen:true})).status===400,"Campus rollout requires reason");
    check((await req(`/api/admin/universities/${campusId}/rollout`,sa,"PATCH",{sellerApplicationsOpen:true,reason:"Opening applications for integration test"})).status===200,"Super Admin can enable seller applications");
    check((await req(`/api/admin/universities/${campusId}/rosters/test/enable-verification`,sa,"POST",{officialInstitutionWide:true,reason:"Official source identity test only"})).status===409,"Unimported roster cannot be enabled");
    console.log(`Expansion tests: ${passed} passed / ${failed} failed`);if(failed)process.exitCode=1;
  } finally {await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
main().catch(e=>{console.error("Expansion test failed:",e);process.exitCode=1;}).finally(async()=>{
  try {
    if(vendorId) {await prisma.sellerBadgeAward.deleteMany({where:{vendorId}}); await prisma.adminAuditLog.deleteMany({where:{targetId:vendorId}});await prisma.user.deleteMany({where:{id:vendorId}});}
    if(campusId){await prisma.adminAuditLog.deleteMany({where:{targetId:campusId}});await prisma.university.deleteMany({where:{id:campusId}});}
    if(superId||modId)await prisma.admin.deleteMany({where:{id:{in:[superId,modId].filter(Boolean)}}});
  } catch(e){console.error("Test cleanup failed:",e);process.exitCode=1;}
  await prisma.$disconnect();
});
