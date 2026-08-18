import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { getMerchantForUser } from "@/actions/orders";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const merchant = await getMerchantForUser();

  if (!merchant) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
