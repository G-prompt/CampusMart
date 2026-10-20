import "dotenv/config";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { AdminRole, UserRole, VendorAccessStatus } from "../src/generated/prisma/client";
import { casePriority, priorityLabel } from "../src/services/marketplacePriority.service";

let passed = 0; let failed = 0;
function check(cond: unknown, label: string) { if (cond) passed++; else failed++; console.log(`${cond ? "PASS" : "FAIL"} ${passed+failed}: ${label}`); }
const key = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const admins: string[] = []; const users: string[] = []; const products: number[] = []; const cases: string[] = [];
const jwtSecret = process.env.JWT_SECRET;
const adminSecret = process.env.ADMIN_JWT_SECRET;
if (!jwtSecret || !adminSecret) throw new Error("JWT_SECRET and ADMIN_JWT_SECRET are required");
function adminToken(id: string, role: AdminRole) { return jwt.sign({adminId:id,role,tokenType:"admin"}, adminSecret!, {algorithm:"HS256",issuer:"campusmart-admin",audience:"campusmart-admin",expiresIn:"15m"}); }
function buyerToken(id: string) { return jwt.sign({userId:id,role:UserRole.client},jwtSecret!,{expiresIn:"15m"}); }

async function main() {
  check(priorityLabel(casePriority("critical",1)) === "critical", "One critical safety report outranks low-priority volume");
  check(casePriority("low",50) < casePriority("critical",1), "Many minor reports cannot outrank a critical one");
  const superAdmin = await prisma.admin.create({data:{name:"Test Marketplace Super Admin",email:`bcsuper-${key}@example.com`,passwordHash:"test",role:AdminRole.super_admin}}); admins.push(superAdmin.id);
  const moderator = await prisma.admin.create({data:{name:"Test Marketplace Moderator",email:`bcmod-${key}@example.com`,passwordHash:"test",role:AdminRole.marketplace_moderator}}); admins.push(moderator.id);
  const seller = await prisma.user.create({data:{name:"Test Marketplace Seller",email:`bcseller-${key}@example.com`,passwordHash:"test",role:UserRole.vendor,
    vendorProfile:{create:{businessName:"Batch C Test Shop",businessDescription:"Moderation test store",pickupLocation:"Campus gate",accessStatus:VendorAccessStatus.active}}}}); users.push(seller.id);
  const buyerA = await prisma.user.create({data:{name:"Test Reporter A",email:`bcbuyer-a-${key}@example.com`,passwordHash:"test",role:UserRole.client}}); users.push(buyerA.id);
  const buyerB = await prisma.user.create({data:{name:"Test Reporter B",email:`bcbuyer-b-${key}@example.com`,passwordHash:"test",role:UserRole.client}}); users.push(buyerB.id);
  const product = await prisma.product.create({data:{slug:`batch-c-moderation-${key}`,title:"Batch C moderated item",category:"Technology",price:1000,description:"Test listing",images:[],vendorId:seller.id}});products.push(product.id);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve,reject)=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));s.once("error",reject);});
  try {
    const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing HTTP address");
    const host = `http://127.0.0.1:${address.port}`;
    async function request(path:string,token?:string,method="GET",body?:unknown){const response=await fetch(host+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json() as any};}
    const a = adminToken(superAdmin.id, AdminRole.super_admin), m = adminToken(moderator.id, AdminRole.marketplace_moderator);
    check((await request("/api/admin/marketplace/cases")).status === 401, "Anonymous access to safety queue blocked");
    const report = await request("/api/marketplace/reports",buyerToken(buyerA.id),"POST",{targetType:"user",targetId:seller.id,category:"suspected_fraud",severity:"low",details:"Test report of a suspected fraudulent transaction at the campus store."});
    check(report.status === 201,"Buyer can submit report about a seller");
    const duplicate = await request("/api/marketplace/reports",buyerToken(buyerA.id),"POST",{targetType:"user",targetId:seller.id,category:"unsafe_meetup",severity:"low",details:"Duplicate same buyer cannot artificially increase priority."});
    check(duplicate.status === 409,"Same buyer cannot pile repeated reports on same target");
    const second = await request("/api/marketplace/reports",buyerToken(buyerB.id),"POST",{targetType:"user",targetId:seller.id,category:"harassment",severity:"critical",details:"Second independently reported dangerous physical meetup threat."});
    check(second.status === 201,"Distinct reporter can add evidence to existing case");
    const found = await prisma.marketplaceCase.findUnique({where:{targetType_targetId:{targetType:"user",targetId:seller.id}}});
    if(found)cases.push(found.id);
    check(found?.reportCount === 2 && found?.priorityScore >= 90,"Case prioritises two distinct reporters and critical severity");
    const safety = await prisma.marketplaceReport.findMany({where:{caseId:found?.id || ""},select:{category:true,severity:true}});
    check(safety.some(r => r.category === "suspected_fraud" && r.severity === "high"), "Buyer cannot lower policy severity to suppress a fraud report");
    check(safety.some(r => r.category === "unsafe_meetup" && r.severity === "critical"), "Safety threat is critical even when reporter requests low priority");
    const queue = await request("/api/admin/marketplace/cases?status=open",m);
    check(queue.status === 200 && queue.data.cases?.some((c:any)=>c.id===found?.id&&c.priority==="critical"),"Moderator sees prioritised open report");
    const actionPath=`/api/admin/marketplace/cases/${found?.id}/actions`;
    const flagged = await request(actionPath,m,"POST",{action:"flag",reason:"Open investigation into buyer reports of suspected fraud",confirm:"CONFIRM"});
    check(flagged.status === 200,"Moderator can flag the reported account without automatic suspension");
    const flaggedState = await prisma.user.findUnique({where:{id:seller.id},select:{accountFlaggedAt:true,accountSuspendedAt:true}});
    check(Boolean(flaggedState?.accountFlaggedAt) && !flaggedState?.accountSuspendedAt,"Flag is persisted but account remains accessible");
    const unflagged = await request(actionPath,m,"POST",{action:"clear_flag",reason:"Test case reviewed and account flag should be removed",confirm:"CONFIRM"});
    check(unflagged.status === 200,"Moderator can remove a flag with audit reason");
    const reject = await request(actionPath,m,"POST",{action:"suspend_account",reason:"Strong safety evidence requires suspension",confirm:"CONFIRM"});
    check(reject.status === 403,"Moderator cannot suspend an entire account");
    const noReason = await request(actionPath,a,"POST",{action:"suspend_account",reason:"short",confirm:"CONFIRM"});
    check(noReason.status === 400,"High-risk action requires substantive reason");
    const suspend = await request(actionPath,a,"POST",{action:"suspend_account",reason:"Test serious safety report needs temporary account suspension",confirm:"CONFIRM"});
    check(suspend.status===200,"Super Admin can suspend account with explicit confirmation");
    const sellerToken=jwt.sign({userId:seller.id,role:UserRole.vendor},jwtSecret!,{expiresIn:"15m"});
    const blocked=await request("/api/orders/mine",sellerToken);
    check(blocked.status===403&&blocked.data?.code==="ACCOUNT_SUSPENDED","Suspended account is blocked by authenticated endpoints");
    const suspendedUser=await prisma.user.findUnique({where:{id:seller.id},select:{accountSuspendedAt:true,vendorProfile:{select:{accessStatus:true}}}});
    check(Boolean(suspendedUser?.accountSuspendedAt)&&suspendedUser?.vendorProfile?.accessStatus==="suspended","Account and seller access are both suspended");
    const restore=await request(actionPath,a,"POST",{action:"restore_account",reason:"Test review has concluded and account can be reactivated",confirm:"CONFIRM"});
    check(restore.status===200,"Super Admin can restore account without bypassing eligibility checks");
    const restoredUser=await prisma.user.findUnique({where:{id:seller.id},select:{accountSuspendedAt:true,vendorProfile:{select:{accessStatus:true}}}});
    check(!restoredUser?.accountSuspendedAt&&restoredUser?.vendorProfile?.accessStatus==="pending_review","Restoration returns seller to pending review");
    const listingReport=await request("/api/marketplace/reports",buyerToken(buyerA.id),"POST",{targetType:"product",targetId:String(product.id),category:"misleading_listing",severity:"medium",details:"This product listing is misleading about the item specifications."});
    check(listingReport.status===201,"Listing report creates a separate case");
    const listingCase=await prisma.marketplaceCase.findUnique({where:{targetType_targetId:{targetType:"product",targetId:String(product.id)}}});if(listingCase)cases.push(listingCase.id);
    const hide=await request(`/api/admin/marketplace/cases/${listingCase?.id}/actions`,m,"POST",{action:"hide_listing",reason:"Listing hidden during product authenticity investigation",confirm:"CONFIRM"});
    check(hide.status===200,"Moderator can hide reported listing");
    const hidden=await prisma.product.findUnique({where:{id:product.id}});
    check(hidden?.isArchived===true&&Boolean(hidden.moderationHiddenAt),"Reported listing is hidden and marked as Admin moderated");
    const award = await request(`/api/admin/seller-recognition/${seller.id}/badges/rising_star`,a,"PATCH",{active:true,reason:"No performance but trying to give a badge",confirm:"CONFIRM"});
    check(award.status===409,"Seller with zero verified sales cannot receive Rising Star");
    const events=await prisma.adminAuditLog.findMany({where:{actorAdminId:{in:admins},targetId:{in:[seller.id,String(product.id)]}}});
    check(events.some(e=>e.action==="marketplace_suspend_account")&&events.some(e=>e.action==="marketplace_hide_listing"),"Critical moderation decisions produce audit records");
    console.log(`\nMarketplace Batch C tests: ${passed} passed / ${failed} failed`);
    if(failed)process.exitCode=1;
  }finally { await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())); }
}
main().catch(e=>{console.error("Batch C test crashed:",e);process.exitCode=1;}).finally(async()=>{
  try {
    if(cases.length){await prisma.marketplaceReport.deleteMany({where:{caseId:{in:cases}}});await prisma.marketplaceCase.deleteMany({where:{id:{in:cases}}});}
    await prisma.adminAuditLog.deleteMany({where:{actorAdminId:{in:admins}}});
    if(products.length) await prisma.product.deleteMany({where:{id:{in:products}}});
    if(users.length) await prisma.user.deleteMany({where:{id:{in:users}}});
    if(admins.length) await prisma.admin.deleteMany({where:{id:{in:admins}}});
  }catch(e){console.error("Batch C cleanup failed:",e);process.exitCode=1;}
  await prisma.$disconnect();
});
