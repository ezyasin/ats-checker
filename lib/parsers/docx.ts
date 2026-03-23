import mammoth from "mammoth";

export async function extractTextFromDocx(
  buffer: ArrayBuffer
): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value.trim();
}
