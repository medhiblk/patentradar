export const SOURCE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.step,.stp,.stl,.json";
export const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
export function sourceFileError(
  file: Pick<File, "name" | "size"> & { type?: string },
): string | undefined {
  if (!file.size)
    return "This file is empty. Select the original PDF or drawing.";
  if (file.size > MAX_SOURCE_BYTES)
    return "Source files must be smaller than 4 MB.";
  if (
    !/\.(pdf|png|jpe?g|step|stp|stl|json)$/i.test(file.name) &&
    file.type !== "application/pdf"
  )
    return "Choose a PDF, PNG/JPEG drawing, STEP/STL model or editable JSON parameters.";
}
export const isPdfSource = (file: { name: string; type: string }) =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name);
