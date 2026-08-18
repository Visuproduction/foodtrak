import { notFound } from "next/navigation";
import { ClientMenu } from "@/components/client/client-menu";
import { getMenuForMerchant, getMerchantBySlug } from "@/actions/orders";

interface PageProps {
  params: Promise<{ merchantSlug: string }>;
}

export default async function MerchantMenuPage({ params }: PageProps) {
  const { merchantSlug } = await params;
  const merchant = await getMerchantBySlug(merchantSlug);

  if (!merchant) notFound();

  const { categories, items } = await getMenuForMerchant(merchant.id);

  return (
    <ClientMenu
      merchant={merchant}
      categories={categories}
      menuItems={items}
    />
  );
}
