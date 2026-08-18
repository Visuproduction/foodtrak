"use client";

import { useTransition } from "react";
import { Clock, Phone, User } from "lucide-react";
import { updateOrderStatus } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getNextStatus,
  useKdsRealtime,
} from "@/hooks/use-realtime";
import { formatPrice, formatTime } from "@/lib/utils";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_EMOJI,
  ORDER_STATUS_LABELS,
  type Order,
  type OrderStatus,
} from "@/types/database";

interface KdsOrder extends Order {
  order_items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    menu_items: { name: string } | null;
  }>;
}

interface KdsBoardProps {
  merchantId: string;
  initialOrders: KdsOrder[];
}

export function KdsBoard({ merchantId, initialOrders }: KdsBoardProps) {
  const orders = useKdsRealtime(merchantId, initialOrders) as KdsOrder[];
  const [isPending, startTransition] = useTransition();

  function advanceStatus(orderId: string, currentStatus: OrderStatus) {
    const next = getNextStatus(currentStatus);
    if (!next) return;

    startTransition(async () => {
      await updateOrderStatus(orderId, next);
    });
  }

  if (orders.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-2xl">🍳</p>
          <p className="mt-2">Aucune commande en cours</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {orders.map((order) => {
        const nextStatus = getNextStatus(order.status);
        return (
          <Card
            key={order.id}
            className={`border-2 ${ORDER_STATUS_COLORS[order.status]} transition-all`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono">
                  #{order.id.slice(0, 6).toUpperCase()}
                </Badge>
                <span className="text-2xl">
                  {ORDER_STATUS_EMOJI[order.status]}
                </span>
              </div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-4 w-4" />
                {formatTime(order.pickup_time)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4" />
                {order.customer_first_name}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {order.customer_phone}
              </div>

              <ul className="space-y-1 border-t pt-2 text-sm">
                {order.order_items?.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>
                      {item.quantity}× {item.menu_items?.name ?? "Article"}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-semibold">
                  {formatPrice(order.total_price)}
                </span>
                <Badge>{ORDER_STATUS_LABELS[order.status]}</Badge>
              </div>

              {nextStatus && (
                <Button
                  className="w-full h-12 text-base touch-manipulation"
                  onClick={() => advanceStatus(order.id, order.status)}
                  disabled={isPending}
                >
                  → {ORDER_STATUS_LABELS[nextStatus]}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
