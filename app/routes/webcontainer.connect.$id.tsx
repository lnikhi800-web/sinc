// SINC: WebContainer connect stub — not used, WebContainers removed
import { json } from '@remix-run/cloudflare';

export async function loader() {
  return json({ status: 'sinc-static-preview' });
}

export default function ConnectStub() {
  return null;
}
