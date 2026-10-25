import { ReportSchema } from "@/lib/model";
import { createReport } from "@/lib/report";
import { guard, failure } from "@/lib/security";
export async function POST(req: Request) {
  try {
    guard(req);
    const data = ReportSchema.parse(await req.json());
    return new Response(Buffer.from(await createReport(data)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="patentradar-report.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
