'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Copy, CheckCircle, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { cvToPlainText } from "@/lib/cvMarkdown";

interface ExportOption {
  id: "docx" | "txt" | "tex";
  name: string;
  description: string;
  icon: string;
  recommended?: boolean;
}

interface ATSOptimizedExportProps {
  improvedCv: string;
  onExport?: (format: "docx" | "txt" | "tex") => void;
}

const exportOptions: ExportOption[] = [
  {
    id: "docx",
    name: "DOCX (ATS-Ready)",
    description: "Word format with clean structure for uploads that expect a resume file",
    icon: "📝",
    recommended: true,
  },
  {
    id: "tex",
    name: "LaTeX (.tex)",
    description: "Clean single-column LaTeX source you can compile with Overleaf or a local TeX install",
    icon: "📄",
  },
  {
    id: "txt",
    name: "Plain Text",
    description: "Text-only version for copy-paste application forms",
    icon: "✍️",
  },
];

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            Download Your Optimized Resume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Choose an export that the app can generate reliably. DOCX is the default for uploads, and plain text is best when a form asks you to paste your resume.
          </p>

          {insecureOriginLabel && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  Chrome may block generated file downloads on insecure HTTP addresses like <strong>{insecureOriginLabel}</strong>. If that happens, open the app on <strong>localhost</strong> or HTTPS, or use the copy option below.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exportOptions.map((option) => (
              <div
                key={option.id}
                className={`p-4 border rounded-lg transition-all cursor-pointer ${
                  option.recommended
                    ? "border-green-300 bg-green-50 hover:border-green-400 hover:shadow-md"
                    : "border-gray-300 bg-white hover:border-gray-400 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">{option.icon}</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">{option.name}</h4>
                      <p className="text-xs text-gray-600">{option.description}</p>
                    </div>
                  </div>
                  {option.recommended && (
                    <Badge className="bg-green-100 text-green-700 border-green-300">
                      Recommended
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => handleExport(option.id)}
                  variant={option.recommended ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                >
                  Download
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Copy to Clipboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-blue-600" />
            Copy to Clipboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Copy your optimized resume text to paste directly into online application forms.
          </p>
          <Button
            onClick={handleCopyToClipboard}
            variant={copyStatus === "success" ? "default" : "outline"}
            className="w-full"
          >
            {copyStatus === "success" ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Copied to Clipboard!
              </>
            ) : copyStatus === "error" ? (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Copy failed in this browser context
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Text to Clipboard
              </>
            )}
          </Button>
          {copyStatus === "error" && (
            <p className="mt-2 text-xs text-amber-700">
              Browser clipboard access is unavailable here. Use localhost or HTTPS if you want one-click copy, or copy from the preview tab.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Export Guidelines */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            How to Use Your Optimized Resume
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-900">For Online Applications:</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Use <strong>DOCX</strong> when the application asks for a resume upload</li>
              <li>• Keep formatting simple so headings and bullets stay parseable</li>
              <li>• Re-run the analysis if you tailor the resume for a different role</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-900">For Copy-Paste Applications:</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Use <strong>Plain Text</strong> for portals that ask you to paste your resume</li>
              <li>• Copy text directly into online forms</li>
              <li>• No formatting will be lost in translation</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-900">For Email Submissions:</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Prefer <strong>DOCX</strong> format for best compatibility</li>
              <li>• Ensure the file is named descriptively (for example, FirstName_LastName_Resume)</li>
              <li>• Send as attachment, not in email body</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
