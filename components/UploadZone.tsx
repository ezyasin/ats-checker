"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useAnalysisStore } from "@/store/analysis";
import { validateFileType } from "@/lib/validators";
import { Card } from "@/components/ui/card";

export function UploadZone() {
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
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  });

  return (
    <Card
      {...getRootProps()}
      className={`relative cursor-pointer border-2 border-dashed p-8 text-center transition-colors ${
        isDragActive
          ? "border-primary bg-primary/5"
          : cvFile
            ? "border-green-500 bg-green-500/5"
            : "border-muted-foreground/25 hover:border-primary/50"
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-full bg-primary/10 p-4">
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
            <p className="text-sm font-medium text-green-600">
              {cvFile.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {(cvFile.size / 1024).toFixed(1)} KB — Click or drop to replace
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">
              {isDragActive
                ? "Drop your CV here..."
                : "Drag & drop your CV here"}
            </p>
            <p className="text-xs text-muted-foreground">
              Supports PDF and DOCX (max 5MB)
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
