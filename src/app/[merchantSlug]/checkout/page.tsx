import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/client/checkout-form";
import { getMerchantBySlug } from "@/actions/orders";
import type { CartItem } from "@/types/database";

interface PageProps {
  params: Promise<{ merchantSlug: string }>;
  searchParams: Promise<{ cart?: string }>;
}

export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps) {
  const { merchantSlug } = await params;
  const { cart: cartParam } = await searchParams;
  const merchant = await getMerchantBySlug(merchantSlug);

  if (!merchant) notFound();

  let cart: CartItem[] = [];
  if (cartParam) {
    try {
      cart = JSON.parse(decodeURIComponent(cartParam)) as CartItem[];
    } catch {
      cart = [];
    }
  }

  return <CheckoutForm merchant={merchant} cart={cart} />;
}
