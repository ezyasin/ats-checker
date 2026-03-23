const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF
const DOCX_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04]; // PK (ZIP)

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "5242880", 10); // 5MB

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  fileType?: "pdf" | "docx";
}

export function validateFileType(file: File): ValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Please upload a PDF or DOCX file.",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
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

  return {
    valid: false,
    error: "File content does not match a valid PDF or DOCX format.",
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
