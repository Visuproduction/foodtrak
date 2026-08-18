"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { GripVertical, Plus, Trash2, Upload } from "lucide-react";
import {
  deleteCategory,
  deleteMenuItem,
  toggleMenuItemAvailability,
  uploadMenuImage,
  upsertCategory,
  upsertMenuItem,
} from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMenuRealtime } from "@/hooks/use-realtime";
import { formatPrice } from "@/lib/utils";
import type { Category, MenuItem } from "@/types/database";

interface MenuManagerProps {
  merchantId: string;
  categories: Category[];
  menuItems: MenuItem[];
}

export function MenuManager({
  merchantId,
  categories: initialCategories,
  menuItems: initialItems,
}: MenuManagerProps) {
  const liveItems = useMenuRealtime(merchantId, initialItems);
  const [categories, setCategories] = useState(initialCategories);
  const [isPending, startTransition] = useTransition();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(
    null
  );

  function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    startTransition(async () => {
      await upsertCategory(merchantId, {
        name: newCategoryName.trim(),
        display_order: categories.length,
      });
      setCategories((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          merchant_id: merchantId,
          name: newCategoryName.trim(),
          display_order: categories.length,
          created_at: new Date().toISOString(),
        },
      ]);
      setNewCategoryName("");
    });
  }

  function handleToggleAvailability(itemId: string, available: boolean) {
    startTransition(async () => {
      await toggleMenuItemAvailability(itemId, available);
    });
  }

  function handleUploadImage(itemId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("merchantId", merchantId);

    startTransition(async () => {
      const result = await uploadMenuImage(formData);
      if (result.url) {
        const item = liveItems.find((i) => i.id === itemId);
        if (item) {
          await upsertMenuItem(merchantId, {
            id: itemId,
            category_id: item.category_id,
            name: item.name,
            description: item.description ?? undefined,
            price: item.price,
            image_url: result.url,
            is_available: item.is_available,
            display_order: item.display_order,
          });
        }
      }
    });
  }

  function handleSaveItem() {
    if (!editingItem?.name || !editingItem.category_id || !editingItem.price)
      return;

    startTransition(async () => {
      await upsertMenuItem(merchantId, {
        id: editingItem.id,
        category_id: editingItem.category_id!,
        name: editingItem.name!,
        description: editingItem.description ?? undefined,
        price: Number(editingItem.price),
        image_url: editingItem.image_url,
        is_available: editingItem.is_available ?? true,
        display_order: editingItem.display_order ?? liveItems.length,
      });
      setEditingItem(null);
    });
  }

  return (
    <Tabs defaultValue="products" className="space-y-6">
      <TabsList>
        <TabsTrigger value="products">Produits</TabsTrigger>
        <TabsTrigger value="categories">Catégories</TabsTrigger>
      </TabsList>

      <TabsContent value="categories" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catégories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span>{cat.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteCategory(cat.id);
                      setCategories((prev) =>
                        prev.filter((c) => c.id !== cat.id)
                      );
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Nouvelle catégorie"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <Button onClick={handleAddCategory} disabled={isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="products" className="space-y-4">
        <div className="flex justify-end">
          <Button
            onClick={() =>
              setEditingItem({
                category_id: categories[0]?.id,
                name: "",
                price: 0,
                is_available: true,
                display_order: liveItems.length,
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouveau produit
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {liveItems.map((item) => (
            <Card
              key={item.id}
              className={!item.is_available ? "opacity-50 grayscale" : ""}
            >
              <CardContent className="flex gap-4 p-4">
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
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted">
                    🍕
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(item.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`avail-${item.id}`} className="text-xs">
                        En stock
                      </Label>
                      <Switch
                        id={`avail-${item.id}`}
                        checked={item.is_available}
                        onCheckedChange={(v) =>
                          handleToggleAvailability(item.id, v)
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadImage(item.id, file);
                        }}
                      />
                      <Button variant="outline" size="sm" asChild>
                        <span>
                          <Upload className="mr-1 h-3 w-3" />
                          Photo
                        </span>
                      </Button>
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingItem(item)}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteMenuItem(item.id);
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {editingItem && (
          <Card className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg shadow-2xl md:inset-x-auto md:right-8 md:top-8 md:bottom-auto">
            <CardHeader>
              <CardTitle className="text-base">
                {editingItem.id ? "Modifier" : "Nouveau"} produit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input
                  value={editingItem.name ?? ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editingItem.description ?? ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Prix (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingItem.price ?? 0}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      price: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={editingItem.category_id ?? ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      category_id: e.target.value,
                    })
                  }
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveItem} disabled={isPending}>
                  Enregistrer
                </Button>
                <Button variant="outline" onClick={() => setEditingItem(null)}>
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
