'use client';

import { useEffect } from 'react';
import { simplifyText } from '@moin/shared';

const SKIP = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'KBD']);

function skip(node: Node): boolean {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (SKIP.has(el.tagName) || el.isContentEditable || el.hasAttribute('data-no-dummies')) return true;
  }
  return false;
}

function rewrite(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const v = n.nodeValue;
    if (!v || !/\p{L}{3}/u.test(v) || skip(n)) continue;
    const next = simplifyText(v);
    if (next !== v) n.nodeValue = next;
  }
}

/**
 * „🍼 Für Dummies“ in den Bereichen (Wunsch Philip, 14.10.): ersetzt Fachwörter in allen Texten der Seite
 * (Feldnamen, Hinweise, Knöpfe) durch einfache Wörter – Eingaben, Code und eigene Texte bleiben unverändert.
 * Läuft erst im Browser nach dem Laden (keine Abweichung beim ersten Darstellen) und bei jeder Änderung.
 */
export function DummiesRewriter() {
  useEffect(() => {
    const root = document.querySelector('[data-dummies-root]') ?? document.body;
    rewrite(root);
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        observer.disconnect();
        rewrite(root);
        observer.observe(root, { childList: true, subtree: true, characterData: true });
      });
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
