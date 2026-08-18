"use client";

import { useState, useTransition } from "react";
import { updateMerchantSettings } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Merchant } from "@/types/database";

interface SettingsFormProps {
  merchant: Merchant;
}

export function SettingsForm({ merchant }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    business_name: merchant.business_name,
    capacity_per_slot: merchant.capacity_per_slot,
    slot_duration_minutes: merchant.slot_duration_minutes,
    loyalty_reward_threshold: merchant.loyalty_reward_threshold,
    loyalty_reward_description: merchant.loyalty_reward_description,
    is_open: merchant.is_open,
  });
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateMerchantSettings(merchant.id, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commerce</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business_name">Nom du commerce</Label>
            <Input
              id="business_name"
              value={form.business_name}
              onChange={(e) =>
                setForm({ ...form, business_name: e.target.value })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>Ouvert aux commandes</Label>
              <p className="text-xs text-muted-foreground">
                Fermer empêche les nouvelles commandes client
              </p>
            </div>
            <Switch
              checked={form.is_open}
              onCheckedChange={(v) => setForm({ ...form, is_open: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Créneaux horaires</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacité max / créneau</Label>
            <Input
              id="capacity"
              type="number"
              min={1}
              value={form.capacity_per_slot}
              onChange={(e) =>
                setForm({
                  ...form,
                  capacity_per_slot: parseInt(e.target.value, 10),
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Durée créneau (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min={5}
              step={5}
              value={form.slot_duration_minutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  slot_duration_minutes: parseInt(e.target.value, 10),
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Programme fidélité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="threshold">Seuil de tampons</Label>
            <Input
              id="threshold"
              type="number"
              min={2}
              value={form.loyalty_reward_threshold}
              onChange={(e) =>
                setForm({
                  ...form,
                  loyalty_reward_threshold: parseInt(e.target.value, 10),
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reward">Description récompense</Label>
            <Input
              id="reward"
              value={form.loyalty_reward_description}
              onChange={(e) =>
                setForm({
                  ...form,
                  loyalty_reward_description: e.target.value,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending}>
        {saved ? "✓ Enregistré" : isPending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
