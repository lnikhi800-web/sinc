// SINC: WebContainer stub — replaced with Supabase Storage static preview
// The actual preview URL is served from Supabase Storage after server-side build

import { atom } from 'nanostores';

// Stub webcontainer instance — preview is now server-side via Supabase Storage
export const webcontainer: Promise<null> = Promise.resolve(null);

// Noop boot — we do not boot WebContainers
export async function bootWebContainer() {
  return null;
}
