"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMenuRealtime } from "@/hooks/use-realtime";
import { formatPrice } from "@/lib/utils";
import type { CartItem, Category, MenuItem, Merchant } from "@/types/database";

interface ClientMenuProps {
  merchant: Merchant;
  categories: Category[];
  menuItems: MenuItem[];
}

export function ClientMenu({ merchant, categories, menuItems }: ClientMenuProps) {
  const liveItems = useMenuRealtime(merchant.id, menuItems);
  const [cart, setCart] = useState<CartItem[]>([]);

  const availableItems = useMemo(
    () => liveItems.filter((item) => item.is_available),
    [liveItems]
  );

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(menuItem: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItem.id === menuItem.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { menuItem, quantity: 1 }];
    });
  }

  function updateQuantity(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItem.id === menuItemId
            ? { ...c, quantity: c.quantity + delta }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold">{merchant.business_name}</h1>
            {!merchant.is_open && (
              <Badge variant="secondary" className="mt-1">
                Fermé
              </Badge>
            )}
          </div>
          <Link
            href={`/${merchant.slug}/track`}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Suivre ma commande
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-8">
        {categories.map((category) => {
          const items = availableItems.filter(
            (item) => item.category_id === category.id
          );
          if (items.length === 0) return null;

          return (
            <section key={category.id}>
              <h2 className="mb-4 text-lg font-semibold">{category.name}</h2>
              <div className="space-y-3">
                {items.map((item) => {
                  const inCart = cart.find((c) => c.menuItem.id === item.id);
                  return (
                    <div
                      key={item.id}
                      className="flex gap-3 rounded-xl border p-3"
                    >
                      {item.image_url ? (
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
                          🍕
                        </div>
                      )}
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <h3 className="font-medium">{item.name}</h3>
                          {item.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-primary">
                            {formatPrice(item.price)}
                          </span>
                          {inCart ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.id, -1)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-6 text-center font-medium">
                                {inCart.quantity}
                              </span>
                              <Button
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.id, 1)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => addToCart(item)}
                              disabled={!merchant.is_open}
                            >
                              Ajouter
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <Link
              href={{
                pathname: `/${merchant.slug}/checkout`,
                query: { cart: encodeURIComponent(JSON.stringify(cart)) },
              }}
              className="flex-1"
            >
              <Button className="w-full h-12 text-base" size="lg">
                <ShoppingCart className="mr-2 h-5 w-5" />
                Commander · {formatPrice(cartTotal)}
                <Badge variant="secondary" className="ml-2 bg-primary-foreground/20">
                  {cartCount}
                </Badge>
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
