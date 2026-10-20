import type { Response } from "express";
import { OrderStatus, PaymentStatus, NotificationType } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";

export async function markOrderReady(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success:false, message:"Authentication required." });
  const vendorId=req.user.id, orderId=String(req.params.id ?? "").trim();
  try {
    const result=await prisma.$transaction(async(tx)=>{
      const order=await tx.order.findUnique({ where:{ id:orderId },
        select:{ buyerId:true, paymentStatus:true, items:{ where:{vendorId}, select:{status:true} } } });
      if(!order || !order.items.length) return {ok:false, code:404, message:"Seller order not found."};
      if(order.paymentStatus!==PaymentStatus.paid ||
        !order.items.every(i=>i.status===OrderStatus.confirmed))
        return {ok:false, code:409, message:"The order must be paid and confirmed."};
      const changed=await tx.orderVendorFulfillment.updateMany({ where:{orderId,vendorId,readyAt:null,verifiedAt:null},
        data:{readyAt:new Date()} });
      const fulfillment=await tx.orderVendorFulfillment.findUnique({
        where:{orderId_vendorId:{orderId,vendorId}},select:{readyAt:true} });
      if(!fulfillment?.readyAt) return {ok:false,code:409,message:"Unable to mark order ready."};
      if(changed.count) await tx.notification.create({ data:{
        userId:order.buyerId,type:NotificationType.order_ready,title:"Ready for pickup",
        message:"Your seller has marked your order ready. Arrange a convenient handoff time.",
        href:"/buyer/orders",orderId
      }});
      return {ok:true,readyAt:fulfillment.readyAt};
    });
    if("code" in result && typeof result.code === "number") return res.status(result.code).json({success:false,message:result.message});
    return res.json({success:true,readyAt:result.readyAt});
  }catch(error){console.error("Ready for pickup:",error);return res.status(500).json({success:false,message:"Unable to mark ready."});}
}
