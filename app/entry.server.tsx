import type { AppLoadContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToPipeableStream, type PipeableStream } from 'react-dom/server';
import { Writable } from 'stream';
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

    const { pipe, abort }: PipeableStream = renderToPipeableStream(
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

          const encoder = new TextEncoder();
          const chunks: Uint8Array[] = [
            encoder.encode(
              `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
            ),
          ];

          const writable = new Writable({
            write(chunk: Buffer, _encoding: string, callback: () => void) {
              chunks.push(new Uint8Array(chunk));
              callback();
            },
            final(callback: () => void) {
              chunks.push(encoder.encode('</div></body></html>'));
              callback();

              const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
              const merged = new Uint8Array(totalLength);
              let offset = 0;

              for (const chunk of chunks) {
                merged.set(chunk, offset);
                offset += chunk.length;
              }

              resolve(
                new Response(merged, {
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
