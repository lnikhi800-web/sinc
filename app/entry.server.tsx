import type { AppLoadContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { PassThrough } from 'node:stream';
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

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />,
      {
        [isbot(userAgent ?? '') ? 'onAllReady' : 'onShellReady']() {
          responseHeaders.set('Content-Type', 'text/html');
          responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
          responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

          const body = new PassThrough();
          const encoder = new TextEncoder();

          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
                ),
              );
              body.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
              body.on('end', () => {
                controller.enqueue(encoder.encode('</div></body></html>'));
                controller.close();
              });
              body.on('error', (err) => controller.error(err));
            },
          });

          pipe(body);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: didError ? 500 : statusCode,
            }),
          );
        },
        onShellError(error: unknown) {
          reject(error);
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
