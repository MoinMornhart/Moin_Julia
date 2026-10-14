'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { DUMMIES_COOKIE } from '@/lib/ui-style';

/** Umschalter oben rechts: Dashboard normal ↔ „🍼 Für Dummies“ (gilt nur für diese Person/diesen Browser) */
export async function setDummiesUi(on: boolean): Promise<void> {
  const jar = await cookies();
  if (on) jar.set(DUMMIES_COOKIE, 'dummies', { path: '/', maxAge: 365 * 86_400, sameSite: 'lax', httpOnly: true });
  else jar.delete(DUMMIES_COOKIE);
  revalidatePath('/', 'layout');
}
