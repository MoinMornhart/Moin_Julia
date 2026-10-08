import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import type { CardStyle } from '@moin/shared';

/**
 * Willkommensbild 1024 × 400: Avatar mit Ring, große Überschrift, Name, Unterzeile.
 * Schriften (OFL) liegen in apps/bot/assets/fonts und werden einmal registriert.
 */

const WIDTH = 1024;
const HEIGHT = 400;

let fontsReady = false;
export function registerFonts(): void {
  if (fontsReady) return;
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/modules/willkommen → ../../../assets/fonts (gilt auch für src/ beim Testen)
  const dir = [path.resolve(here, '../../../assets/fonts'), path.resolve(process.cwd(), 'assets/fonts')].find((d) => existsSync(d));
  if (dir) {
    GlobalFonts.registerFromPath(path.join(dir, 'BricolageGrotesque.ttf'), 'Bricolage');
    GlobalFonts.registerFromPath(path.join(dir, 'Manrope.ttf'), 'Manrope');
  }
  fontsReady = true;
}

export const STYLES: Record<CardStyle, { from: string; to: string; accent: string; text: string; sub: string }> = {
  hafen: { from: '#0d1326', to: '#1b2a5c', accent: '#ff7a59', text: '#eef1fb', sub: '#9aa4c7' },
  koralle: { from: '#ff7a59', to: '#e9603f', accent: '#ffffff', text: '#ffffff', sub: '#fff1ec' },
  mint: { from: '#0f3b3a', to: '#2fd1b8', accent: '#ffffff', text: '#ffffff', sub: '#e0fbf6' },
  nacht: { from: '#05060a', to: '#1a1f2e', accent: '#ffc857', text: '#ffffff', sub: '#b9bfd3' },
};

export interface CardInput {
  style: CardStyle;
  headline: string;
  name: string;
  subline: string;
  avatar: Buffer | null;
  background: Buffer | null;
}

export function fitText(ctx: SKRSContext2D, text: string, maxWidth: number, startSize: number, family: string, weight: string): number {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size > 18);
  return size;
}

export async function safeImage(data: Buffer | null): Promise<Image | null> {
  if (!data) return null;
  try {
    return await loadImage(data);
  } catch {
    return null;
  }
}

export async function renderWelcomeCard(input: CardInput): Promise<Buffer> {
  registerFonts();
  const s = STYLES[input.style];
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Hintergrund: eigenes Bild (abgedunkelt) oder Farbverlauf mit Wellen
  const bg = await safeImage(input.background);
  if (bg) {
    const scale = Math.max(WIDTH / bg.width, HEIGHT / bg.height);
    ctx.drawImage(bg, (WIDTH - bg.width * scale) / 2, (HEIGHT - bg.height * scale) / 2, bg.width * scale, bg.height * scale);
    ctx.fillStyle = 'rgba(5, 8, 20, 0.55)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, s.from);
    gradient.addColorStop(1, s.to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Dezente Wellen als Hafen-Motiv
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 3;
    for (let row = 0; row < 6; row++) {
      ctx.beginPath();
      const y = 250 + row * 28;
      for (let x = 0; x <= WIDTH; x += 8) ctx.lineTo(x, y + Math.sin((x + row * 40) / 40) * 6);
      ctx.stroke();
    }
  }

  // Avatar im Kreis mit Ring
  const cx = 200;
  const cy = HEIGHT / 2;
  const r = 110;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 9, 0, Math.PI * 2);
  ctx.fillStyle = s.accent;
  ctx.fill();
  const avatar = await safeImage(input.avatar);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = '#34416f';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#eef1fb';
    ctx.font = `700 96px Bricolage`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((input.name[0] ?? '?').toUpperCase(), cx, cy + 4);
  }
  ctx.restore();

  // Texte
  const left = 370;
  const maxWidth = WIDTH - left - 50;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = s.accent;
  ctx.font = `800 30px Bricolage`;
  ctx.fillText(input.headline.toUpperCase().split('').join(String.fromCharCode(8202)), left, 140);

  ctx.fillStyle = s.text;
  const nameSize = fitText(ctx, input.name, maxWidth, 76, 'Bricolage', '800');
  ctx.font = `800 ${nameSize}px Bricolage`;
  ctx.fillText(input.name, left, 140 + nameSize + 12);

  ctx.fillStyle = s.sub;
  ctx.font = `600 30px Manrope`;
  ctx.fillText(input.subline, left, 140 + nameSize + 66);

  return canvas.toBuffer('image/png');
}

/** Bild aus dem Netz laden (max. 5 MB, 5 s) – für Avatar und eigenen Hintergrund */
export async function fetchImage(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > 5 * 1024 * 1024) return null;
    const data = Buffer.from(await res.arrayBuffer());
    return data.length > 5 * 1024 * 1024 ? null : data;
  } catch {
    return null;
  }
}
