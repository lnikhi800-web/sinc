import type { AppLoadContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

const ABORT_DELAY = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  _loadContext: AppLoadContext,
): Promise<Response> {
  const head = renderHeadToString({ request, remixContext, Head });
  const userAgent = request.headers.get('user-agent');

  return new Promise<Response>((resolve, reject) => {
    let didError = false;
    let statusCode = responseStatusCode;
    let resolved = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />,
      {
        [isbot(userAgent ?? '') ? 'onAllReady' : 'onShellReady']() {
          if (resolved) {
            return;
          }

          resolved = true;
          responseHeaders.set('Content-Type', 'text/html');
          responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
          responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

          // Collect all chunks into a buffer then send as one response
          const chunks: Uint8Array[] = [];
          const encoder = new TextEncoder();

          chunks.push(
            encoder.encode(
              `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
            ),
          );

          // Use a writable that collects chunks
          const { Writable } = require('stream');
          const writable = new Writable({
            write(chunk: Buffer, _encoding: string, callback: () => void) {
              chunks.push(new Uint8Array(chunk));
              callback();
            },
            final(callback: () => void) {
              chunks.push(encoder.encode('</div></body></html>'));
              callback();

              const body = new Blob(chunks).stream();
              resolve(
                new Response(body, {
                  headers: responseHeaders,
                  status: didError ? 500 : statusCode,
                }),
              );
            },
          });

          pipe(writable);
        },
        onShellError(error: unknown) {
          if (!resolved) {
            reject(error);
          }
        },
        onError(error: unknown) {
          didError = true;
          console.error(error);
          statusCode = 500;
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
