// TundraVolt — "notify-bill" Supabase Edge Function
// Called by a Database Webhook when a new row is INSERTED into public.readings.
// Sends a push notification (and icon badge count) to every phone of that house.
//
// Secrets needed (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, WEBHOOK_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function periodLabel(d: string) {           // "2026-11-01" -> "Month of October – November 2026"
  const [y, m] = d.split("-").map(Number);
  const sm = m === 1 ? 12 : m - 1, sy = m === 1 ? y - 1 : y;
  return sy === y
    ? `Month of ${MONTHS[sm - 1]} – ${MONTHS[m - 1]} ${y}`
    : `Month of ${MONTHS[sm - 1]} ${sy} – ${MONTHS[m - 1]} ${y}`;
}
const peso = (n: number) =>
  "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

Deno.serve(async (req) => {
  // Only our own webhook may call this
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }

  const payload = await req.json().catch(() => null);
  const r = payload?.record;
  if (payload?.type !== "INSERT" || payload?.table !== "readings" || !r?.house_id) {
    return new Response("ignored", { status: 200 });
  }

  // House name + how many unpaid bills (= number on the icon badge)
  const [{ data: house }, { count: unpaid }] = await Promise.all([
    sb.from("houses").select("name").eq("id", r.house_id).maybeSingle(),
    sb.from("readings").select("id", { count: "exact", head: true }).eq("house_id", r.house_id).eq("is_paid", false),
  ]);

  // Everyone linked to this house -> their phones
  const { data: people } = await sb.from("profiles").select("id").eq("house_id", r.house_id);
  const ids = (people ?? []).map((p) => p.id);
  if (!ids.length) return new Response("no accounts for house", { status: 200 });
  const { data: subs } = await sb.from("push_subscriptions").select("*").in("user_id", ids);

  const kwh = Number(r.current_reading) - Number(r.previous_reading);
  const message = JSON.stringify({
    title: "⚡ TundraVolt — New bill",
    body: `${house?.name ?? "Your house"} · ${periodLabel(r.billing_month)}\n${peso(kwh * Number(r.rate))} (${kwh.toFixed(2)} kWh)`,
    badge: unpaid ?? 1,
    tag: `bill-${r.id}`,
    url: "/",
  });

  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message);
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {            // phone unsubscribed / app removed
        await sb.from("push_subscriptions").delete().eq("id", s.id);
      } else {
        console.error("push failed", code, (err as Error).message);
      }
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
