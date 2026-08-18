import { redirect } from "next/navigation";
import { KdsBoard } from "@/components/admin/kds-board";
import { getKdsOrders, getMerchantForUser } from "@/actions/orders";

export default async function KdsPage() {
  const merchant = await getMerchantForUser();
  if (!merchant) redirect("/admin/login");

  const orders = await getKdsOrders(merchant.id);

  return (
    <div className="dark min-h-[calc(100vh-5rem)] rounded-xl bg-background p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Écran Cuisine (KDS)</h1>
        <p className="text-sm text-muted-foreground">
          {merchant.business_name} · Temps réel activé
        </p>
      </div>
      <KdsBoard merchantId={merchant.id} initialOrders={orders} />
    </div>
  );
}
