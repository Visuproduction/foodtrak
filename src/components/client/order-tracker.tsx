"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { findActiveOrder, getOrderById } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOrderRealtime } from "@/hooks/use-realtime";
import {
  formatPrice,
  formatTime,
  loadOrderRef,
} from "@/lib/utils";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_EMOJI,
  ORDER_STATUS_LABELS,
  type Merchant,
  type Order,
} from "@/types/database";

interface OrderTrackerProps {
  merchant: Merchant;
  initialOrder: Order | null;
}

export function OrderTracker({ merchant, initialOrder }: OrderTrackerProps) {
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");
  const [orderId, setOrderId] = useState<string | null>(
    orderIdParam ?? initialOrder?.id ?? null
  );
  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();
  const [searchError, setSearchError] = useState<string | null>(null);

  const liveOrder = useOrderRealtime(orderId, order);

  useEffect(() => {
    const stored = loadOrderRef(merchant.slug);
    if (stored && !orderId) {
      setOrderId(stored.orderId);
      setFirstName(stored.firstName);
      setPhone(stored.phone);
      getOrderById(stored.orderId).then(setOrder);
    }
  }, [merchant.slug, orderId]);

  useEffect(() => {
    if (orderIdParam) {
      getOrderById(orderIdParam).then(setOrder);
      setOrderId(orderIdParam);
    }
  }, [orderIdParam]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);
    startTransition(async () => {
      const found = await findActiveOrder(merchant.id, firstName, phone);
      if (!found) {
        setSearchError("Aucune commande active trouvée.");
        return;
      }
      setOrder(found);
      setOrderId(found.id);
    });
  }

  const displayOrder = liveOrder ?? order;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-4">
        <Link
          href={`/${merchant.slug}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au menu
        </Link>
        <h1 className="mt-2 text-xl font-bold">Suivi de commande</h1>
        <p className="text-sm text-muted-foreground">
          Mise à jour en temps réel · sans SMS
        </p>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        {!displayOrder ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Retrouver ma commande</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="searchFirstName">Prénom</Label>
                  <Input
                    id="searchFirstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="searchPhone">Téléphone</Label>
                  <Input
                    id="searchPhone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                {searchError && (
                  <p className="text-sm text-destructive">{searchError}</p>
                )}
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Rechercher
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center">
              <div className="text-5xl mb-2">
                {ORDER_STATUS_EMOJI[displayOrder.status]}
              </div>
              <CardTitle>
                {ORDER_STATUS_LABELS[displayOrder.status]}
              </CardTitle>
              <Badge
                className={`mx-auto mt-2 ${ORDER_STATUS_COLORS[displayOrder.status]}`}
              >
                Commande #{displayOrder.id.slice(0, 8).toUpperCase()}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Retrait prévu</p>
                <p className="text-2xl font-bold">
                  {formatTime(displayOrder.pickup_time)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">
                  {formatPrice(displayOrder.total_price)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground animate-pulse">
                ● Mise à jour en direct
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
