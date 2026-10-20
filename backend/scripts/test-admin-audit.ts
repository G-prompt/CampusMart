import "dotenv/config";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { AdminRole } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

const secret=process.env.ADMIN_JWT_SECRET;
if(!secret) throw new Error("ADMIN_JWT_SECRET not configured");
const tag=Date.now().toString(36);
let passed=0,failed=0;
const checks=(cond:unknown,label:string)=>{(cond?passed++:failed++);console.log(`${cond?"PASS":"FAIL"} ${passed+failed}: ${label}`);};
const admins:string[]=[];let universityId:string|null=null;
function token(id:string,role:AdminRole){return jwt.sign({adminId:id,role,tokenType:"admin"},secret!,{algorithm:"HS256",issuer:"campusmart-admin",audience:"campusmart-admin",expiresIn:"10m"});}
async function main(){
 const superAdmin=await prisma.admin.create({data:{name:"Test Super Admin",email:`super-audit-${tag}@example.com`,passwordHash:"test-no-login",role:AdminRole.super_admin}});admins.push(superAdmin.id);
 const manager=await prisma.admin.create({data:{name:"Test University Manager",email:`manager-audit-${tag}@example.com`,passwordHash:"test-no-login",role:AdminRole.university_manager}});admins.push(manager.id);
 const university=await prisma.university.create({data:{name:`Audit Test Campus ${tag}`,shortName:"ATC",slug:`audit-campus-${tag}`,state:"Rivers",city:"Port Harcourt",active:true}});universityId=university.id;
 const server=await new Promise<ReturnType<typeof app.listen>>((resolve,reject)=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));s.once("error",reject);});
 try {
  const addr=server.address();if(!addr||typeof addr==="string")throw new Error("No port");const root=`http://127.0.0.1:${addr.port}`;
  async function query(path:string,t?:string,method="GET",body?:unknown){const r=await fetch(root+path,{method,headers:{...(t?{Authorization:`Bearer ${t}`}:{}) ,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,json:await r.json() as any};}
  const a=token(superAdmin.id,AdminRole.super_admin),m=token(manager.id,AdminRole.university_manager);
  const path=`/api/admin/universities/${university.id}/active`;
  checks((await query("/api/admin/audit")).status===401,"Anonymous audit request blocked");
  checks((await query("/api/admin/audit",m)).status===403,"Non-Super-Admin audit request blocked");
  checks((await query(path,m,"PATCH",{active:false,reason:"Maintenance closure for testing"})).status===403,"Manager cannot deactivate campus");
  checks((await query(path,a,"PATCH",{active:false})).status===400,"Critical action requires reason");
  checks((await query(path,a,"PATCH",{active:false,reason:"short"})).status===400,"Short reason is rejected");
  checks((await query(`/api/admin/universities/${university.id}`,a,"PATCH",{active:false})).status===400,"General update cannot bypass critical route");
  const deactivate=await query(path,a,"PATCH",{active:false,reason:"Temporarily disabled for Admin audit test"});
  checks(deactivate.status===200&&deactivate.json?.university?.active===false,"Super Admin deactivation succeeds");
  const detail=await prisma.university.findUnique({where:{id:university.id}});
  checks(detail?.active===false,"University is actually inactive in database");
  const list=await query(`/api/admin/audit?targetType=university&targetId=${university.id}`,a);
  checks(list.status===200&&list.json?.events?.some((event:any)=>event.actor.id===superAdmin.id&&event.action==="university.deactivated"&&event.reason.includes("Temporarily disabled")),"Audit event contains actor, action and reason");
  checks(list.json?.events?.some((event:any)=>JSON.parse(event.beforeState).active===true&&JSON.parse(event.afterState).active===false),"Audit event includes before/after state");
  const reactivate=await query(path,a,"PATCH",{active:true,reason:"Restore this university after audit test"});
  checks(reactivate.status===200&&reactivate.json?.university?.active===true,"Reactivation audited and succeeds");
  console.log(`\nAdmin audit tests: ${passed} passed / ${failed} failed`);
  if(failed)process.exitCode=1;
 } finally {await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
main().catch(e=>{console.error("Admin audit test crashed:",e);process.exitCode=1;}).finally(async()=>{
 try{if(universityId){await prisma.adminAuditLog.deleteMany({where:{targetId:universityId}});await prisma.university.deleteMany({where:{id:universityId}});}if(admins.length)await prisma.admin.deleteMany({where:{id:{in:admins}}});}
 catch(e){console.error("Audit test cleanup failed:",e);process.exitCode=1;}
 await prisma.$disconnect();
});
