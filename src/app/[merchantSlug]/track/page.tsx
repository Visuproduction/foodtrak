import { Suspense } from "react";
import { notFound } from "next/navigation";
import { OrderTracker } from "@/components/client/order-tracker";
import { getMerchantBySlug, getOrderById } from "@/actions/orders";

interface PageProps {
  params: Promise<{ merchantSlug: string }>;
  searchParams: Promise<{ orderId?: string }>;
}

export default async function TrackPage({ params, searchParams }: PageProps) {
  const { merchantSlug } = await params;
  const { orderId } = await searchParams;
  const merchant = await getMerchantBySlug(merchantSlug);

  if (!merchant) notFound();

  const initialOrder = orderId ? await getOrderById(orderId) : null;

  return (
    <Suspense>
      <OrderTracker merchant={merchant} initialOrder={initialOrder} />
    </Suspense>
  );
}
