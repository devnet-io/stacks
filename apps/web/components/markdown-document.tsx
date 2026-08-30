import { Fragment, type ReactNode } from 'react';

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph' | 'quote'; text: string }
  | { type: 'code'; language: string; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'rule' };

export function MarkdownDocument({ markdown }: { markdown: string }) {
  return <article className="rounded-2xl border border-border bg-card px-5 py-7 shadow-sm sm:px-9 sm:py-9">{parseMarkdown(markdown).map((block, index) => <MarkdownBlock key={index} block={block} />)}</article>;
}

function MarkdownBlock({ block }: { block: Block }) {
  if (block.type === 'heading') {
    if (block.level === 1) return <h1 className="mb-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{inline(block.text)}</h1>;
    if (block.level === 2) return <h2 className="mb-3 mt-10 text-xl font-semibold tracking-tight text-foreground">{inline(block.text)}</h2>;
    return <h3 className="mb-2 mt-7 text-base font-semibold text-foreground">{inline(block.text)}</h3>;
  }
  if (block.type === 'paragraph') return <p className="my-4 max-w-4xl text-[15px] leading-7 text-muted-foreground">{inline(block.text)}</p>;
  if (block.type === 'quote') return <blockquote className="my-5 rounded-r-xl border-l-4 border-primary bg-primary/7 px-4 py-3 text-sm leading-6 text-foreground">{inline(block.text)}</blockquote>;
  if (block.type === 'rule') return <hr className="my-8 border-border" />;
  if (block.type === 'code') return <pre className="my-5 overflow-x-auto rounded-xl bg-[#090d18] p-4 text-[13px] leading-6 text-slate-100"><code>{block.text}</code></pre>;
  if (block.type === 'list') { const Tag = block.ordered ? 'ol' : 'ul'; return <Tag className={`my-4 space-y-2 pl-6 text-sm leading-6 text-muted-foreground ${block.ordered ? 'list-decimal' : 'list-disc'}`}>{block.items.map((item) => <li key={item}>{inline(item)}</li>)}</Tag>; }
  if (block.type === 'table') return <div className="my-5 overflow-x-auto rounded-xl border border-border"><table className="min-w-full divide-y divide-border text-left text-sm"><thead className="bg-muted/70"><tr>{block.headers.map((header) => <th key={header} className="px-4 py-3 font-semibold text-foreground">{inline(header)}</th>)}</tr></thead><tbody className="divide-y divide-border">{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 align-top leading-6 text-muted-foreground">{inline(cell)}</td>)}</tr>)}</tbody></table></div>;
  return null;
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean).map((token, index) => {
    if (token.startsWith('`')) return <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">{token.slice(1, -1)}</code>;
    if (token.startsWith('**')) return <strong key={index} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>;
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={index} className="font-medium text-primary underline decoration-primary/30 underline-offset-2" href={link[2]}>{link[1]}</a>;
    return <Fragment key={index}>{token}</Fragment>;
  });
}

function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n'); const blocks: Block[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index] ?? ''; if (!line.trim()) { index += 1; continue; }
    if (line.startsWith('```')) { const language = line.slice(3).trim(); const body: string[] = []; index += 1; while (index < lines.length && !(lines[index] ?? '').startsWith('```')) body.push(lines[index++] ?? ''); blocks.push({ type: 'code', language, text: body.join('\n') }); index += 1; continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/); if (heading) { blocks.push({ type: 'heading', level: heading[1]!.length, text: heading[2]! }); index += 1; continue; }
    if (/^---+$/.test(line.trim())) { blocks.push({ type: 'rule' }); index += 1; continue; }
    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-+/.test(lines[index + 1] ?? '')) { const headers = cells(line); index += 2; const rows: string[][] = []; while (index < lines.length && (lines[index] ?? '').includes('|') && (lines[index] ?? '').trim()) rows.push(cells(lines[index++] ?? '')); blocks.push({ type: 'table', headers, rows }); continue; }
    const list = line.match(/^\s*(?:(\d+)\.|[-*])\s+(.+)$/); if (list) { const ordered = Boolean(list[1]); const items: string[] = []; while (index < lines.length) { const item = (lines[index] ?? '').match(/^\s*(?:(\d+)\.|[-*])\s+(.+)$/); if (!item || Boolean(item[1]) !== ordered) break; items.push(item[2]!); index += 1; } blocks.push({ type: 'list', ordered, items }); continue; }
    if (line.startsWith('> ')) { blocks.push({ type: 'quote', text: line.slice(2) }); index += 1; continue; }
    const paragraph = [line.trim()]; index += 1; while (index < lines.length && (lines[index] ?? '').trim() && !startsBlock(lines, index)) paragraph.push((lines[index++] ?? '').trim()); blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

function startsBlock(lines: string[], index: number) { const line = lines[index] ?? ''; return /^(#{1,4})\s|^```|^> |^---+$|^\s*(?:\d+\.|[-*])\s+/.test(line) || (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-+/.test(lines[index + 1] ?? '')); }
function cells(line: string) { return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()); }
