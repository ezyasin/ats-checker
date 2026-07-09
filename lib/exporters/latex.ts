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

function formatInline(text: string): string {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .map((part) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        return `\\textbf{${escapeLatex(part.slice(2, -2))}}`;
      }
      return escapeLatex(part);
    })
    .join("");
}

/**
 * Generate a clean, single-column LaTeX resume (.tex) from the improved CV's
 * markdown-like structure (the same headings/bullets the DOCX exporter parses).
 *
 * The first `# ` heading is rendered as a centered bold name title; subsequent
 * `# `/`## ` become `\section*`; `### ` becomes `\subsection*`; `- `/`* ` list
 * items become an `itemize`; `**bold**` becomes `\textbf`. LaTeX special
 * characters are escaped in user content.
 */
export function generateLatex(improvedCv: string): string {
  const lines = improvedCv.split("\n");
  const body: string[] = [];
  let inItemize = false;
  let nameEmitted = false;

  const closeItemize = () => {
    if (inItemize) {
      body.push("\\end{itemize}");
      inItemize = false;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      closeItemize();
      continue;
    }

    if (trimmed.startsWith("# ")) {
      closeItemize();
      const content = trimmed.slice(2);
      if (!nameEmitted) {
        body.push(
          `\\begin{center}{\\Large \\textbf{${formatInline(content)}}}\\end{center}`
        );
        nameEmitted = true;
      } else {
        body.push(`\\section*{${formatInline(content)}}`);
      }
      continue;
    }

    if (trimmed.startsWith("## ")) {
      closeItemize();
      body.push(`\\section*{${formatInline(trimmed.slice(3))}}`);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      closeItemize();
      body.push(`\\subsection*{${formatInline(trimmed.slice(4))}}`);
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inItemize) {
        body.push("\\begin{itemize}");
        inItemize = true;
      }
      body.push(`  \\item ${formatInline(trimmed.slice(2))}`);
      continue;
    }

    closeItemize();
    body.push(formatInline(trimmed));
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
