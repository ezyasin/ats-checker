'use client';

import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Copy, Download, FileCode, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { cvToPlainText } from "@/lib/cvMarkdown";

interface ATSOptimizedExportProps {
  improvedCv: string;
  onExport?: (format: "docx" | "txt" | "tex") => void;
}

export function ATSOptimizedExport({ improvedCv, onExport }: ATSOptimizedExportProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const [insecureOriginLabel] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const { protocol, host, hostname } = window.location;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

    if (protocol !== "https:" && !isLocalhost) {
      return host;
    }

    return null;
  });

  useEffect(() => {
    if (copyStatus === "idle") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setCopyStatus("idle"), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  async function copyWithFallback(text: string) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!copied) {
      throw new Error("Copy failed");
    }
  }

  const handleCopyToClipboard = async () => {
    try {
      await copyWithFallback(cvToPlainText(improvedCv));
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  };

  const handleExport = (format: "docx" | "txt" | "tex") => {
    onExport?.(format);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => handleExport("docx")}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          Download DOCX
        </Button>
        <Button variant="outline" onClick={() => handleExport("tex")}>
          <FileCode className="h-4 w-4" aria-hidden="true" />
          LaTeX (.tex)
        </Button>
        <Button variant="outline" onClick={() => handleExport("txt")}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Plain text
        </Button>
        <Button variant="outline" onClick={handleCopyToClipboard}>
          {copyStatus === "success" ? (
            <CheckCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copyStatus === "success" ? "Copied" : copyStatus === "error" ? "Copy failed" : "Copy text"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        DOCX for uploads, plain text for forms that ask you to paste your CV, LaTeX if you edit in Overleaf. All three
        are single-column with standard headings, the layout ATS parsers read best.
      </p>

      {insecureOriginLabel && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>
            Chrome may block downloads on insecure HTTP addresses like <strong>{insecureOriginLabel}</strong>. If that
            happens, open the app on <strong>localhost</strong> or HTTPS, or copy the text instead.
          </p>
        </div>
      )}
      {copyStatus === "error" && (
        <p className="text-xs text-amber-700">
          Clipboard access is blocked here. Use localhost or HTTPS for one-click copy, or select the text in the preview.
        </p>
      )}
    </div>
  );
}
