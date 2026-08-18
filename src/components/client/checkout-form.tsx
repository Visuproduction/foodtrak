"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  getAvailablePickupSlots,
  getLoyaltyStamps,
  placeOrder,
} from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice, formatTime, saveOrderRef } from "@/lib/utils";
import type { ComputedSlot } from "@/lib/slotCalculator";
import type { CartItem, Merchant } from "@/types/database";

interface CheckoutFormProps {
  merchant: Merchant;
  cart: CartItem[];
}

export function CheckoutForm({ merchant, cart }: CheckoutFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [loyaltyOptIn, setLoyaltyOptIn] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [slots, setSlots] = useState<ComputedSlot[]>([]);
  const [stamps, setStamps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );

  const willGetReward =
    loyaltyOptIn && stamps + 1 >= merchant.loyalty_reward_threshold;

  useEffect(() => {
    getAvailablePickupSlots(merchant.id).then((data) => {
      setSlots(data);
      if (data[0]) setSelectedSlot(data[0].start.toISOString());
      setLoadingSlots(false);
    });
  }, [merchant.id]);

  useEffect(() => {
    if (phone.length >= 10 && loyaltyOptIn) {
      getLoyaltyStamps(merchant.id, phone).then(setStamps);
    }
  }, [phone, loyaltyOptIn, merchant.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || phone.length < 10) {
      setError("Prénom et téléphone requis.");
      return;
    }
    if (!selectedSlot) {
      setError("Choisissez un créneau de retrait.");
      return;
    }

    startTransition(async () => {
      const result = await placeOrder({
        merchantId: merchant.id,
        merchantSlug: merchant.slug,
        firstName,
        phone,
        loyaltyOptIn,
        pickupTime: selectedSlot,
        cart,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.orderId) {
        saveOrderRef(merchant.slug, {
          orderId: result.orderId,
          firstName: firstName.trim(),
          phone,
        });
        router.push(`/${merchant.slug}/track?orderId=${result.orderId}`);
      }
    });
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-muted-foreground">Votre panier est vide.</p>
        <Link href={`/${merchant.slug}`}>
          <Button className="mt-4">Retour au menu</Button>
        </Link>
      </div>
    );
  }

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
        <h1 className="mt-2 text-xl font-bold">Checkout express</h1>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Récapitulatif</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cart.map((item) => (
              <div key={item.menuItem.id} className="flex justify-between text-sm">
                <span>
                  {item.quantity}× {item.menuItem.name}
                </span>
                <span>{formatPrice(item.menuItem.price * item.quantity)}</span>
              </div>
            ))}
            {willGetReward && (
              <p className="text-sm text-green-600 font-medium">
                🎁 {merchant.loyalty_reward_description} appliquée !
              </p>
            )}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Prénom</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jean"
              required
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              required
              autoComplete="tel"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Créneau de retrait</Label>
          {loadingSlots ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calcul des créneaux...
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-destructive">
              Aucun créneau disponible pour le moment.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.start.toISOString()}
                  type="button"
                  onClick={() => setSelectedSlot(slot.start.toISOString())}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selectedSlot === slot.start.toISOString()
                      ? "border-primary bg-primary/10 font-medium"
                      : "hover:bg-muted"
                  }`}
                >
                  {formatTime(slot.start)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-start gap-3 rounded-lg border p-4">
          <Checkbox
            id="loyalty"
            checked={loyaltyOptIn}
            onCheckedChange={(v) => setLoyaltyOptIn(v === true)}
          />
          <div className="space-y-1">
            <Label htmlFor="loyalty" className="cursor-pointer">
              Programme fidélité (RGPD)
            </Label>
            <p className="text-xs text-muted-foreground">
              J&apos;accepte le cumul de tampons sur mon numéro. Seuil :{" "}
              {merchant.loyalty_reward_threshold} commandes →{" "}
              {merchant.loyalty_reward_description}.
              {loyaltyOptIn && stamps > 0 && (
                <span className="block mt-1 font-medium text-primary">
                  Vous avez {stamps} tampon{stamps > 1 ? "s" : ""}.
                </span>
              )}
            </p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          type="submit"
          className="w-full h-12 text-base"
          size="lg"
          disabled={isPending || slots.length === 0}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Commande en cours...
            </>
          ) : (
            `Confirmer · ${formatPrice(subtotal)}`
          )}
        </Button>
      </form>
    </div>
  );
}
