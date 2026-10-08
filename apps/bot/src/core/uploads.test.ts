import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@moin/db';
import { attachEmbedUpload, loadUpload } from './uploads.js';

const ID = 'cmupload000000000000001';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/** Nur upload.findFirst wird gebraucht – liefert das Bild nur für den richtigen Server */
function fakePrisma(): PrismaClient {
  return {
    upload: {
      findFirst: async ({ where }: { where: { id: string; guildId: string } }) =>
        where.id === ID && where.guildId === 'g1' ? { data: new Uint8Array(PNG), mime: 'image/png' } : null,
    },
  } as unknown as PrismaClient;
}

describe('Hochgeladene Bilder im Bot', () => {
  it('hängt ein hochgeladenes Embed-Bild als Datei an', async () => {
    const { embed, files } = await attachEmbedUpload(fakePrisma(), 'g1', { color: 1, title: 'Hi', image: { url: `upload:${ID}` } });
    expect(embed?.image?.url).toBe(`attachment://bild-${ID}.png`);
    expect(files).toHaveLength(1);
    expect(files[0]!.name).toBe(`bild-${ID}.png`);
  });

  it('lässt https-Bilder unverändert', async () => {
    const { embed, files } = await attachEmbedUpload(fakePrisma(), 'g1', { color: 1, image: { url: 'https://example.com/a.png' } });
    expect(embed?.image?.url).toBe('https://example.com/a.png');
    expect(files).toHaveLength(0);
  });

  it('lässt ein gelöschtes oder fremdes Bild weg, statt die Nachricht scheitern zu lassen', async () => {
    const { embed, files } = await attachEmbedUpload(fakePrisma(), 'anderer-server', { color: 1, title: 'Hi', image: { url: `upload:${ID}` } });
    expect(embed?.image).toBeUndefined();
    expect(embed?.title).toBe('Hi');
    expect(files).toHaveLength(0);
  });

  it('lädt den Hintergrund für das Willkommensbild', async () => {
    expect((await loadUpload(fakePrisma(), 'g1', `upload:${ID}`))?.data.equals(PNG)).toBe(true);
    expect(await loadUpload(fakePrisma(), 'g1', 'https://example.com')).toBeNull();
  });
});
