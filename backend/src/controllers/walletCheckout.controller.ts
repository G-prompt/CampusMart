import type { Response } from "express";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
export async function checkoutWallet(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success:false, message:"Authentication required." });
  try {
    const wallet = await prisma.wallet.findUnique({ where:{userId:req.user.id}, select:{balance:true} });
    return res.json({ success:true, balance:wallet?.balance ?? 0, currency:"NGN", fee:100, topUpAvailable:false });
  } catch (error) {
    console.error("Checkout wallet:", error);
    return res.status(500).json({ success:false, message:"Wallet balance unavailable." });
  }
}
