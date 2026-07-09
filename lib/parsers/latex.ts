const CONTENT_COMMANDS = [
  "section", "subsection", "subsubsection", "paragraph", "subparagraph",
  "chapter", "textbf", "textit", "emph", "textsc", "underline", "texttt",
  "mathrm", "mathbf", "title", "author", "date", "footnote", "mbox", "text",
  "bf", "it", "rm", "tt", "sf", "sl", "ref", "cref", "label", "cite",
];

/**
 * Extract plain text from a LaTeX (.tex) CV source for ATS analysis.
 *
 * Handles the common resume macros by unwrapping brace arguments, stripping
 * comments, environment delimiters, and preamble commands, then decoding
 * literal escapes. Nested formatting is unwrapped over a few bounded passes.
 */
export async function extractTextFromLatex(
  buffer: ArrayBuffer
): Promise<string> {
  const raw = new TextDecoder("utf-8", { fatal: false }).decode(
    new Uint8Array(buffer)
  );
  let text = raw;

  // Remove comments: cut at the first unescaped % on each line.
  text = text.replace(/(^|[^\\])%.*/g, "$1");
  text = text.replace(/^%.*/gm, "");

  // Keep only the document body when \begin{document}...\end{document} is present.
  const bodyMatch = text.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  if (bodyMatch) {
    text = bodyMatch[1];
  }

  // Drop preamble-only commands that may remain outside the body.
  text = text.replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/g, "");
  text = text.replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\}/g, "");

  // \href{url}{text} -> text (two-argument command).
  text = text.replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1");

  // \begin{env} / \end{env} -> newlines.
  text = text.replace(/\\begin\{[^}]*\}(?:\[[^\]]*\])?/g, "\n");
  text = text.replace(/\\end\{[^}]*\}/g, "\n");

  // \item -> bullet marker.
  text = text.replace(/\\item(?:\[[^\]]*\])?\s*/g, "• ");

  // Ellipsis macros.
  text = text.replace(/\\(ldots|dots)/g, "…");

  // Iteratively unwrap nested content commands until stable (bounded).
  for (let i = 0; i < 5; i++) {
    const before = text;
    for (const cmd of CONTENT_COMMANDS) {
      const re = new RegExp(`\\\\${cmd}\\*?\\{([^}]*)\\}`, "g");
      text = text.replace(re, "$1");
    }
    // Unknown single-argument commands: \cmd{arg} -> arg.
    text = text.replace(/\\[a-zA-Z]+\*?\{([^}]*)\}/g, "$1");
    if (text === before) break;
  }

  // Standalone commands without arguments: \cmd -> "".
  text = text.replace(/\\[a-zA-Z]+\*?/g, "");

  // Line breaks: \\ and \\[length] -> newline.
  text = text.replace(/\\\\(?:\[[^\]]*\])?/g, "\n");

  // Dashes.
  text = text.replace(/---/g, "—");
  text = text.replace(/--/g, "–");

  // Math delimiters -> keep contents (remove only unescaped $, before
  // unescaping literal \$ so currency symbols survive).
  text = text.replace(/(?<!\\)\$/g, "");

  // Unescape literal symbols.
  text = text.replace(/\\%/g, "%");
  text = text.replace(/\\&/g, "&");
  text = text.replace(/\\\$/g, "$");
  text = text.replace(/\\#/g, "#");
  text = text.replace(/\\_/g, "_");
  text = text.replace(/\\\{/g, "{");
  text = text.replace(/\\\}/g, "}");

  // Spacing macros and ties.
  text = text.replace(/~/g, " ");
  text = text.replace(/\\,/g, " ");
  text = text.replace(/\\;/g, " ");
  text = text.replace(/\\:/g, " ");
  text = text.replace(/\\!/g, "");

  // Strip leftover braces.
  text = text.replace(/[{}]/g, "");

  // Normalize whitespace.
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
