import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/admin/settings-form";
import { getMerchantForUser } from "@/actions/orders";

export default async function SettingsPage() {
  const merchant = await getMerchantForUser();
  if (!merchant) redirect("/admin/login");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Configuration</h1>
        <p className="text-sm text-muted-foreground">
          Créneaux horaires et programme fidélité
        </p>
      </div>
      <SettingsForm merchant={merchant} />
    </div>
  );
}
