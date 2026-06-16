import { json, type ActionFunction } from '@remix-run/cloudflare';

export const action: ActionFunction = async ({ request }) => {
  const text = await request.text();
  console.log('\n================ BROWSER DIAGNOSTIC LOG ================\n', text, '\n=======================================================\n');
  return json({ success: true });
};
