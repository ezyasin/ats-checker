"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useAnalysisStore } from "@/store/analysis";
import { validateFileType } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface UploadZoneProps {
  className?: string;
}

export function UploadZone({ className }: UploadZoneProps) {
  const { cvFile, setCvFile, setError } = useAnalysisStore();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const validation = validateFileType(file);
      if (!validation.valid) {
        setError(validation.error!);
        return;
      }

      setCvFile(file);
    },
    [setCvFile, setError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "application/x-tex": [".tex"],
      "text/x-tex": [".tex"],
      "text/plain": [".tex"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  });

  return (
    <Card
      {...getRootProps()}
      className={cn(
        "relative flex h-full min-h-[320px] cursor-pointer items-center justify-center rounded-[24px] border-2 border-dashed bg-slate-50/70 p-8 text-center transition-all duration-200",
        isDragActive
          ? "border-primary bg-primary/5 shadow-[0_20px_45px_-30px_rgba(37,99,235,0.55)]"
          : cvFile
            ? "border-emerald-400 bg-emerald-50/80 shadow-[0_20px_45px_-30px_rgba(16,185,129,0.45)]"
            : "border-slate-300 hover:border-primary/60 hover:bg-primary/5 hover:shadow-[0_20px_45px_-32px_rgba(37,99,235,0.4)]",
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex max-w-sm flex-col items-center gap-4">
        <div className="rounded-full border border-white bg-white/90 p-4 shadow-sm">
          <svg
            className="h-8 w-8 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
        </div>

        {cvFile ? (
          <>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
              Ready for analysis
            </span>
            <p className="text-lg font-semibold text-emerald-700">
              {cvFile.name}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {(cvFile.size / 1024).toFixed(1)} KB. Click anywhere in this area or drop a new file to replace it.
            </p>
          </>
        ) : (
          <>
            <p className="text-xl font-semibold text-slate-900">
              {isDragActive
                ? "Drop your CV here..."
                : "Drag & drop your CV here"}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Supports PDF, DOCX, and TEX (max 5MB)
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              or click to browse from your computer
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
