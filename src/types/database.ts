export type OrderStatus =
  | "received"
  | "preparing"
  | "ready"
  | "picked_up"
  | "cancelled";

export interface Merchant {
  id: string;
  user_id: string | null;
  slug: string;
  business_name: string;
  capacity_per_slot: number;
  slot_duration_minutes: number;
  loyalty_reward_threshold: number;
  loyalty_reward_description: string;
  is_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  merchant_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  merchant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  merchant_id: string;
  customer_first_name: string;
  customer_phone: string;
  status: OrderStatus;
  pickup_time: string;
  total_price: number;
  loyalty_opt_in: boolean;
  loyalty_stamps_used: number;
  loyalty_discount: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface LoyaltyAccount {
  id: string;
  merchant_id: string;
  customer_phone: string;
  stamps_count: number;
  updated_at: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  remainingCapacity: number;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Reçue",
  preparing: "En préparation",
  ready: "Prête",
  picked_up: "Retirée",
  cancelled: "Annulée",
};

export const ORDER_STATUS_EMOJI: Record<OrderStatus, string> = {
  received: "🟡",
  preparing: "🟠",
  ready: "🟢",
  picked_up: "✅",
  cancelled: "❌",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  received: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  preparing: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  ready: "bg-green-500/20 text-green-400 border-green-500/40",
  picked_up: "bg-gray-500/20 text-gray-400 border-gray-500/40",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/40",
};
