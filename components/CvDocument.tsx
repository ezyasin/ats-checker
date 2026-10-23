import type { ReactNode } from "react";
import { parseCvMarkdown, parseInline, type CvBlock, type InlineSpan } from "@/lib/cvMarkdown";
import { parseCv, splitLabel, type CvEntry, type CvModelBlock } from "@/lib/cvModel";
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

function Inline({ text }: { text: string }) {
  return <Spans spans={parseInline(text)} />;
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

/** A fragment of CV text, as in a suggestion's before and after. */
function Snippet({ markdown, className }: { markdown: string; className?: string }) {
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
    if (block.type === "blank") return null;
    return (
      <p key={index} className={block.type === "heading" ? "font-semibold text-slate-900" : undefined}>
        <Spans spans={block.spans} />
      </p>
    );
  });
  return <div className={cn("space-y-1 text-sm leading-6 text-slate-700", className)}>{nodes}</div>;
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5 marker:text-slate-400">
      {items.map((item, index) => (
        <li key={index} className="pl-0.5">
          <Inline text={item} />
        </li>
      ))}
    </ul>
  );
}

function Entry({ entry }: { entry: CvEntry }) {
  const place = [entry.organization, entry.location].filter(Boolean).join(", ");
  return (
    <div className="break-inside-avoid">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="font-semibold text-slate-900">{entry.title}</p>
        {entry.dates && <p className="text-[13px] tabular-nums text-slate-500">{entry.dates}</p>}
      </div>
      {place && <p className="text-[13px] italic text-slate-600">{place}</p>}
      {entry.details.map((detail, index) => (
        <p key={index} className="mt-1">
          <Inline text={detail} />
        </p>
      ))}
      <Bullets items={entry.bullets} />
    </div>
  );
}

/** Items render as "Label: values" lines when they all have a label, otherwise as a list. */
function Items({ items }: { items: string[] }) {
  const labelled = items.map(splitLabel);
  if (labelled.every(Boolean)) {
    return (
      <div className="space-y-0.5">
        {labelled.map((pair, index) => (
          <p key={index}>
            <span className="font-semibold text-slate-900">{pair![0]}:</span> <Inline text={pair![1]} />
          </p>
        ))}
      </div>
    );
  }
  // One long list ("Go, Docker, AWS, ...") reads as a line, not a single bullet.
  if (items.length === 1) {
    return (
      <p>
        <Inline text={items[0]} />
      </p>
    );
  }
  return <Bullets items={items} />;
}

function SectionBody({ blocks }: { blocks: CvModelBlock[] }) {
  const items = blocks.flatMap((block) => (block.type === "item" ? [block.text] : []));
  return (
    <div className="space-y-3">
      {blocks.map((block, index) =>
        block.type === "paragraph" ? (
          <p key={index}>
            <Inline text={block.text} />
          </p>
        ) : null
      )}
      {items.length > 0 && <Items items={items} />}
      {blocks.map((block, index) => (block.type === "entry" ? <Entry key={index} entry={block.entry} /> : null))}
    </div>
  );
}

interface CvDocumentProps {
  markdown: string;
  /** Snippet mode for suggestions: plain lines, no CV layout. */
  compact?: boolean;
  className?: string;
}

export function CvDocument({ markdown, compact = false, className }: CvDocumentProps) {
  if (compact) return <Snippet markdown={markdown} className={className} />;

  const cv = parseCv(markdown);
  return (
    <article className={cn("text-sm leading-6 text-slate-700", className)}>
      <header className="text-center">
        {cv.name && <h3 className="text-2xl font-bold tracking-tight text-slate-900">{cv.name}</h3>}
        {cv.headline && <p className="mt-0.5 text-[15px] text-slate-600">{cv.headline}</p>}
        {cv.contact.length > 0 && (
          <p className="mt-1.5 flex flex-wrap justify-center gap-x-4 gap-y-0.5 text-[13px] text-slate-500">
            {cv.contact.map((item, index) => (
              <span key={index}>{item}</span>
            ))}
          </p>
        )}
      </header>
      {cv.sections.map((section, index) => (
        <section key={index} className="mt-5">
          <h4 className="mb-2 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-800">
            {section.heading}
          </h4>
          <SectionBody blocks={section.blocks} />
        </section>
      ))}
    </article>
  );
}
