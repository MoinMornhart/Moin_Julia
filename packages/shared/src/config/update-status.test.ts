import { describe, expect, it } from 'vitest';
import { effectiveUpdateStatus, UPDATE_STALE_MS } from './update-status.js';

const at = '2026-10-13T16:21:37Z';
const now = Date.parse(at) + 60_000;

describe('Update-Status (hängendes „Update läuft …“)', () => {
  it('neuere Version läuft schon → Update war erfolgreich', () => {
    const r = effectiveUpdateStatus({ state: 'running', from: '0.46.1', to: '', at }, '0.46.3', now);
    expect(r).toEqual({ status: { state: 'success', from: '0.46.1', to: '0.46.3', at }, stale: false });
  });

  it('noch alte Version und kurz → läuft wirklich noch', () => {
    expect(effectiveUpdateStatus({ state: 'running', from: '0.46.1', to: '', at }, '0.46.1', now).status?.state).toBe('running');
  });

  it('über 45 Minuten „läuft“ → hängen geblieben, Knopf frei', () => {
    const r = effectiveUpdateStatus({ state: 'running', from: '0.46.1', to: '', at }, '0.46.1', Date.parse(at) + UPDATE_STALE_MS + 1000);
    expect(r.stale).toBe(true);
    expect(r.status?.state).toBe('failed');
  });

  it('fertige Zustände bleiben, wie sie sind', () => {
    const done = { state: 'success' as const, from: '0.46.1', to: '0.46.3', at };
    expect(effectiveUpdateStatus(done, '0.46.3', now)).toEqual({ status: done, stale: false });
    expect(effectiveUpdateStatus(null, '0.46.3', now)).toEqual({ status: null, stale: false });
  });
});
