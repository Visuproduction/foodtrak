-- FoodTrak — Schéma isolé (évite conflit avec tables Komback existantes)
CREATE SCHEMA IF NOT EXISTS foodtrak;

CREATE TYPE foodtrak.order_status AS ENUM (
  'received', 'preparing', 'ready', 'picked_up', 'cancelled'
);

CREATE TABLE foodtrak.merchants (
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

CREATE TABLE foodtrak.categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID NOT NULL REFERENCES foodtrak.merchants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE foodtrak.menu_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID NOT NULL REFERENCES foodtrak.merchants(id) ON DELETE CASCADE,
  category_id   UUID NOT NULL REFERENCES foodtrak.categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  image_url     TEXT,
  is_available  BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE foodtrak.orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id          UUID NOT NULL REFERENCES foodtrak.merchants(id) ON DELETE CASCADE,
  customer_first_name  TEXT NOT NULL,
  customer_phone       TEXT NOT NULL,
  status               foodtrak.order_status NOT NULL DEFAULT 'received',
  pickup_time          TIMESTAMPTZ NOT NULL,
  total_price          NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
  loyalty_opt_in       BOOLEAN NOT NULL DEFAULT false,
  loyalty_stamps_used  INTEGER NOT NULL DEFAULT 0,
  loyalty_discount     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE foodtrak.order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES foodtrak.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES foodtrak.menu_items(id) ON DELETE RESTRICT,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE foodtrak.loyalty_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id    UUID NOT NULL REFERENCES foodtrak.merchants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  stamps_count   INTEGER NOT NULL DEFAULT 0 CHECK (stamps_count >= 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, customer_phone)
);

CREATE INDEX idx_ft_merchants_slug ON foodtrak.merchants(slug);
CREATE INDEX idx_ft_orders_merchant_status ON foodtrak.orders(merchant_id, status, pickup_time);
CREATE INDEX idx_ft_menu_items_merchant ON foodtrak.menu_items(merchant_id, is_available);

CREATE OR REPLACE FUNCTION foodtrak.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ft_merchants_updated_at
  BEFORE UPDATE ON foodtrak.merchants
  FOR EACH ROW EXECUTE FUNCTION foodtrak.set_updated_at();

CREATE TRIGGER trg_ft_menu_items_updated_at
  BEFORE UPDATE ON foodtrak.menu_items
  FOR EACH ROW EXECUTE FUNCTION foodtrak.set_updated_at();

CREATE TRIGGER trg_ft_orders_updated_at
  BEFORE UPDATE ON foodtrak.orders
  FOR EACH ROW EXECUTE FUNCTION foodtrak.set_updated_at();

CREATE OR REPLACE FUNCTION foodtrak.purge_non_opt_in_customer_data()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE foodtrak.orders
  SET customer_first_name = 'Anonyme', customer_phone = '0000000000'
  WHERE loyalty_opt_in = false
    AND created_at < now() - INTERVAL '24 hours'
    AND customer_phone <> '0000000000';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION foodtrak.apply_loyalty_on_order()
RETURNS TRIGGER AS $$
DECLARE
  v_threshold INTEGER;
  v_stamps    INTEGER;
BEGIN
  IF NEW.loyalty_opt_in = true THEN
    SELECT loyalty_reward_threshold INTO v_threshold
    FROM foodtrak.merchants WHERE id = NEW.merchant_id;

    INSERT INTO foodtrak.loyalty_accounts (merchant_id, customer_phone, stamps_count)
    VALUES (NEW.merchant_id, NEW.customer_phone, 1)
    ON CONFLICT (merchant_id, customer_phone)
    DO UPDATE SET stamps_count = foodtrak.loyalty_accounts.stamps_count + 1, updated_at = now()
    RETURNING stamps_count INTO v_stamps;

    IF v_stamps >= v_threshold THEN
      UPDATE foodtrak.loyalty_accounts
      SET stamps_count = 0, updated_at = now()
      WHERE merchant_id = NEW.merchant_id AND customer_phone = NEW.customer_phone;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_ft_apply_loyalty
  AFTER INSERT ON foodtrak.orders
  FOR EACH ROW EXECUTE FUNCTION foodtrak.apply_loyalty_on_order();

-- Permissions
GRANT USAGE ON SCHEMA foodtrak TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA foodtrak TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA foodtrak TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA foodtrak GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- RLS
ALTER TABLE foodtrak.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtrak.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtrak.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtrak.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtrak.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtrak.loyalty_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ft_merchants_public_read" ON foodtrak.merchants FOR SELECT USING (true);
CREATE POLICY "ft_merchants_owner_write" ON foodtrak.merchants FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ft_categories_public_read" ON foodtrak.categories FOR SELECT USING (true);
CREATE POLICY "ft_categories_owner_all" ON foodtrak.categories FOR ALL
  USING (EXISTS (SELECT 1 FROM foodtrak.merchants m WHERE m.id = categories.merchant_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM foodtrak.merchants m WHERE m.id = categories.merchant_id AND m.user_id = auth.uid()));

CREATE POLICY "ft_menu_items_public_read" ON foodtrak.menu_items FOR SELECT USING (true);
CREATE POLICY "ft_menu_items_owner_all" ON foodtrak.menu_items FOR ALL
  USING (EXISTS (SELECT 1 FROM foodtrak.merchants m WHERE m.id = menu_items.merchant_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM foodtrak.merchants m WHERE m.id = menu_items.merchant_id AND m.user_id = auth.uid()));

CREATE POLICY "ft_orders_public_insert" ON foodtrak.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "ft_orders_public_read" ON foodtrak.orders FOR SELECT USING (true);
CREATE POLICY "ft_orders_owner_update" ON foodtrak.orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM foodtrak.merchants m WHERE m.id = orders.merchant_id AND m.user_id = auth.uid()));
CREATE POLICY "ft_orders_owner_delete" ON foodtrak.orders FOR DELETE
  USING (EXISTS (SELECT 1 FROM foodtrak.merchants m WHERE m.id = orders.merchant_id AND m.user_id = auth.uid()));

CREATE POLICY "ft_order_items_public_insert" ON foodtrak.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "ft_order_items_public_read" ON foodtrak.order_items FOR SELECT USING (true);

CREATE POLICY "ft_loyalty_public_read" ON foodtrak.loyalty_accounts FOR SELECT USING (true);
CREATE POLICY "ft_loyalty_public_insert" ON foodtrak.loyalty_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "ft_loyalty_public_update" ON foodtrak.loyalty_accounts FOR UPDATE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE foodtrak.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE foodtrak.menu_items;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menu-images', 'menu-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ft_menu_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');
CREATE POLICY "ft_menu_images_owner_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-images' AND auth.role() = 'authenticated');
CREATE POLICY "ft_menu_images_owner_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'menu-images' AND auth.role() = 'authenticated');
CREATE POLICY "ft_menu_images_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'menu-images' AND auth.role() = 'authenticated');

-- Données démo
INSERT INTO foodtrak.merchants (slug, business_name, capacity_per_slot, slot_duration_minutes)
VALUES ('demo-truck', 'Pizza Truck Demo', 5, 10)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO foodtrak.categories (merchant_id, name, display_order)
SELECT m.id, cat.name, cat.display_order
FROM foodtrak.merchants m
CROSS JOIN (VALUES ('Pizzas', 0), ('Boissons', 1), ('Desserts', 2)) AS cat(name, display_order)
WHERE m.slug = 'demo-truck'
AND NOT EXISTS (
  SELECT 1 FROM foodtrak.categories c WHERE c.merchant_id = m.id AND c.name = cat.name
);

INSERT INTO foodtrak.menu_items (merchant_id, category_id, name, description, price, is_available)
SELECT m.id, c.id, v.name, v.description, v.price, true
FROM foodtrak.merchants m
JOIN foodtrak.categories c ON c.merchant_id = m.id AND c.name = 'Pizzas'
CROSS JOIN (VALUES
  ('Margherita', 'Tomate, mozzarella, basilic', 9.50),
  ('Reine', 'Tomate, jambon, champignons, mozzarella', 11.00),
  ('4 Fromages', 'Mozzarella, chèvre, emmental, bleu', 12.00)
) AS v(name, description, price)
WHERE m.slug = 'demo-truck'
AND NOT EXISTS (SELECT 1 FROM foodtrak.menu_items mi WHERE mi.merchant_id = m.id AND mi.name = v.name);

INSERT INTO foodtrak.menu_items (merchant_id, category_id, name, description, price, is_available)
SELECT m.id, c.id, v.name, v.description, v.price, true
FROM foodtrak.merchants m
JOIN foodtrak.categories c ON c.merchant_id = m.id AND c.name = 'Boissons'
CROSS JOIN (VALUES
  ('Coca-Cola', '33cl', 2.50),
  ('Eau minérale', '50cl', 1.50)
) AS v(name, description, price)
WHERE m.slug = 'demo-truck'
AND NOT EXISTS (SELECT 1 FROM foodtrak.menu_items mi WHERE mi.merchant_id = m.id AND mi.name = v.name);
