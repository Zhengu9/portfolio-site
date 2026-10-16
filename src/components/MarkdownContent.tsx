import type { ReactNode } from "react";

function safeHref(value: string) {
  if (value.startsWith("/media/")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function inlineContent(line: string): ReactNode[] {
  const tokenPattern = /(!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(line))) {
    if (match.index > cursor) nodes.push(line.slice(cursor, match.index));
    if (match[1]?.startsWith("![")) {
      const src = safeHref(match[3]);
      nodes.push(src
        ? <img className="markdown-image" key={`image-${match.index}`} src={src} alt={match[2]} loading="lazy" />
        : match[0]);
    } else if (match[4]) {
      const href = safeHref(match[5]);
      nodes.push(href
        ? <a key={`link-${match.index}`} href={href} target="_blank" rel="noopener noreferrer">{match[4]}</a>
        : match[4]);
    } else if (match[6]) {
      nodes.push(<strong key={`bold-${match.index}`}>{match[6]}</strong>);
    } else if (match[7]) {
      nodes.push(<code key={`code-${match.index}`}>{match[7]}</code>);
    }
    cursor = tokenPattern.lastIndex;
  }

  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes;
}

export function MarkdownContent({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let codeLines: string[] | null = null;

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {listItems.map((item, index) => <li key={`${index}-${item}`}>{inlineContent(item)}</li>)}
      </ul>,
    );
    listItems = [];
  };

  const flushCode = () => {
    if (!codeLines) return;
    blocks.push(<pre key={`code-${blocks.length}`}><code>{codeLines.join("\n")}</code></pre>);
    codeLines = null;
  };

  for (const [index, line] of lines.entries()) {
    if (line.trim().startsWith("```")) {
      flushList();
      if (codeLines) flushCode();
      else codeLines = [];
      continue;
    }
    if (codeLines) {
      codeLines.push(line);
      continue;
    }
    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (listItem) {
      listItems.push(listItem[1]);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push(<h3 key={`heading-${index}`}>{inlineContent(heading[2])}</h3>);
    } else if (line.startsWith("> ")) {
      blocks.push(<blockquote key={`quote-${index}`}>{inlineContent(line.slice(2))}</blockquote>);
    } else {
      blocks.push(<p key={`paragraph-${index}`}>{inlineContent(line)}</p>);
    }
  }
  flushList();
  flushCode();

  return <div className="markdown-content">{blocks}</div>;
}
