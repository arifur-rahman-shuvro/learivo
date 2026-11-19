import type { ReactNode } from "react";

/** Splits text into pieces, marking the ones that are glossary terms. Provided by the app. */
export type TermSplitter = (text: string) => { text: string; definition?: string }[];

/**
 * Safe "markdown-lite": **bold**, *italic*, `code`, "- " bullet lists and blank-line paragraphs.
 * Everything is built as React elements, so the text can never become HTML or script.
 */

const INLINE = /(\*\*[^\s*](?:[^*\n]*[^\s*])?\*\*|\*[^\s*](?:[^*\n]*[^\s*])?\*|`[^`\n]+`)/g;

function plain(part: string, split?: TermSplitter): ReactNode {
  if (!split) return part;
  const pieces = split(part);
  if (pieces.length === 1 && pieces[0]!.definition === undefined) return part;
  return pieces.map((p, k) =>
    p.definition === undefined ? (
      p.text
    ) : (
      <span
        key={k}
        tabIndex={0}
        title={p.definition}
        className="cursor-help underline decoration-dotted underline-offset-2"
      >
        {p.text}
      </span>
    ),
  );
}

function inline(text: string, split?: TermSplitter): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={i} className="rounded-control bg-surface-2 px-1 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{plain(part, split)}</span>;
  });
}

export type Block = { kind: "p"; lines: string[] } | { kind: "ul"; items: string[] };

/** Splits text into paragraphs and bullet lists. Exported for tests. */
export function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const last = out[out.length - 1];
    if (line.trim() === "") {
      out.push({ kind: "p", lines: [] });
    } else if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1]!);
      else out.push({ kind: "ul", items: [bullet[1]!] });
    } else if (last?.kind === "p") last.lines.push(line);
    else out.push({ kind: "p", lines: [line] });
  }
  return out.filter((b) => b.kind === "ul" || b.lines.length > 0);
}

export function RichText({
  text,
  className,
  split,
}: {
  text: string;
  className?: string;
  split?: TermSplitter;
}) {
  return (
    <div className={className}>
      {blocks(text).map((b, i) =>
        b.kind === "ul" ? (
          <ul key={i} className="m-0 my-1 list-disc pl-5">
            {b.items.map((item, k) => (
              <li key={k}>{inline(item, split)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="m-0 my-1 break-words first:mt-0 last:mb-0">
            {b.lines.map((l, k) => (
              <span key={k}>
                {k > 0 && <br />}
                {inline(l, split)}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
