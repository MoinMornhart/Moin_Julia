'use client';

import { useEffect } from 'react';

/**
 * Erklärung beim Drüberfahren – überall (Issue #5). Jeder Schalter, jedes Feld, jede Auswahl und jeder Knopf
 * ohne eigene Erklärung (`title`) bekommt eine: aus Beschriftung + Beschreibung (`data-help`) des Bausteins,
 * bei Zahlen mit erlaubtem Bereich. Eigene, bessere `title`-Texte bleiben unangetastet.
 */
const SELECTOR = 'input:not([type="hidden"]), select, textarea, button, a[href], [role="switch"]';
const MARK = 'data-auto-title';

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

export function helpFor(el: HTMLElement): string {
  const input = el as HTMLInputElement;
  const own = clean(el.getAttribute('aria-label')) || clean(input.labels?.[0]?.textContent) || clean(el.closest('label')?.textContent);
  // Felder ohne Beschriftung: Der Platzhalter ist sichtbar und ihr Name – ein title würde ihn verdrängen
  if (!own && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return '';
  const text = own || clean(el.textContent);
  const scope = el.closest('[data-help-scope]');
  const desc = clean(scope?.querySelector('[data-help]')?.textContent);
  const parts = [text, desc && desc !== text ? desc : ''].filter(Boolean);
  if (el.tagName === 'INPUT' && input.type === 'number' && (input.min || input.max)) parts.push(`Erlaubt: ${input.min || '…'} bis ${input.max || '…'}`);
  if (el.getAttribute('role') === 'switch' || input.type === 'checkbox') parts.push('Klicken zum Ein- oder Ausschalten');
  else if (el.tagName === 'SELECT') parts.push('Auswählen');
  else if (el.tagName === 'A' && (el as HTMLAnchorElement).hostname && (el as HTMLAnchorElement).hostname !== location.hostname) parts.push('öffnet eine externe Seite');
  return parts.join(' – ').slice(0, 300);
}

function apply(root: ParentNode) {
  for (const el of root.querySelectorAll<HTMLElement>(SELECTOR)) {
    if (el.hasAttribute('title') && !el.hasAttribute(MARK)) continue;
    const help = helpFor(el);
    if (!help) continue;
    if (el.getAttribute('title') !== help) el.setAttribute('title', help);
    el.setAttribute(MARK, '');
  }
}

export function HoverHelp() {
  useEffect(() => {
    apply(document);
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        apply(document);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
