import { createCanvas } from '@napi-rs/canvas';
import type { CardStyle } from '@moin/shared';
import { fitText, registerFonts, safeImage, STYLES } from '../willkommen/card.js';

/** Rangkarte 1000 × 300: Avatar, Name, Level, Platz und Fortschrittsbalken – im Stil des Willkommensbilds */

const WIDTH = 1000;
const HEIGHT = 300;

export interface RankCardInput {
  style: CardStyle;
  name: string;
  avatar: Buffer | null;
  level: number;
  place: number;
  current: number;
  needed: number;
  totalXp: number;
  labels: { level: string; place: string; xp: string };
}

const compact = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace('.', ',')}k` : n.toLocaleString('de-DE'));

export async function renderRankCard(input: RankCardInput): Promise<Buffer> {
  registerFonts();
  const s = STYLES[input.style];
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, s.from);
  gradient.addColorStop(1, s.to);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, WIDTH, HEIGHT, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 3;
  for (let row = 0; row < 4; row++) {
    ctx.beginPath();
    const y = 200 + row * 26;
    for (let x = 0; x <= WIDTH; x += 8) ctx.lineTo(x, y + Math.sin((x + row * 40) / 40) * 5);
    ctx.stroke();
  }

  // Avatar
  const cx = 150;
  const cy = HEIGHT / 2;
  const r = 95;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.fillStyle = s.accent;
  ctx.fill();
  const avatar = await safeImage(input.avatar);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
  else {
    ctx.fillStyle = '#34416f';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#eef1fb';
    ctx.font = '700 84px Bricolage';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((input.name[0] ?? '?').toUpperCase(), cx, cy + 4);
  }
  ctx.restore();

  const left = 290;
  const right = WIDTH - 50;
  ctx.textBaseline = 'alphabetic';

  // Platz + Level oben rechts
  ctx.textAlign = 'right';
  ctx.fillStyle = s.accent;
  ctx.font = '800 54px Bricolage';
  ctx.fillText(input.labels.level, right, 95);
  const levelWidth = ctx.measureText(input.labels.level).width;
  ctx.fillStyle = s.sub;
  ctx.font = '700 30px Manrope';
  ctx.fillText(input.labels.place, right - levelWidth - 24, 95);
  const placeWidth = ctx.measureText(input.labels.place).width;

  // Name
  ctx.textAlign = 'left';
  ctx.fillStyle = s.text;
  const nameMax = right - levelWidth - placeWidth - 60 - left;
  const size = fitText(ctx, input.name, Math.max(160, nameMax), 52, 'Bricolage', '800');
  ctx.font = `800 ${size}px Bricolage`;
  ctx.fillText(input.name, left, 95);

  // Fortschrittsbalken
  const barY = 160;
  const barH = 38;
  const barW = right - left;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.roundRect(left, barY, barW, barH, barH / 2);
  ctx.fill();
  const ratio = input.needed > 0 ? Math.min(1, input.current / input.needed) : 0;
  if (ratio > 0) {
    ctx.fillStyle = s.accent;
    ctx.beginPath();
    ctx.roundRect(left, barY, Math.max(barH, barW * ratio), barH, barH / 2);
    ctx.fill();
  }

  ctx.fillStyle = s.sub;
  ctx.font = '600 26px Manrope';
  ctx.fillText(input.labels.xp, left, barY + barH + 42);
  ctx.textAlign = 'right';
  ctx.fillText(`Σ ${compact(input.totalXp)} XP`, right, barY + barH + 42);

  return canvas.toBuffer('image/png');
}
