import Link from "next/link";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const demoSlug =
    process.env.NEXT_PUBLIC_DEFAULT_MERCHANT_SLUG ?? "demo-truck";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-orange-50 to-background px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Truck className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">FoodTrak</h1>
        <p className="mt-3 text-muted-foreground">
          Prise de commande, file d&apos;attente et fidélité pour food-trucks.
          Zéro friction client, 100% Web Realtime.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/${demoSlug}`}>
            <Button size="lg" className="w-full sm:w-auto">
              Menu client (démo)
            </Button>
          </Link>
          <Link href="/admin/login">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Espace commerçant
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
