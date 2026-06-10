import { NextResponse } from "next/server";
import { admin } from "@/lib/db";

export const dynamic = "force-dynamic";

// Pinged daily by Vercel Cron (see vercel.json) so the free Supabase
// project registers activity and doesn't get paused after 7 idle days.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { error } = await admin
    .from("sessions")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
