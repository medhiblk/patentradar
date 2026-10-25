
import { guard, failure } from "@/lib/security";
import { extractProfile } from "@/lib/extract";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req);
    const form = await req.formData();
    const file = form.get("file");
    let text = String(form.get("text") || "").slice(0, 60000);
    if (file instanceof File && file.size) {
      if (file.size > 4 * 1024 * 1024) throw new Error("PDF exceeds 4 MB");
      if (
        file.type !== "application/pdf" ||
        !file.name.toLowerCase().endsWith(".pdf")
      )
        throw new Error("PDF files only");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (Buffer.from(bytes.slice(0, 5)).toString() !== "%PDF-")
        throw new Error("Invalid PDF signature");
      const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
      const task=pdfjs.getDocument({data:bytes,useSystemFonts:true,isEvalSupported:false});
      const document=await task.promise;
      try{
        if(document.numPages>80)throw new Error('PDF exceeds 80 pages');
        const pages:string[]=[];
        for(let i=1;i<=document.numPages;i++){const content=await (await document.getPage(i)).getTextContent();pages.push(content.items.map(item=>'str' in item?item.str:'').join(' '));if(pages.join(' ').length>60000)break;}
        text=pages.join('\n').slice(0,60000);
      }finally{await document.destroy();}
    }
    const context=String(form.get('context')||'').slice(0,5000).trim();
    if(context)text=(text+'\n'+context).slice(0,60000);
    if (text.trim().length < 30)
      throw new Error("No extractable text; scanned PDFs need OCR.");
    return Response.json({
      ...(await extractProfile(text, form.get("consent") === "true")),
      characters: text.length,
    });
  } catch (e) {
    return failure(e);
  }
}
