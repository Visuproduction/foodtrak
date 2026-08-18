"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAvailableSlotsOnly,
  isSlotStillAvailable,
  type ExistingOrderSlot,
} from "@/lib/slotCalculator";
import { normalizePhone } from "@/lib/utils";
import type { CartItem, Merchant, OrderStatus } from "@/types/database";

export async function getMerchantBySlug(slug: string): Promise<Merchant | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("merchants")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
}

export async function getMenuForMerchant(merchantId: string) {
  const supabase = await createClient();

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("display_order"),
    supabase
      .from("menu_items")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("display_order"),
  ]);

  return { categories: categories ?? [], items: items ?? [] };
}

export async function getAvailablePickupSlots(merchantId: string) {
  const supabase = await createClient();

  const { data: merchant } = await supabase
    .from("merchants")
    .select("capacity_per_slot, slot_duration_minutes")
    .eq("id", merchantId)
    .single();

  if (!merchant) return [];

  const horizon = new Date();
  horizon.setHours(horizon.getHours() + 6);

  const { data: orders } = await supabase
    .from("orders")
    .select("pickup_time")
    .eq("merchant_id", merchantId)
    .gte("pickup_time", new Date().toISOString())
    .lte("pickup_time", horizon.toISOString())
    .not("status", "eq", "cancelled");

  const existing: ExistingOrderSlot[] = (orders ?? []).map((o) => ({
    pickupTime: new Date(o.pickup_time),
  }));

  return getAvailableSlotsOnly(
    {
      capacityPerSlot: merchant.capacity_per_slot,
      slotDurationMinutes: merchant.slot_duration_minutes,
    },
    existing
  );
}

export async function getLoyaltyStamps(merchantId: string, phone: string) {
  const supabase = await createClient();
  const normalized = normalizePhone(phone);

  const { data } = await supabase
    .from("loyalty_accounts")
    .select("stamps_count")
    .eq("merchant_id", merchantId)
    .eq("customer_phone", normalized)
    .maybeSingle();

  return data?.stamps_count ?? 0;
}

interface CheckoutPayload {
  merchantId: string;
  merchantSlug: string;
  firstName: string;
  phone: string;
  loyaltyOptIn: boolean;
  pickupTime: string;
  cart: CartItem[];
}

export async function placeOrder(payload: CheckoutPayload) {
  const supabase = await createClient();
  const phone = normalizePhone(payload.phone);

  const { data: merchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("id", payload.merchantId)
    .single();

  if (!merchant) return { error: "Commerçant introuvable." };

  const pickupDate = new Date(payload.pickupTime);

  const horizon = new Date();
  horizon.setHours(horizon.getHours() + 6);

  const { data: existingOrders } = await supabase
    .from("orders")
    .select("pickup_time")
    .eq("merchant_id", payload.merchantId)
    .gte("pickup_time", new Date().toISOString())
    .lte("pickup_time", horizon.toISOString())
    .not("status", "eq", "cancelled");

  const existing: ExistingOrderSlot[] = (existingOrders ?? []).map((o) => ({
    pickupTime: new Date(o.pickup_time),
  }));

  const slotValid = isSlotStillAvailable(
    pickupDate,
    {
      capacityPerSlot: merchant.capacity_per_slot,
      slotDurationMinutes: merchant.slot_duration_minutes,
    },
    existing
  );

  if (!slotValid) {
    return { error: "Ce créneau n'est plus disponible. Choisissez-en un autre." };
  }

  const subtotal = payload.cart.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );

  let loyaltyDiscount = 0;
  let loyaltyStampsUsed = 0;

  if (payload.loyaltyOptIn) {
    const stamps = await getLoyaltyStamps(payload.merchantId, phone);
    if (stamps + 1 >= merchant.loyalty_reward_threshold) {
      // Récompense = prix du produit le plus cher du panier
      const maxItemPrice = Math.max(
        ...payload.cart.map((c) => c.menuItem.price)
      );
      loyaltyDiscount = maxItemPrice;
      loyaltyStampsUsed = merchant.loyalty_reward_threshold;
    }
  }

  const totalPrice = Math.max(0, subtotal - loyaltyDiscount);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      merchant_id: payload.merchantId,
      customer_first_name: payload.firstName.trim(),
      customer_phone: phone,
      pickup_time: pickupDate.toISOString(),
      total_price: totalPrice,
      loyalty_opt_in: payload.loyaltyOptIn,
      loyalty_discount: loyaltyDiscount,
      loyalty_stamps_used: loyaltyStampsUsed,
      status: "received",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { error: "Impossible de créer la commande." };
  }

  const orderItems = payload.cart.map((item) => ({
    order_id: order.id,
    menu_item_id: item.menuItem.id,
    quantity: item.quantity,
    unit_price: item.menuItem.price,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    return { error: "Erreur lors de l'ajout des articles." };
  }

  revalidatePath(`/${payload.merchantSlug}`);
  return { orderId: order.id };
}

export async function findActiveOrder(
  merchantId: string,
  firstName: string,
  phone: string
) {
  const supabase = await createClient();
  const normalized = normalizePhone(phone);

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("customer_first_name", firstName.trim())
    .eq("customer_phone", normalized)
    .not("status", "in", '("picked_up","cancelled")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function getOrderById(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();
  return data;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) return { error: error.message };
  revalidatePath("/admin/kds");
  return { success: true };
}

export async function getKdsOrders(merchantId: string) {
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (
        id, quantity, unit_price,
        menu_items ( name )
      )
    `)
    .eq("merchant_id", merchantId)
    .gte("pickup_time", today.toISOString())
    .not("status", "in", '("picked_up","cancelled")')
    .order("pickup_time");

  return data ?? [];
}

export async function getMerchantForUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("merchants")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}

export async function updateMerchantSettings(
  merchantId: string,
  settings: Partial<
    Pick<
      Merchant,
      | "business_name"
      | "capacity_per_slot"
      | "slot_duration_minutes"
      | "loyalty_reward_threshold"
      | "loyalty_reward_description"
      | "is_open"
    >
  >
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("merchants")
    .update(settings)
    .eq("id", merchantId);

  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function upsertCategory(
  merchantId: string,
  data: { id?: string; name: string; display_order: number }
) {
  const supabase = await createClient();

  if (data.id) {
    const { error } = await supabase
      .from("categories")
      .update({ name: data.name, display_order: data.display_order })
      .eq("id", data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("categories").insert({
      merchant_id: merchantId,
      name: data.name,
      display_order: data.display_order,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/menu");
  return { success: true };
}

export async function deleteCategory(categoryId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId);
  if (error) return { error: error.message };
  revalidatePath("/admin/menu");
  return { success: true };
}

export async function upsertMenuItem(
  merchantId: string,
  data: {
    id?: string;
    category_id: string;
    name: string;
    description?: string;
    price: number;
    image_url?: string | null;
    is_available: boolean;
    display_order: number;
  }
) {
  const supabase = await createClient();

  if (data.id) {
    const { error } = await supabase
      .from("menu_items")
      .update({
        category_id: data.category_id,
        name: data.name,
        description: data.description ?? null,
        price: data.price,
        image_url: data.image_url ?? null,
        is_available: data.is_available,
        display_order: data.display_order,
      })
      .eq("id", data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("menu_items").insert({
      merchant_id: merchantId,
      category_id: data.category_id,
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      image_url: data.image_url ?? null,
      is_available: data.is_available,
      display_order: data.display_order,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/menu");
  return { success: true };
}

export async function toggleMenuItemAvailability(
  itemId: string,
  isAvailable: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: isAvailable })
    .eq("id", itemId);

  if (error) return { error: error.message };
  revalidatePath("/admin/menu");
  return { success: true };
}

export async function deleteMenuItem(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath("/admin/menu");
  return { success: true };
}

export async function uploadMenuImage(formData: FormData) {
  const supabase = await createClient();
  const file = formData.get("file") as File;
  const merchantId = formData.get("merchantId") as string;

  if (!file || !merchantId) return { error: "Fichier ou merchant manquant." };

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${merchantId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("menu-images")
    .upload(path, file, { upsert: true });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("menu-images").getPublicUrl(path);

  return { url: publicUrl };
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export async function signIn(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { success: true };
}

export async function signUp(
  email: string,
  password: string,
  businessName: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: error.message };
  if (!data.user) return { error: "Impossible de créer le compte." };

  if (!data.session) {
    return {
      error:
        "Compte créé, mais la confirmation email est activée. Désactivez-la dans Supabase → Authentication → Providers → Email → Confirm email, puis reconnectez-vous.",
    };
  }

  const { data: unclaimed } = await supabase
    .from("merchants")
    .select("id")
    .eq("slug", "demo-truck")
    .is("user_id", null)
    .maybeSingle();

  if (unclaimed) {
    const { error: claimError } = await supabase
      .from("merchants")
      .update({
        user_id: data.user.id,
        business_name: businessName.trim() || "Pizza Truck Demo",
      })
      .eq("id", unclaimed.id);

    if (claimError) return { error: claimError.message };
    return { success: true };
  }

  const baseSlug = slugify(businessName) || "mon-truck";
  let slug = baseSlug;
  for (let i = 0; i < 8; i++) {
    const { data: existing } = await supabase
      .from("merchants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${i + 2}`;
  }

  const { error: insertError } = await supabase.from("merchants").insert({
    user_id: data.user.id,
    slug,
    business_name: businessName.trim(),
  });

  if (insertError) return { error: insertError.message };
  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
