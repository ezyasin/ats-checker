import { parseInline } from "@/lib/cvMarkdown";
import { parseCv, splitLabel, type CvEntry } from "@/lib/cvModel";

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
    .replace(/~/g, "\\~{}")
    .replace(/\|/g, "\\textbar{}");
}

function inline(text: string): string {
  return parseInline(text)
    .map((span) => (span.bold ? `\\textbf{${escapeLatex(span.text)}}` : escapeLatex(span.text)))
    .join("");
}

function itemize(lines: string[]): string[] {
  if (lines.length === 0) return [];
  return ["\\begin{itemize}", ...lines.map((line) => `  \\item ${inline(line)}`), "\\end{itemize}"];
}

function entry(item: CvEntry): string[] {
  const place = [item.organization, item.location].filter(Boolean).join(", ");
  // A certificate or award ("Title, Issuer   2023") fits on one line.
  if (item.bullets.length === 0 && item.details.length === 0 && !item.location) {
    const issuer = item.organization ? `, \\textit{${escapeLatex(item.organization)}}` : "";
    return [`\\par\\textbf{${escapeLatex(item.title)}}${issuer}\\hfill ${escapeLatex(item.dates)}\\par`];
  }
  const lines = [`\\cventry{${escapeLatex(item.title)}}{${escapeLatex(item.dates)}}{${escapeLatex(place)}}`];
  lines.push(...item.details.map((detail) => `${inline(detail)}\\par`));
  lines.push(...itemize(item.bullets));
  return lines;
}

/**
 * A single-column LaTeX CV (.tex) for Overleaf or a local TeX install: name
 * and contact line centred, ruled section headings, and each entry with its
 * title and dates on one line. Uses only packages every TeX distribution has.
 */
export function generateLatex(improvedCv: string): string {
  const cv = parseCv(improvedCv);
  const body: string[] = ["\\begin{center}"];
  if (cv.name) body.push(`  {\\LARGE\\bfseries ${escapeLatex(cv.name)}}\\\\[2pt]`);
  if (cv.headline) body.push(`  {\\large ${escapeLatex(cv.headline)}}\\\\[2pt]`);
  if (cv.contact.length > 0) body.push(`  {\\small ${cv.contact.map(escapeLatex).join(" \\enspace\\textbar\\enspace ")}}`);
  body.push("\\end{center}", "");

  for (const section of cv.sections) {
    body.push(`\\section*{${escapeLatex(section.heading)}}`);
    // Blocks in order; a run of items is one list, or "Label:" lines if every item has a label.
    let items: string[] = [];
    const flush = () => {
      if (items.every((item) => splitLabel(item))) {
        body.push(
          ...items.map((item) => {
            const [label, value] = splitLabel(item)!;
            return `\\textbf{${escapeLatex(label)}:} ${inline(value)}\\par`;
          })
        );
      } else if (items.length === 1) {
        body.push(`${inline(items[0])}\\par`);
      } else {
        body.push(...itemize(items));
      }
      items = [];
    };
    for (const block of section.blocks) {
      if (block.type === "item") {
        items.push(block.text);
        continue;
      }
      flush();
      if (block.type === "paragraph") body.push(`${inline(block.text)}\\par`);
      else body.push(...entry(block.entry));
    }
    flush();
    body.push("");
  }

  const preamble = [
    "% Compiles with pdfLaTeX (Overleaf's default). For non-Latin scripts, switch the",
    "% compiler to XeLaTeX and replace inputenc and fontenc with \\usepackage{fontspec}.",
    "\\documentclass[11pt]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{lmodern}",
    "\\usepackage[a4paper,margin=0.7in]{geometry}",
    "\\usepackage{enumitem}",
    "\\usepackage{titlesec}",
    "\\usepackage[hidelinks]{hyperref}",
    "\\pagestyle{empty}",
    "\\setlength{\\parindent}{0pt}",
    "\\setlength{\\parskip}{2pt}",
    "\\setlist[itemize]{leftmargin=1.3em,itemsep=1pt,topsep=2pt,parsep=0pt}",
    "\\titleformat{\\section}{\\large\\bfseries}{}{0em}{\\MakeUppercase}[\\titlerule]",
    "\\titlespacing*{\\section}{0pt}{10pt}{5pt}",
    "% \\cventry{title}{dates}{organization, location}",
    "\\newcommand{\\cventry}[3]{\\par\\smallskip\\textbf{#1}\\hfill #2\\par\\if\\relax\\detokenize{#3}\\relax\\else{\\itshape #3}\\par\\fi}",
    "",
    "\\begin{document}",
    "",
  ].join("\n");

  return `${preamble}${body.join("\n")}\n\\end{document}\n`;
}
