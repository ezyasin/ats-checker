import { parseCvMarkdown, type InlineSpan } from "@/lib/cvMarkdown";

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\^/g, "\\^{}")
    .replace(/~/g, "\\~{}");
}

function formatSpans(spans: InlineSpan[]): string {
  return spans
    .map((span) => (span.bold ? `\\textbf{${escapeLatex(span.text)}}` : escapeLatex(span.text)))
    .join("");
}

/**
 * Generate a clean, single-column LaTeX resume (.tex) from the improved CV's
 * markdown-like structure (the same headings/bullets the DOCX exporter parses).
 *
 * The first `# ` heading is rendered as a centered bold name title; subsequent
 * `# `/`## ` become `\section*`; `### ` becomes `\subsection*`; bullets
 * become an `itemize`; `**bold**` becomes `\textbf`. LaTeX special
 * characters are escaped in user content.
 */
export function generateLatex(improvedCv: string): string {
  const body: string[] = [];
  let inItemize = false;
  let nameEmitted = false;

  const closeItemize = () => {
    if (inItemize) {
      body.push("\\end{itemize}");
      inItemize = false;
    }
  };

  for (const block of parseCvMarkdown(improvedCv)) {
    if (block.type === "blank") {
      closeItemize();
      continue;
    }

    const content = formatSpans(block.spans);

    if (block.type === "heading") {
      closeItemize();
      if (block.level === 1 && !nameEmitted) {
        body.push(`\\begin{center}{\\Large \\textbf{${content}}}\\end{center}`);
        nameEmitted = true;
      } else if (block.level === 3) {
        body.push(`\\subsection*{${content}}`);
      } else {
        body.push(`\\section*{${content}}`);
      }
      continue;
    }

    if (block.type === "bullet") {
      if (!inItemize) {
        body.push("\\begin{itemize}");
        inItemize = true;
      }
      body.push(`  \\item ${content}`);
      continue;
    }

    closeItemize();
    body.push(content);
    body.push("");
  }

  closeItemize();

  const preamble = [
    "\\documentclass[11pt]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage[margin=0.7in]{geometry}",
    "\\usepackage[hidelinks]{hyperref}",
    "\\pagestyle{empty}",
    "\\setlength{\\parindent}{0pt}",
    "",
    "\\begin{document}",
    "",
  ].join("\n");

  return `${preamble}${body.join("\n")}\n\\end{document}\n`;
}
