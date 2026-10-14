import 'server-only';
import { cookies } from 'next/headers';

/** Dashboard „🍼 Für Dummies“ an? (pro Person, Cookie) */
export const DUMMIES_COOKIE = 'moin_ui';

export async function dummiesUi(): Promise<boolean> {
  return (await cookies()).get(DUMMIES_COOKIE)?.value === 'dummies';
}
