import { sharedConfigured } from "@/lib/cache/shared";
import { eligibilitySummary } from "@/lib/providers/eligibility";
import { registry } from "@/lib/providers/registry";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({
    providers: registry(),
    rateLimitScope: sharedConfigured() ? "shared-redis" : "single-process",
    bigQueryVerification:
      "No real query certified by this build; inspect recorded job evidence before claiming readiness.",
    eligibility: eligibilitySummary(),
    checkedAt: new Date().toISOString(),
    note: "Health reflects observed requests in this server process. UNTESTED does not mean healthy.",
  });
}
