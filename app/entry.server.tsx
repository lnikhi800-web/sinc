import type { AppLoadContext } from '@remix-run/node';
import { createReadableStreamFromReadable } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { PassThrough } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

const ABORT_DELAY = 5_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  _loadContext: AppLoadContext,
) {
  return isbot(request.headers.get('user-agent') || '')
    ? handleBotRequest(request, responseStatusCode, responseHeaders, remixContext)
    : handleBrowserRequest(request, responseStatusCode, responseHeaders, remixContext);
}

function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const body = new PassThrough();

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />,
      {
        onAllReady() {
          shellRendered = true;
          const head = renderHeadToString({ request, remixContext, Head });

          body.write(
            `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
          );

          const reactStream = new PassThrough();
          pipe(reactStream);
          reactStream.pipe(body, { end: false });
          reactStream.on('end', () => {
            body.write('</div></body></html>');
            body.end();
          });

          responseHeaders.set('Content-Type', 'text/html');
          responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
          responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

          const stream = createReadableStreamFromReadable(body);
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const body = new PassThrough();

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />,
      {
        onShellReady() {
          shellRendered = true;
          const head = renderHeadToString({ request, remixContext, Head });

          body.write(
            `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
          );

          const reactStream = new PassThrough();
          pipe(reactStream);
          reactStream.pipe(body, { end: false });
          reactStream.on('end', () => {
            body.write('</div></body></html>');
            body.end();
          });

          responseHeaders.set('Content-Type', 'text/html');
          responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
          responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

          const stream = createReadableStreamFromReadable(body);
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
