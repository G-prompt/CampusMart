import { PaymentStatus, WalletHoldStatus } from "../generated/prisma/client";
import type { Prisma } from "../generated/prisma/client";
type Tx = Prisma.TransactionClient;

export async function refundCancelledSeller(tx: Tx, orderId: string, buyerId: string, vendorId: string) {
  const hold = await tx.walletHold.findUnique({ where: { orderId_vendorId: { orderId, vendorId } } });
  if (!hold || hold.status !== WalletHoldStatus.held) return;
  const changed = await tx.walletHold.updateMany({ where: { id: hold.id, status: WalletHoldStatus.held }, data: { status: WalletHoldStatus.refunded } });
  if (changed.count !== 1) return;
  await tx.wallet.update({ where: { userId: buyerId }, data: { balance: { increment: hold.amount } } });
  await tx.walletEntry.create({ data: { userId: buyerId, reference: "refund:" + orderId + ":" + vendorId,
    kind: "seller_refund", amount: hold.amount, orderId, vendorId } });
}

export async function refundOrderFeeIfFullyCancelled(tx: Tx, orderId: string, buyerId: string, fee: number, fullyCancelled: boolean) {
  if (!fullyCancelled) return;
  const holds = await tx.walletHold.findMany({ where: { orderId }, select: { status: true } });
  if (holds.length === 0 || holds.some((h) => h.status !== WalletHoldStatus.refunded)) return;
  if (fee > 0) {
    await tx.wallet.update({ where: { userId: buyerId }, data: { balance: { increment: fee } } });
    await tx.walletEntry.create({ data: { userId: buyerId, reference: "fee-refund:" + orderId,
      kind: "service_fee_refund", amount: fee, orderId } });
  }
  await tx.order.update({ where: { id: orderId }, data: { paymentStatus: PaymentStatus.refunded } });
}

export async function settleVerifiedSeller(tx: Tx, orderId: string, vendorId: string) {
  const hold = await tx.walletHold.findUnique({ where: { orderId_vendorId: { orderId, vendorId } } });
  if (!hold || hold.status !== WalletHoldStatus.held) return;
  const changed = await tx.walletHold.updateMany({ where: { id: hold.id, status: WalletHoldStatus.held }, data: { status: WalletHoldStatus.settled } });
  if (changed.count !== 1) return;
  const commission = Math.round(hold.amount * 0.01);
  const net = hold.amount - commission;
  await tx.wallet.upsert({ where: { userId: vendorId }, create: { userId: vendorId, balance: net }, update: { balance: { increment: net } } });
  await tx.walletEntry.create({ data: { userId: vendorId, reference: "settle:" + orderId + ":" + vendorId,
    kind: "seller_settlement", amount: net, orderId, vendorId } });
}
