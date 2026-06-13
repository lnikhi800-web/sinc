// SINC: PreviewsStore — Replaced WebContainer with Supabase Storage static preview
import { atom } from 'nanostores';

export interface PreviewInfo {
  port: number;
  ready: boolean;
  baseUrl: string;
}

// Extend Window interface
declare global {
  interface Window {
    _tabId?: string;
  }
}

const PREVIEW_CHANNEL = 'preview-updates';

export class PreviewsStore {
  #broadcastChannel?: BroadcastChannel;

  previews = atom<PreviewInfo[]>([]);

  constructor() {
    this.#broadcastChannel = this.#maybeCreateChannel(PREVIEW_CHANNEL);

    if (this.#broadcastChannel) {
      this.#broadcastChannel.onmessage = (event) => {
        const { type } = event.data;

        if (type === 'preview-ready') {
          const { url } = event.data;
          this.setPreviewUrl(url);
        }
      };
    }
  }

  #maybeCreateChannel(name: string): BroadcastChannel | undefined {
    if (typeof globalThis === 'undefined') {
      return undefined;
    }

    const globalBroadcastChannel = (
      globalThis as typeof globalThis & {
        BroadcastChannel?: typeof BroadcastChannel;
      }
    ).BroadcastChannel;

    if (typeof globalBroadcastChannel !== 'function') {
      return undefined;
    }

    try {
      return new globalBroadcastChannel(name);
    } catch (error) {
      console.warn('[Preview] BroadcastChannel unavailable:', error);
      return undefined;
    }
  }

  // SINC: Set preview URL from Supabase Storage after server-side build
  setPreviewUrl(url: string) {
    const current = this.previews.get();
    const existing = current.find((p) => p.port === 0);

    if (existing) {
      existing.baseUrl = url;
      existing.ready = true;
      this.previews.set([...current]);
    } else {
      this.previews.set([{ port: 0, ready: true, baseUrl: url }]);
    }

    // Broadcast to other tabs
    this.#broadcastChannel?.postMessage({
      type: 'preview-ready',
      url,
      timestamp: Date.now(),
    });
  }

  clearPreview() {
    this.previews.set([]);
  }

  // Helper for preview ID (kept for compatibility)
  getPreviewId(url: string): string | null {
    try {
      const u = new URL(url);
      return u.pathname.split('/')[1] || null;
    } catch {
      return null;
    }
  }

  refreshAllPreviews() {
    const previews = this.previews.get();
    for (const preview of previews) {
      if (preview.baseUrl) {
        this.setPreviewUrl(preview.baseUrl);
      }
    }
  }
}

// Singleton
let previewsStore: PreviewsStore | null = null;

export function usePreviewStore(): PreviewsStore {
  if (!previewsStore) {
    previewsStore = new PreviewsStore();
  }

  return previewsStore;
}
