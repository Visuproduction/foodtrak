"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const businessName = (formData.get("businessName") as string) ?? "";

    startTransition(async () => {
      const result =
        mode === "signup"
          ? await signUp(email, password, businessName)
          : await signIn(email, password);

      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/admin/kds");
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader className="text-center space-y-3">
        <CardTitle>Espace commerçant</CardTitle>
        <div className="flex rounded-lg bg-muted p-1 text-sm">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 ${
              mode === "signup" ? "bg-background shadow font-medium" : "text-muted-foreground"
            }`}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
          >
            Créer un compte
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 ${
              mode === "login" ? "bg-background shadow font-medium" : "text-muted-foreground"
            }`}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Connexion
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="businessName">Nom du food-truck</Label>
              <Input
                id="businessName"
                name="businessName"
                placeholder="Pizza Truck Demo"
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending
              ? "En cours..."
              : mode === "signup"
                ? "Créer mon espace"
                : "Se connecter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
