import { requireUser } from "@/lib/platform/auth";
import { guard } from "@/lib/security";
import {
  downloadAttachment,
  deleteAttachment,
  attachmentFailure,
} from "@/lib/platform/attachments";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, context: Context) {
  try {
    guard(req, "attachments-read", 60);
    const u = await requireUser(req),
      { id } = await context.params,
      project = new URL(req.url).searchParams.get("projectId") || "";
    const { item, body } = await downloadAttachment(u.id, project, id);
    return new Response(body, {
      headers: {
        "Content-Type": item.contentType,
        "Content-Length": String(item.size),
        "Content-Disposition": `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(item.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Attachment-Name": encodeURIComponent(item.name),
        "X-Content-SHA256": item.sha256,
      },
    });
  } catch (e) {
    return attachmentFailure(e);
  }
}
export async function DELETE(req: Request, context: Context) {
  try {
    guard(req, "attachments-write", 20);
    const u = await requireUser(req),
      { id } = await context.params,
      project = new URL(req.url).searchParams.get("projectId") || "";
    await deleteAttachment(u.id, project, id);
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return attachmentFailure(e);
  }
}
