/**
 * SINC: api.build-preview.ts
 *
 * Server-side route that:
 * 1. Receives the generated file tree (from the AI chat pipeline)
 * 2. Writes files to /tmp
 * 3. Runs: npm install && npm run build
 * 4. Uploads /dist to Supabase Storage
 * 5. Returns the public preview URL
 *
 * POST /api/build-preview
 * Body: { projectId: string, files: Record<string, string> }
 * Returns: { previewUrl: string }
 */

import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const PREVIEW_BUCKET = 'sinc-previews';

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function getUserFromRequest(request: Request): Promise<string | null> {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return null;
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser(token);

    return user?.id || null;
  } catch {
    return null;
  }
}

async function checkQuota(userId: string): Promise<{ allowed: boolean; plan: string }> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('profiles')
    .select('prompt_count, prompt_limit, plan')
    .eq('id', userId)
    .single();

  if (!data) {
    return { allowed: false, plan: 'free' };
  }

  return {
    allowed: data.prompt_count < data.prompt_limit,
    plan: data.plan,
  };
}

async function incrementPromptCount(userId: string) {
  const supabase = getSupabaseAdmin();
  await supabase.rpc('increment_prompt_count', { user_id: userId });
}

async function uploadDistToSupabase(
  distDir: string,
  projectId: string,
  userId: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const uploadPrefix = `${userId}/${projectId}`;

  function getAllFiles(dir: string, baseDir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...getAllFiles(fullPath, baseDir));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  const allFiles = getAllFiles(distDir, distDir);

  for (const filePath of allFiles) {
    const relativePath = path.relative(distDir, filePath);
    const storagePath = `${uploadPrefix}/${relativePath}`.replace(/\\/g, '/');
    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    const contentTypeMap: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.webp': 'image/webp',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    await supabase.storage
      .from(PREVIEW_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
        cacheControl: '3600',
      });
  }

  // Return the public URL of index.html
  const { data } = supabase.storage
    .from(PREVIEW_BUCKET)
    .getPublicUrl(`${uploadPrefix}/index.html`);

  return data.publicUrl;
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Auth check
  const userId = await getUserFromRequest(request);

  if (!userId) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Quota check
  const { allowed, plan } = await checkQuota(userId);

  if (!allowed) {
    return json(
      {
        error: 'Prompt limit reached',
        code: 'QUOTA_EXCEEDED',
        plan,
        upgradeUrl: '/pricing',
      },
      { status: 402 },
    );
  }

  const { projectId, files } = await request.json<{
    projectId: string;
    files: Record<string, string>;
  }>();

  if (!projectId || !files) {
    return json({ error: 'projectId and files are required' }, { status: 400 });
  }

  // Create temp directory for this build
  const tmpDir = path.join(os.tmpdir(), `sinc-build-${projectId}-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Write all files to temp directory
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filePath);
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
    }

    // Run npm install + build (60s timeout)
    execSync('npm install --prefer-offline --no-audit --no-fund', {
      cwd: tmpDir,
      timeout: 60000,
      stdio: 'pipe',
    });

    execSync('npm run build', {
      cwd: tmpDir,
      timeout: 60000,
      stdio: 'pipe',
    });

    const distDir = path.join(tmpDir, 'dist');

    if (!fs.existsSync(distDir)) {
      throw new Error('Build succeeded but dist/ folder not found');
    }

    // Upload to Supabase Storage
    const previewUrl = await uploadDistToSupabase(distDir, projectId, userId);

    // Increment quota
    await incrementPromptCount(userId);

    // Save preview URL to project in DB
    const supabase = getSupabaseAdmin();
    await supabase
      .from('projects')
      .upsert({ id: projectId, user_id: userId, preview_url: previewUrl, updated_at: new Date().toISOString() });

    return json({ previewUrl });
  } catch (error: any) {
    console.error('[SINC Build] Error:', error.message);

    return json({ error: 'Build failed', details: error.message }, { status: 500 });
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}
