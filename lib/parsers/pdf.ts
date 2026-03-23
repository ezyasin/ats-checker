import { extractText } from "unpdf";

export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer));
  const combined = Array.isArray(text) ? text.join("\n\n") : String(text);
  return combined.trim();
}
