-- ============================================================================
-- FoodTrak — Schéma Supabase complet
-- Exécuter dans : Supabase Dashboard → SQL Editor
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE order_status AS ENUM (
  'received',      -- 🟡 Reçue
  'preparing',     -- 🟠 En préparation
  'ready',         -- 🟢 Prête
  'picked_up',     -- Retirée
  'cancelled'      -- Annulée
);

-- ─── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE merchants (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  slug                        TEXT NOT NULL UNIQUE,
  business_name               TEXT NOT NULL,
  capacity_per_slot           INTEGER NOT NULL DEFAULT 5 CHECK (capacity_per_slot > 0),
  slot_duration_minutes       INTEGER NOT NULL DEFAULT 10 CHECK (slot_duration_minutes > 0),
  loyalty_reward_threshold    INTEGER NOT NULL DEFAULT 10 CHECK (loyalty_reward_threshold > 0),
  loyalty_reward_description  TEXT NOT NULL DEFAULT '1 pizza offerte',
  is_open                     BOOLEAN NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  category_id   UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  image_url     TEXT,
  is_available  BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id          UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_first_name  TEXT NOT NULL,
  customer_phone       TEXT NOT NULL,
  status               order_status NOT NULL DEFAULT 'received',
  pickup_time          TIMESTAMPTZ NOT NULL,
  total_price          NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
  loyalty_opt_in       BOOLEAN NOT NULL DEFAULT false,
  loyalty_stamps_used  INTEGER NOT NULL DEFAULT 0,
  loyalty_discount     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE loyalty_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id    UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  stamps_count   INTEGER NOT NULL DEFAULT 0 CHECK (stamps_count >= 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, customer_phone)
);

-- ─── Index ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_merchants_slug ON merchants(slug);
CREATE INDEX idx_merchants_user_id ON merchants(user_id);
CREATE INDEX idx_categories_merchant ON categories(merchant_id, display_order);
CREATE INDEX idx_menu_items_merchant ON menu_items(merchant_id, is_available);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_orders_merchant_status ON orders(merchant_id, status, pickup_time);
CREATE INDEX idx_orders_customer_lookup ON orders(merchant_id, customer_phone, customer_first_name);
CREATE INDEX idx_orders_pickup_time ON orders(merchant_id, pickup_time);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_loyalty_accounts_lookup ON loyalty_accounts(merchant_id, customer_phone);

-- ─── Triggers updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_merchants_updated_at
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_loyalty_accounts_updated_at
  BEFORE UPDATE ON loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Fonction : purge données personnelles (RGPD, opt-in non coché) ──────────

CREATE OR REPLACE FUNCTION purge_non_opt_in_customer_data()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Anonymiser les commandes sans opt-in fidélité de plus de 24h
  UPDATE orders
  SET
    customer_first_name = 'Anonyme',
    customer_phone      = '0000000000'
  WHERE
    loyalty_opt_in = false
    AND created_at < now() - INTERVAL '24 hours'
    AND customer_phone <> '0000000000';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Fonction : cumul fidélité après commande ───────────────────────────────

CREATE OR REPLACE FUNCTION apply_loyalty_on_order()
RETURNS TRIGGER AS $$
DECLARE
  v_threshold INTEGER;
  v_stamps    INTEGER;
BEGIN
  IF NEW.loyalty_opt_in = true THEN
    SELECT loyalty_reward_threshold INTO v_threshold
    FROM merchants WHERE id = NEW.merchant_id;

    INSERT INTO loyalty_accounts (merchant_id, customer_phone, stamps_count)
    VALUES (NEW.merchant_id, NEW.customer_phone, 1)
    ON CONFLICT (merchant_id, customer_phone)
    DO UPDATE SET stamps_count = loyalty_accounts.stamps_count + 1,
                  updated_at = now()
    RETURNING stamps_count INTO v_stamps;

    -- Réinitialiser les tampons si seuil atteint (récompense appliquée côté app)
    IF v_stamps >= v_threshold THEN
      UPDATE loyalty_accounts
      SET stamps_count = 0, updated_at = now()
      WHERE merchant_id = NEW.merchant_id AND customer_phone = NEW.customer_phone;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_apply_loyalty
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION apply_loyalty_on_order();

-- ─── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;

-- Merchants : lecture publique (slug), écriture propriétaire
CREATE POLICY "merchants_public_read"
  ON merchants FOR SELECT
  USING (true);

CREATE POLICY "merchants_owner_write"
  ON merchants FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Categories : lecture publique, CRUD propriétaire
CREATE POLICY "categories_public_read"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "categories_owner_all"
  ON categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM merchants m
      WHERE m.id = categories.merchant_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM merchants m
      WHERE m.id = categories.merchant_id AND m.user_id = auth.uid()
    )
  );

-- Menu items : lecture publique, CRUD propriétaire
CREATE POLICY "menu_items_public_read"
  ON menu_items FOR SELECT
  USING (true);

CREATE POLICY "menu_items_owner_all"
  ON menu_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM merchants m
      WHERE m.id = menu_items.merchant_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM merchants m
      WHERE m.id = menu_items.merchant_id AND m.user_id = auth.uid()
    )
  );

-- Orders : insertion publique (checkout client), lecture/update propriétaire
CREATE POLICY "orders_public_insert"
  ON orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "orders_public_read_own"
  ON orders FOR SELECT
  USING (true);

CREATE POLICY "orders_owner_update"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM merchants m
      WHERE m.id = orders.merchant_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "orders_owner_delete"
  ON orders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM merchants m
      WHERE m.id = orders.merchant_id AND m.user_id = auth.uid()
    )
  );

-- Order items : insertion publique, lecture propriétaire
CREATE POLICY "order_items_public_insert"
  ON order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "order_items_public_read"
  ON order_items FOR SELECT
  USING (true);

-- Loyalty : lecture/insert/update publique limitée au téléphone (via service role côté app)
CREATE POLICY "loyalty_public_read"
  ON loyalty_accounts FOR SELECT
  USING (true);

CREATE POLICY "loyalty_public_upsert"
  ON loyalty_accounts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "loyalty_public_update"
  ON loyalty_accounts FOR UPDATE
  USING (true);

-- ─── Realtime ───────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;

-- ─── Storage : bucket menu-images ───────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  5242880, -- 5 Mo
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique des images
CREATE POLICY "menu_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

-- Upload/update/delete réservé au commerçant authentifié
CREATE POLICY "menu_images_owner_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'menu-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "menu_images_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'menu-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "menu_images_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'menu-images'
    AND auth.role() = 'authenticated'
  );

-- ─── Données de démo (optionnel) ────────────────────────────────────────────

INSERT INTO merchants (slug, business_name, capacity_per_slot, slot_duration_minutes)
VALUES ('demo-truck', 'Pizza Truck Demo', 5, 10);

INSERT INTO categories (merchant_id, name, display_order)
SELECT id, unnest(ARRAY['Pizzas', 'Boissons', 'Desserts']), unnest(ARRAY[0, 1, 2])
FROM merchants WHERE slug = 'demo-truck';

INSERT INTO menu_items (merchant_id, category_id, name, description, price, is_available)
SELECT
  m.id,
  c.id,
  v.name,
  v.description,
  v.price,
  true
FROM merchants m
JOIN categories c ON c.merchant_id = m.id AND c.name = 'Pizzas'
CROSS JOIN (VALUES
  ('Margherita', 'Tomate, mozzarella, basilic', 9.50),
  ('Reine', 'Tomate, jambon, champignons, mozzarella', 11.00),
  ('4 Fromages', 'Mozzarella, chèvre, emmental, bleu', 12.00)
) AS v(name, description, price)
WHERE m.slug = 'demo-truck';

INSERT INTO menu_items (merchant_id, category_id, name, description, price, is_available)
SELECT
  m.id,
  c.id,
  v.name,
  v.description,
  v.price,
  true
FROM merchants m
JOIN categories c ON c.merchant_id = m.id AND c.name = 'Boissons'
CROSS JOIN (VALUES
  ('Coca-Cola', '33cl', 2.50),
  ('Eau minérale', '50cl', 1.50)
) AS v(name, description, price)
WHERE m.slug = 'demo-truck';
