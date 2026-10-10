#!/usr/bin/env node
/**
 * Nachgebaute Discord-API für Ende-zu-Ende-Tests des Einrichtungs-Assistenten.
 * Nur die Endpunkte, die das Dashboard nutzt. Start: node scripts/tests/fake-discord.mjs [port]
 *
 * Gültige Werte: Bot-Token FAKE.BOT.TOKEN · Application-ID 123456789012345678 · Secret fake-secret
 */
import { createServer } from 'node:http';

const PORT = Number(process.argv[2] ?? 3399);
export const FAKE = { token: 'FAKE.BOT.TOKEN', clientId: '123456789012345678', secret: 'fake-secret' };
/** Server, auf die der Bot „eingeladen“ wurde */
const botGuilds = new Set();
/** Was das Dashboard per PATCH geschickt hat (für Tests abrufbar unter GET /__recorded) */
const recorded = { user: null, application: null, member: null };
const BOT_ID = '999000000000000001';
const USER = { id: '500000000000000001', username: 'philip', global_name: 'Philip', avatar: null };

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) data += chunk;
  return new URLSearchParams(data);
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const auth = req.headers.authorization ?? '';
  console.log(req.method, url.pathname);

  // Browser-Login: sofort mit Code zurück zur Redirect-URL
  if (url.pathname === '/oauth2/authorize') {
    const back = new URL(url.searchParams.get('redirect_uri'));
    back.searchParams.set('code', 'fake-code');
    back.searchParams.set('state', url.searchParams.get('state'));
    // Bot-Einladung: Server merken und guild_id mitschicken wie Discord
    if (url.searchParams.get('scope')?.includes('bot') && url.searchParams.get('guild_id')) {
      botGuilds.add(url.searchParams.get('guild_id'));
      back.searchParams.set('guild_id', url.searchParams.get('guild_id'));
    }
    res.writeHead(302, { location: back.toString() }).end();
    return;
  }
  if (url.pathname === '/__recorded') return send(res, 200, recorded);
  if (req.method === 'PATCH' && auth === `Bot ${FAKE.token}`) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || '{}');
    if (url.pathname === '/api/v10/users/@me') {
      recorded.user = body;
      return send(res, 200, { id: BOT_ID, username: body.username ?? 'Moin_Julia', avatar: body.avatar ? 'a1b2c3' : null });
    }
    if (url.pathname === '/api/v10/applications/@me') {
      recorded.application = body;
      return send(res, 200, { id: FAKE.clientId, description: body.description });
    }
    if (/^\/api\/v10\/guilds\/\d+\/members\/@me$/.test(url.pathname)) {
      recorded.member = body;
      return send(res, 200, { nick: body.nick ?? null });
    }
  }
  if (url.pathname === `/api/v10/guilds/700000000000000001/members/${BOT_ID}` && auth === `Bot ${FAKE.token}`) {
    return send(res, 200, { nick: recorded.member?.nick ?? null, avatar: null });
  }
  if (url.pathname === '/api/v10/users/@me') {
    if (auth === `Bot ${FAKE.token}`) return send(res, 200, { id: '999000000000000001', username: 'Moin_Julia' });
    if (auth === 'Bearer fake-user-token') return send(res, 200, USER);
    return send(res, 401, { message: '401: Unauthorized', code: 0 });
  }
  if (url.pathname === '/api/v10/users/@me/guilds' && auth === `Bot ${FAKE.token}`) {
    return send(res, 200, [...botGuilds].map((id) => ({ id, name: 'Philips Server', icon: null })));
  }
  const guildMatch = /^\/api\/v10\/guilds\/(\d+)$/.exec(url.pathname);
  if (guildMatch && auth === `Bot ${FAKE.token}` && botGuilds.has(guildMatch[1])) {
    return send(res, 200, { id: guildMatch[1], name: 'Philips Server', icon: null, owner_id: USER.id });
  }
  // Zweiter Server: beim Login nur Mitglied (keine Rechte) – erst danach per Rolle Admin geworden (Meldung 10.10.)
  if (url.pathname === `/api/v10/guilds/700000000000000002/members/${USER.id}` && auth === `Bot ${FAKE.token}`) {
    return send(res, 200, { user: USER, roles: ['700000000000000099'] });
  }
  if (url.pathname === '/api/v10/guilds/700000000000000002/roles' && auth === `Bot ${FAKE.token}`) {
    return send(res, 200, [{ id: '700000000000000002', name: '@everyone', permissions: '0', position: 0, managed: false, color: 0 }, { id: '700000000000000099', name: 'Admin', permissions: '8', position: 1, managed: false, color: 0 }]);
  }
  if (url.pathname === '/api/v10/users/@me/guilds' && auth === 'Bearer fake-user-token') {
    return send(res, 200, [
      { id: '700000000000000001', name: 'Philips Server', icon: null, owner: true, permissions: '8' },
      { id: '700000000000000002', name: 'Freundes-Server', icon: null, owner: false, permissions: '0' },
    ]);
  }
  if (url.pathname === '/api/v10/applications/@me' && auth === `Bot ${FAKE.token}`) {
    // Server Members (limited) an, Message Content aus → der Assistent muss warnen
    return send(res, 200, { id: FAKE.clientId, name: 'Moin_Julia', flags: 1 << 15, redirect_uris: [] });
  }
  if (url.pathname === '/api/v10/oauth2/token' && req.method === 'POST') {
    const body = await readBody(req);
    const basic = Buffer.from(`${FAKE.clientId}:${FAKE.secret}`).toString('base64');
    if (auth !== `Basic ${basic}`) return send(res, 401, { error: 'invalid_client' });
    if (body.get('grant_type') === 'client_credentials') return send(res, 200, { access_token: 'cc', token_type: 'Bearer' });
    if (body.get('grant_type') === 'authorization_code' && body.get('code') === 'fake-code') {
      return send(res, 200, { access_token: 'fake-user-token', token_type: 'Bearer' });
    }
    return send(res, 400, { error: 'invalid_grant' });
  }
  send(res, 404, { message: 'Not found' });
}).listen(PORT, () => console.log(`Fake-Discord auf http://localhost:${PORT}`));
