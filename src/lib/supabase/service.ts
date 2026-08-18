import { createClient } from "@supabase/supabase-js";

/** Client service role — usage serveur uniquement (cron, ops admin) */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
