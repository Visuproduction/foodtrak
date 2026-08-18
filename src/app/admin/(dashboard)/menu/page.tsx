import { redirect } from "next/navigation";
import { MenuManager } from "@/components/admin/menu-manager";
import {
  getMenuForMerchant,
  getMerchantForUser,
} from "@/actions/orders";

export default async function MenuPage() {
  const merchant = await getMerchantForUser();
  if (!merchant) redirect("/admin/login");

  const { categories, items } = await getMenuForMerchant(merchant.id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Gestion de la Carte</h1>
        <p className="text-sm text-muted-foreground">
          Ruptures de stock et photos — mise à jour instantanée côté client
        </p>
      </div>
      <MenuManager
        merchantId={merchant.id}
        categories={categories}
        menuItems={items}
      />
    </div>
  );
}
