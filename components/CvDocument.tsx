import type { ReactNode } from "react";
import { parseCvMarkdown, type CvBlock, type InlineSpan } from "@/lib/cvMarkdown";
import { cn } from "@/lib/utils";

function Spans({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, index) =>
        span.bold ? (
          <strong key={index} className="font-semibold text-slate-900">
            {span.text}
          </strong>
        ) : (
          <span key={index}>{span.text}</span>
        )
      )}
    </>
  );
}

/** Groups consecutive bullets so they render as one list. */
function group(blocks: CvBlock[]) {
  const groups: (CvBlock | { type: "list"; items: InlineSpan[][] })[] = [];
  for (const block of blocks) {
    const previous = groups[groups.length - 1];
    if (block.type === "bullet") {
      if (previous?.type === "list") previous.items.push(block.spans);
      else groups.push({ type: "list", items: [block.spans] });
    } else if (block.type !== "blank") {
      groups.push(block);
    }
  }
  return groups;
}

interface CvDocumentProps {
  markdown: string;
  /** Snippet mode for suggestions: no large name heading, tighter spacing. */
  compact?: boolean;
  className?: string;
}

export function CvDocument({ markdown, compact = false, className }: CvDocumentProps) {
  const nodes: ReactNode[] = group(parseCvMarkdown(markdown)).map((block, index) => {
    if (block.type === "list") {
      return (
        <ul key={index} className="list-disc space-y-1 pl-5 marker:text-slate-400">
          {block.items.map((spans, item) => (
            <li key={item}>
              <Spans spans={spans} />
            </li>
          ))}
        </ul>
      );
    }
    if (block.type === "heading" && !compact) {
      if (block.level === 1) {
        return (
          <h3 key={index} className="text-xl font-bold text-slate-900">
            <Spans spans={block.spans} />
          </h3>
        );
      }
      return (
        <h4
          key={index}
          className={cn(
            "font-semibold text-slate-900",
            block.level === 2
              ? "mt-5 border-b border-slate-200 pb-1 text-xs uppercase tracking-wider text-slate-500"
              : "mt-3 text-sm"
          )}
        >
          <Spans spans={block.spans} />
        </h4>
      );
    }
    if (block.type === "heading") {
      return (
        <p key={index} className="font-semibold text-slate-900">
          <Spans spans={block.spans} />
        </p>
      );
    }
    if (block.type === "blank") return null;
    return (
      <p key={index}>
        <Spans spans={block.spans} />
      </p>
    );
  });

  return (
    <div className={cn("text-sm leading-6 text-slate-700", compact ? "space-y-1" : "space-y-2", className)}>
      {nodes}
    </div>
  );
}
