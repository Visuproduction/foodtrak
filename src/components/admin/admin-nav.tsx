import Link from "next/link";
import { ChefHat, LayoutGrid, Settings, LogOut } from "lucide-react";
import { signOut } from "@/actions/orders";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin/kds", label: "Cuisine (KDS)", icon: ChefHat },
  { href: "/admin/menu", label: "Carte & Menu", icon: LayoutGrid },
  { href: "/admin/settings", label: "Configuration", icon: Settings },
];

export function AdminNav() {
  return (
    <nav className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/admin/kds" className="text-lg font-bold text-primary">
            FoodTrak
          </Link>
          <div className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
        <form action={signOut}>
          <Button variant="outline" size="sm" type="submit">
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </form>
      </div>
    </nav>
  );
}
