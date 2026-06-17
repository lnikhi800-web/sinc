import { type AppLoadContext } from '@remix-run/node';

declare module '@remix-run/node' {
  interface AppLoadContext {
    env?: Env;
    cloudflare?: {
      env: Env;
    };
  }
}
