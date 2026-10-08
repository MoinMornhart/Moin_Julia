import { describe, expect, it } from 'vitest';
import { fillVariables, messageTemplateSchema, PREVIEW_CONTEXT, renderTemplate } from './message.js';
import { parseWillkommenConfig, rolePanelSchema } from './willkommen.js';

describe('Platzhalter', () => {
  it('ersetzt alle bekannten, lässt unbekannte stehen', () => {
    expect(fillVariables('{user} {user.name} {user.tag} {user.id} {server} {memberCount} {foo}', PREVIEW_CONTEXT)).toBe(
      '<@100000000000000201> Anna anna.streamt 100000000000000201 Moin Demo-Server 1.284 {foo}',
    );
  });
});

describe('Nachrichten-Vorlage', () => {
  it('rendert Embed mit Farbe, Platzhaltern, Thumbnail und Feldern', () => {
    const t = messageTemplateSchema.parse({
      content: 'Hey {user}',
      embed: { color: '#2fd1b8', title: 'Moin {user.name}', description: 'Auf {server}', thumbnail: 'user', fields: [{ name: 'Mitglieder', value: '{memberCount}', inline: true }] },
    });
    const { content, embed } = renderTemplate(t, { ...PREVIEW_CONTEXT, userAvatarUrl: 'https://cdn/a.png' });
    expect(content).toBe('Hey <@100000000000000201>');
    expect(embed).toMatchObject({ color: 0x2fd1b8, title: 'Moin Anna', description: 'Auf Moin Demo-Server', thumbnail: { url: 'https://cdn/a.png' } });
    expect(embed?.fields?.[0]).toEqual({ name: 'Mitglieder', value: '1.284', inline: true });
  });
  it('leeres oder abgeschaltetes Embed wird weggelassen', () => {
    expect(renderTemplate(messageTemplateSchema.parse({ content: 'nur Text' }), PREVIEW_CONTEXT).embed).toBeNull();
    expect(renderTemplate(messageTemplateSchema.parse({ embed: { enabled: false, title: 'x' } }), PREVIEW_CONTEXT).embed).toBeNull();
  });
  it('lehnt unsichere Bild-URLs und falsche Farben ab', () => {
    expect(messageTemplateSchema.safeParse({ embed: { imageUrl: 'http://example.com/a.png' } }).success).toBe(false);
    expect(messageTemplateSchema.safeParse({ embed: { color: 'rot' } }).success).toBe(false);
  });
});

describe('Willkommen-Einstellungen', () => {
  it('sinnvolle Standardtexte, alles aus', () => {
    const c = parseWillkommenConfig({});
    expect(c.welcome.enabled).toBe(false);
    expect(c.welcome.template.embed.title).toContain('Willkommen');
    expect(c.welcome.card).toMatchObject({ enabled: true, style: 'hafen' });
    expect(c.leave.template.embed.thumbnail).toBe('user');
    expect(c.dm.template.embed.enabled).toBe(false);
  });
  it('Rollen-Panel braucht mindestens eine Rolle, höchstens 25', () => {
    expect(rolePanelSchema.safeParse({ name: 'x', roles: [] }).success).toBe(false);
    const roles = Array.from({ length: 26 }, (_, i) => ({ roleId: `1000000000000000${String(i).padStart(2, '0')}`, label: `R${i}` }));
    expect(rolePanelSchema.safeParse({ name: 'x', roles }).success).toBe(false);
  });
});

describe('Bildquellen', () => {
  it('erlaubt leer, https und hochgeladene Bilder – sonst nichts', async () => {
    const { imageSourceSchema, uploadIdOf, sniffImageType } = await import('./upload.js');
    expect(imageSourceSchema.safeParse('').success).toBe(true);
    expect(imageSourceSchema.safeParse('https://example.com/a.png').success).toBe(true);
    expect(imageSourceSchema.safeParse('upload:cmabc1234567890xyz0001').success).toBe(true);
    expect(imageSourceSchema.safeParse('http://example.com/a.png').success).toBe(false);
    expect(imageSourceSchema.safeParse('upload:../../etc').success).toBe(false);
    expect(uploadIdOf('upload:cmabc1234567890xyz0001')).toBe('cmabc1234567890xyz0001');
    expect(uploadIdOf('https://example.com/a.png')).toBeNull();
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
  });
});
