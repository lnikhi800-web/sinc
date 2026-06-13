/**
 * SINC: Razorpay Webhook Handler
 * POST /api/razorpay-webhook
 * Handles: payment.captured, subscription.charged, payment.failed
 */

import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import crypto from 'crypto';
import { getSupabaseAdmin } from '~/lib/auth.server';

const PLAN_LIMITS: Record<string, { promptLimit: number; plan: string }> = {
  pro: { promptLimit: 200, plan: 'pro' },
  elite: { promptLimit: 999999, plan: 'elite' },
};

function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const signature = request.headers.get('X-Razorpay-Signature') || '';
  const rawBody = await request.text();

  // Verify webhook signature
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    console.warn('[SINC Webhook] Invalid signature');
    return json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const { event: eventType, payload } = event;

  console.log('[SINC Webhook] Event:', eventType);

  try {
    const supabase = getSupabaseAdmin();

    if (eventType === 'payment.captured') {
      const payment = payload.payment?.entity;

      if (!payment) {
        return json({ status: 'ok' });
      }

      const userId = payment.notes?.userId;
      const plan = payment.notes?.plan as string;

      if (!userId || !plan || !PLAN_LIMITS[plan]) {
        console.error('[SINC Webhook] Missing userId or plan in payment notes');
        return json({ status: 'ok' });
      }

      const { promptLimit, plan: planName } = PLAN_LIMITS[plan];

      // Calculate expiry (30 days from now)
      const planExpiresAt = new Date();
      planExpiresAt.setDate(planExpiresAt.getDate() + 30);

      // Upgrade user profile
      await supabase
        .from('profiles')
        .update({
          plan: planName,
          prompt_limit: promptLimit,
          prompt_count: 0, // Reset count on upgrade
          plan_expires_at: planExpiresAt.toISOString(),
        })
        .eq('id', userId);

      // Log transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          razorpay_payment_id: payment.id,
          razorpay_order_id: payment.order_id,
          amount: payment.amount,
          currency: payment.currency,
          plan: planName,
          status: 'captured',
        });

      console.log(`[SINC Webhook] ✅ Upgraded user ${userId} to ${planName}`);
    }

    if (eventType === 'payment.failed') {
      const payment = payload.payment?.entity;
      console.warn('[SINC Webhook] Payment failed:', payment?.id);

      // Could send email notification here
    }
  } catch (error: any) {
    console.error('[SINC Webhook] Error:', error.message);
    return json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return json({ status: 'ok' });
}
