/**
 * SINC: Server-side auth helper
 * Gets Supabase session from cookie or Authorization header
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

export function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

export async function getUserFromRequest(request: Request) {
  try {
    // Try Authorization header first
    const authHeader = request.headers.get('Authorization');

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const supabase = getSupabaseAdmin();
      const { data: { user } } = await supabase.auth.getUser(token);

      return user || null;
    }

    // Try cookie-based session
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookies(cookieHeader);
    const accessToken = cookies['sb-access-token'];

    if (accessToken) {
      const supabase = getSupabaseAdmin();
      const { data: { user } } = await supabase.auth.getUser(accessToken);

      return user || null;
    }

    return null;
  } catch {
    return null;
  }
}

export async function getProfile(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  return data;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  const items = cookieHeader.split(';').map((c) => c.trim());

  for (const item of items) {
    const [name, ...rest] = item.split('=');

    if (name && rest.length > 0) {
      cookies[decodeURIComponent(name.trim())] = decodeURIComponent(rest.join('=').trim());
    }
  }

  return cookies;
}
