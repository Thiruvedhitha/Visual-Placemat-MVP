import mammoth from "mammoth";

/** Extract plain text from a .docx Buffer using mammoth. */
export async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
