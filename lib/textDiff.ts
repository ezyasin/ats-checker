import { normalizeText } from "./scoring/sections";

export interface DiffPart {
  type: "same" | "added" | "removed";
  text: string;
}

const MONTHS: Record<string, string> = {
  january: "jan", february: "feb", march: "mar", april: "apr", june: "jun", july: "jul",
  august: "aug", september: "sep", sept: "sep", october: "oct", november: "nov", december: "dec",
};

// Past this many word pairs the table gets too big for a browser tab.
const MAX_CELLS = 6_000_000;

/** A word as a reader compares it: case, punctuation and month spelling don't count. */
function wordKey(word: string): string {
  const key = normalizeText(word).replace(/[^\p{L}\p{N}+#]/gu, "");
  return MONTHS[key] ?? key;
}

interface Token {
  text: string;
  key: string;
}

function tokenize(text: string): Token[] {
  return (text.match(/\S+|\s+/g) ?? []).map((part) => ({ text: part, key: /\S/.test(part) ? wordKey(part) : "" }));
}

/**
 * Word-level diff of `before` into `after`, keeping `after`'s line breaks.
 * Changes that only differ in case or punctuation ("BACKEND" -> "Backend",
 * "Sep." -> "Sep") count as unchanged, so what's left is real rewording.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const old = tokenize(before).filter((token) => token.key);
  const next = tokenize(after);
  // Indexes into `next` of the tokens that take part in matching.
  const words = next.flatMap((token, index) => (token.key ? [index] : []));

  const n = old.length;
  const m = words.length;
  if (n * m > MAX_CELLS) {
    return [
      { type: "removed", text: old.map((token) => token.text).join(" ") },
      { type: "added", text: after },
    ];
  }

  // lengths[i][j]: longest common subsequence of old[i..] and words[j..].
  const width = m + 1;
  const lengths = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i * width + j] =
        old[i].key === next[words[j]].key
          ? lengths[(i + 1) * width + j + 1] + 1
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts[parts.length - 1];
    if (last?.type === type) last.text += text;
    else parts.push({ type, text });
  };

  let i = 0;
  let j = 0;
  let cursor = 0; // next token of `after` to emit
  const removed: string[] = [];
  const flushRemoved = () => {
    if (removed.length > 0) push("removed", removed.splice(0).join(" "));
  };
  const emitUpTo = (index: number, type: "same" | "added") => {
    // Spaces and symbols between two added words are part of the addition.
    for (; cursor < index; cursor++) {
      push(type === "added" && parts[parts.length - 1]?.type === "added" ? "added" : "same", next[cursor].text);
    }
    push(type, next[cursor].text);
    cursor++;
  };

  while (i < n || j < m) {
    if (i < n && j < m && old[i].key === next[words[j]].key) {
      flushRemoved();
      emitUpTo(words[j], "same");
      i++;
      j++;
    } else if (j < m && (i >= n || lengths[i * width + j + 1] >= lengths[(i + 1) * width + j])) {
      flushRemoved();
      emitUpTo(words[j], "added");
      j++;
    } else {
      removed.push(old[i].text);
      i++;
    }
  }
  flushRemoved();
  for (; cursor < next.length; cursor++) push("same", next[cursor].text);
  return parts;
}

export function countWords(parts: DiffPart[], type: DiffPart["type"]): number {
  return parts
    .filter((part) => part.type === type)
    .reduce((total, part) => total + part.text.split(/\s+/).filter(Boolean).length, 0);
}
