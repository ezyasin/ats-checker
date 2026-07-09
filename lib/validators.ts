const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF
const DOCX_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04]; // PK (ZIP)

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "5242880", 10); // 5MB

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-tex",
  "text/x-tex",
];

const LATEX_EXTENSIONS = [".tex", ".ltx"];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  fileType?: "pdf" | "docx" | "latex";
}

export function validateFileType(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    };
  }

  const lowerName = file.name.toLowerCase();
  const isTexByName = LATEX_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const isTexMime =
    file.type === "application/x-tex" || file.type === "text/x-tex";

  // Browsers often report .tex files as application/octet-stream or text/plain,
  // so accept by extension as a fallback.
  if (isTexMime || isTexByName) {
    return { valid: true, fileType: "latex" };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Please upload a PDF, DOCX, or TEX (.tex) file.",
    };
  }

  const fileType = file.type === "application/pdf" ? "pdf" : "docx";
  return { valid: true, fileType };
}

export async function validateFileBytes(
  buffer: ArrayBuffer
): Promise<ValidationResult> {
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 4) {
    return { valid: false, error: "File is too small to be a valid document." };
  }

  const isPdf = PDF_MAGIC_BYTES.every((byte, i) => bytes[i] === byte);
  if (isPdf) return { valid: true, fileType: "pdf" };

  const isDocx = DOCX_MAGIC_BYTES.every((byte, i) => bytes[i] === byte);
  if (isDocx) return { valid: true, fileType: "docx" };

  // LaTeX source is plain text; detect by signature commands in the head.
  const head = new TextDecoder("utf-8", { fatal: false }).decode(
    bytes.slice(0, Math.min(bytes.length, 4096))
  );
  if (/\\documentclass\b/.test(head) || /\\begin\{document\}/.test(head)) {
    return { valid: true, fileType: "latex" };
  }

  return {
    valid: false,
    error: "File content does not match a valid PDF, DOCX, or TEX format.",
  };
}

export function validateJobDescription(text: string): ValidationResult {
  const trimmed = text.trim();
  if (trimmed.length < 50) {
    return {
      valid: false,
      error: "Job description is too short. Please provide at least 50 characters.",
    };
  }
  if (trimmed.length > 15000) {
    return {
      valid: false,
      error: "Job description is too long. Maximum 15,000 characters.",
    };
  }
  return { valid: true };
}
