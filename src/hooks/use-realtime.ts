"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderStatus } from "@/types/database";

export function useOrderRealtime(
  orderId: string | null,
  initialOrder: Order | null
) {
  const [order, setOrder] = useState<Order | null>(initialOrder);

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    if (!orderId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setOrder(payload.new as Order);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return order;
}

export function useKdsRealtime(
  merchantId: string,
  initialOrders: Order[]
) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`kds:${merchantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setOrders((prev) =>
              [...prev, payload.new as Order].sort(
                (a, b) =>
                  new Date(a.pickup_time).getTime() -
                  new Date(b.pickup_time).getTime()
              )
            );
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Order;
            if (updated.status === "picked_up" || updated.status === "cancelled") {
              setOrders((prev) => prev.filter((o) => o.id !== updated.id));
            } else {
              setOrders((prev) =>
                prev
                  .map((o) => (o.id === updated.id ? updated : o))
                  .sort(
                    (a, b) =>
                      new Date(a.pickup_time).getTime() -
                      new Date(b.pickup_time).getTime()
                  )
              );
            }
          } else if (payload.eventType === "DELETE") {
            setOrders((prev) =>
              prev.filter((o) => o.id !== (payload.old as Order).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId]);

  return orders;
}

export function useMenuRealtime<T extends { id: string; is_available: boolean }>(
  merchantId: string,
  initialItems: T[]
) {
  const [items, setItems] = useState<T[]>(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`menu:${merchantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setItems((prev) => [...prev, payload.new as T]);
          } else if (payload.eventType === "UPDATE") {
            setItems((prev) =>
              prev.map((item) =>
                item.id === (payload.new as T).id ? (payload.new as T) : item
              )
            );
          } else if (payload.eventType === "DELETE") {
            setItems((prev) =>
              prev.filter((item) => item.id !== (payload.old as T).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId]);

  return items;
}

export function getNextStatus(current: OrderStatus): OrderStatus | null {
  const flow: Record<OrderStatus, OrderStatus | null> = {
    received: "preparing",
    preparing: "ready",
    ready: "picked_up",
    picked_up: null,
    cancelled: null,
  };
  return flow[current];
}
