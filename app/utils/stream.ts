import { ReadableStream } from 'node:stream/web';

/**
 * Converts a polyfilled/global ReadableStream (e.g. from web-streams-polyfill)
 * to a native Node.js web ReadableStream. This prevents type mismatches and brand-check
 * exceptions (like "not a ReadableStream") when interacting with native APIs on Vercel.
 */
export function toNativeWebStream(polyfilledStream: any): ReadableStream {
  const reader = polyfilledStream.getReader();
  
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
