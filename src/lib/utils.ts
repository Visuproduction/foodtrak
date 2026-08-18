import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").replace(/^\+33/, "0");
}

export function getOrderStorageKey(merchantSlug: string): string {
  return `foodtrak:order:${merchantSlug}`;
}

export interface StoredOrderRef {
  orderId: string;
  firstName: string;
  phone: string;
}

export function saveOrderRef(merchantSlug: string, ref: StoredOrderRef): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getOrderStorageKey(merchantSlug), JSON.stringify(ref));
}

export function loadOrderRef(merchantSlug: string): StoredOrderRef | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(getOrderStorageKey(merchantSlug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredOrderRef;
  } catch {
    return null;
  }
}
