import { requireUser } from "@/lib/platform/auth";
import { guard } from "@/lib/security";
import {
  saveAttachment,
  listAttachments,
  AttachmentError,
  attachmentFailure,
  attachmentForm,
} from "@/lib/platform/attachments";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(req: Request) {
  try {
    guard(req, "attachments-read", 60);
    const u = await requireUser(req);
    const id = new URL(req.url).searchParams.get("projectId") || "";
    return Response.json(await listAttachments(u.id, id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return attachmentFailure(e);
  }
}
export async function POST(req: Request) {
  try {
    guard(req, "attachments-write", 20);
    const u = await requireUser(req);
    const f = await attachmentForm(req),
      file = f.get("file");
    if (!(file instanceof File))
      throw new AttachmentError(400, "Choose a file.");
    return Response.json(
      {
        file: await saveAttachment(
          u.id,
          String(f.get("projectId") || ""),
          file,
        ),
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return attachmentFailure(e);
  }
}
