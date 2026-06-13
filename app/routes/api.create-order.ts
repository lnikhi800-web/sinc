/**
 * SINC: Razorpay Create Order
 * POST /api/create-order
 * Body: { plan: 'pro' | 'elite' }
 * Returns: { orderId, amount, currency, key }
 */

import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import Razorpay from 'razorpay';
import { getUserFromRequest } from '~/lib/auth.server';

const PLAN_AMOUNTS: Record<string, number> = {
  pro: 49900,    // ₹499 in paise
  elite: 129900, // ₹1299 in paise
};

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { plan } = await request.json<{ plan: 'pro' | 'elite' }>();

  if (!plan || !PLAN_AMOUNTS[plan]) {
    return json({ error: 'Invalid plan' }, { status: 400 });
  }

  try {
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: PLAN_AMOUNTS[plan],
      currency: 'INR',
      receipt: `sinc_${user.id}_${plan}_${Date.now()}`,
      notes: {
        userId: user.id,
        plan,
        email: user.email || '',
      },
    });

    return json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID || '',
      plan,
    });
  } catch (error: any) {
    console.error('[SINC Razorpay] Order creation failed:', error);
    return json({ error: 'Payment initialization failed' }, { status: 500 });
  }
}
