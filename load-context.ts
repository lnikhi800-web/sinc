import { type AppLoadContext } from '@remix-run/node';

declare module '@remix-run/node' {
  interface AppLoadContext {
    env: Record<string, string | undefined>;
  }
}
