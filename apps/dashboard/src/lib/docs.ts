import 'server-only';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { docsDir } from './env';

export interface DocEntry {
  slug: string;
  title: string;
}

const DOC_FILE = /^(\d{2}-[a-z0-9-]+)\.md$/;

function bauprotokollDir(): string {
  return path.join(docsDir(), 'bauprotokoll');
}

export async function listDocs(): Promise<DocEntry[]> {
  let files: string[];
  try {
    files = await readdir(/*turbopackIgnore: true*/ bauprotokollDir());
  } catch {
    return [];
  }
  const entries: DocEntry[] = [];
  for (const file of files.sort()) {
    const match = DOC_FILE.exec(file);
    if (!match?.[1]) continue;
    const raw = await readFile(/*turbopackIgnore: true*/ path.join(bauprotokollDir(), file), 'utf8');
    const heading = /^#\s+(.+)$/m.exec(raw)?.[1] ?? match[1];
    entries.push({ slug: match[1], title: heading.trim() });
  }
  return entries;
}

/**
 * Lädt eine Bauprotokoll-Datei als HTML. `slug` = null → Übersicht (README.md).
 * Die Dateien stammen aus dem eigenen Repo, deshalb wird das HTML nicht weiter gefiltert.
 */
export async function renderDoc(slug: string | null): Promise<string | null> {
  if (slug !== null && !/^\d{2}-[a-z0-9-]+$/.test(slug)) return null;
  const file = path.join(bauprotokollDir(), slug === null ? 'README.md' : `${slug}.md`);
  let raw: string;
  try {
    raw = await readFile(/*turbopackIgnore: true*/ file, 'utf8');
  } catch {
    return null;
  }
  const html = await marked.parse(raw, { gfm: true });
  return html
    .replace(/(src|href)="(?:\.\/)?img\//g, '$1="/bauprotokoll/img/')
    .replace(/href="(?:\.\/)?(\d{2}-[a-z0-9-]+)\.md(#[^"]*)?"/g, 'href="/bauprotokoll?d=$1$2"')
    .replace(/href="(?:\.\/)?README\.md"/g, 'href="/bauprotokoll"');
}

export function imagePath(parts: string[]): string | null {
  const base = path.join(bauprotokollDir(), 'img');
  const target = path.resolve(base, ...parts);
  return target.startsWith(base + path.sep) ? target : null;
}
