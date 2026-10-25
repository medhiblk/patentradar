import { z } from "zod";
import { requireUser } from "@/lib/platform/auth";
import { listItems, getItem, mutateItem } from "@/lib/platform/store";
import { Conflict } from "@/lib/platform/private-store";
import { savedAlerts } from "@/lib/intelligence/alerts";
import { guard } from "@/lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    guard(req, "project-alerts-read", 60);
    const account = await requireUser(req);
    const items = await listItems(account.id);
    const all = items
      .filter((item) => ["project", "watch"].includes(item.kind))
      .flatMap((item) =>
        savedAlerts(item.data).map((alert) => ({
          ...alert,
          projectId: item.id,
          projectTitle: item.title,
        })),
      );
    const alerts = all
      .slice(0, 100)
      .map((alert) => ({
        ...alert,
        matches: alert.matches
          .slice(0, 3)
          .map((match) => ({
            ...match,
            excerpt: match.excerpt.slice(0, 650),
            ...(match.start !== undefined ? { end: match.start + Math.min(match.excerpt.length, 650) } : {}),
          })),
      }));
    return Response.json(
      {
        alerts,
        unread: all.filter((alert) => !alert.acknowledged).length,
        total: all.length,
        limit: 100,
        updatedBy:
          "Research and watch checks run when requested; no scheduled email delivery is implied.",
      },
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    guard(req, "project-alerts-write", 20);
    const account = await requireUser(req);
    const input = z
      .object({
        projectId: z.uuid(),
        alertId: z.string().min(1).max(100),
        acknowledged: z.boolean(),
      })
      .strict()
      .parse(await req.json());
    const item = await getItem(account.id, input.projectId);
    if (!item || !["project", "watch"].includes(item.kind))
      return Response.json(
        { error: "Project not found." },
        { status: 404, headers },
      );
    const alerts = savedAlerts(item.data);
    if (!alerts.some((alert) => alert.id === input.alertId))
      return Response.json(
        { error: "Alert not found." },
        { status: 404, headers },
      );
    await mutateItem(account.id, input.projectId, (current) => {
      const latest = savedAlerts(current.data);
      if (!latest.some((alert) => alert.id === input.alertId))
        throw new Conflict("Alert evidence changed; refresh before reviewing it.");
      return {
        ...current,
        updated: new Date().toISOString(),
        data: {
          ...current.data,
          similarityAlerts: latest.map((alert) =>
            alert.id === input.alertId
              ? { ...alert, acknowledged: input.acknowledged }
              : alert,
          ),
        },
      };
    });
    return Response.json({ ok: true }, { headers });
  } catch (e) {
    return failure(e);
  }
}
function failure(e: unknown) {
  const message = e instanceof Error ? e.message : "";
  const status = message.startsWith("Sign in")
    ? 401
    : e instanceof Conflict ? 409
    : message.includes("Rate limit")
      ? 429
      : e instanceof z.ZodError
        ? 400
        : 503;
  return Response.json(
    {
      error:
        status === 401
          ? "Sign in to see your private patent alerts."
          : status === 409 ? "Alert evidence changed. Reload the saved alerts and retry."
          : status === 429
            ? "Too many requests. Wait one minute and retry."
            : status === 400
              ? "Check the alert details."
              : "Private alerts are temporarily unavailable.",
    },
    { status, headers },
  );
}
