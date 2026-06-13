// SINC: Static preview route — loads from Supabase Storage URL
// Route: /webcontainer/preview/:id
import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';

export async function loader({ params }: LoaderFunctionArgs) {
  const previewId = params.id;

  if (!previewId) {
    throw new Response('Preview ID is required', { status: 400 });
  }

  return json({ previewId });
}

export default function SincPreview() {
  const { previewId } = useLoaderData<typeof loader>();

  // The actual Supabase URL is passed via postMessage or query param
  const supabaseUrl = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('url') || ''
    : '';

  if (!supabaseUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div style={{ textAlign: 'center', color: '#7B5FFF', fontFamily: 'Orbitron, sans-serif' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 14, color: '#888' }}>Preview loading...</div>
          <div style={{ fontSize: 10, color: '#555', marginTop: 8 }}>ID: {previewId}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <iframe
        title="SINC Preview"
        src={supabaseUrl}
        className="w-full h-full border-none"
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
        loading="eager"
      />
    </div>
  );
}
