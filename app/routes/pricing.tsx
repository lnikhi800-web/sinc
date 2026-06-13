/**
 * SINC: Pricing Page
 * Route: /pricing
 */

import { useState } from 'react';
import { Link } from '@remix-run/react';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    period: 'forever',
    prompts: '10 prompts/month',
    model: 'Gemini 2.0 Flash',
    color: '#888',
    features: [
      '10 AI prompts per month',
      'React + Vite app generation',
      'Live preview via Supabase',
      'Download source code',
      'Community support',
    ],
    cta: 'Get Started',
    ctaLink: '/auth',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹499',
    period: '/month',
    prompts: '200 prompts/month',
    model: 'DeepSeek V3 / Claude Haiku',
    color: '#7B5FFF',
    features: [
      '200 AI prompts per month',
      'React + Vite + Tailwind generation',
      'Live preview + shareable URL',
      'Download & export source code',
      'Priority AI model routing',
      'Email support',
    ],
    cta: 'Upgrade to Pro',
    ctaAction: 'pro',
    highlight: true,
  },
  {
    id: 'elite',
    name: 'Elite',
    price: '₹1,299',
    period: '/month',
    prompts: 'Unlimited prompts',
    model: 'Claude 3.5 / GPT-4o / Gemini Pro',
    color: '#C9956A',
    features: [
      'Unlimited AI prompts',
      'All frameworks supported',
      'Best AI models available',
      'Priority build queue',
      'Custom domain preview',
      'Dedicated support',
    ],
    cta: 'Go Elite',
    ctaAction: 'elite',
    highlight: false,
  },
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

async function initiatePayment(plan: 'pro' | 'elite') {
  try {
    const res = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = '/auth';
        return;
      }

      const err = await res.json();
      throw new Error(err.error || 'Payment failed');
    }

    const { orderId, amount, currency, key } = await res.json();

    const options = {
      key,
      amount,
      currency,
      name: 'SINC',
      description: `SINC ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
      image: '/sinc-logo.png',
      order_id: orderId,
      handler: function () {
        window.location.href = '/?upgraded=true';
      },
      prefill: {
        name: '',
        email: '',
      },
      theme: {
        color: '#7B5FFF',
      },
      modal: {
        ondismiss: function () {
          console.log('[SINC] Payment dismissed');
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch (err: any) {
    alert('Payment error: ' + err.message);
  }
}

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handlePlanClick(planId: string) {
    if (planId === 'free') return;

    setLoadingPlan(planId);

    // Load Razorpay script dynamically
    if (!window.Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Razorpay'));
        document.head.appendChild(script);
      });
    }

    await initiatePayment(planId as 'pro' | 'elite');
    setLoadingPlan(null);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000000',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(123,95,255,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Grid */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(123,95,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(123,95,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative', zIndex: 10 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/sinc-logo.png" alt="SINC" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: 18, letterSpacing: '0.15em', background: 'linear-gradient(135deg, #A78BFA, #60D4F5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>SINC</span>
        </Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/auth" style={{ padding: '8px 18px', background: 'rgba(123,95,255,0.15)', border: '1px solid rgba(123,95,255,0.3)', borderRadius: 10, color: '#A78BFA', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Sign In</Link>
          <Link to="/" style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #7B5FFF, #5B3FDF)', borderRadius: 10, color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Try Free</Link>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px', position: 'relative', zIndex: 10 }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(123,95,255,0.12)', border: '1px solid rgba(123,95,255,0.3)', borderRadius: 100, padding: '6px 16px', fontSize: 12, color: '#A78BFA', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 20 }}>
            ⚡ Simple, transparent pricing
          </div>
          <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, lineHeight: 1.15, marginBottom: 16 }}>
            Build More,{' '}
            <span style={{ background: 'linear-gradient(135deg, #A78BFA, #7B5FFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Pay Less</span>
          </h1>
          <p style={{ color: '#888', fontSize: 18, maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            Start free. Upgrade when you're ready. Cancel anytime. No hidden fees.
          </p>
        </div>

        {/* Plans */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                background: plan.highlight ? 'rgba(123,95,255,0.08)' : 'rgba(14,14,28,0.8)',
                border: `1px solid ${plan.highlight ? 'rgba(123,95,255,0.5)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 20,
                padding: 28,
                position: 'relative',
                backdropFilter: 'blur(12px)',
                boxShadow: plan.highlight ? '0 0 40px rgba(123,95,255,0.15)' : 'none',
                transform: plan.highlight ? 'scale(1.02)' : 'scale(1)',
                transition: 'transform 0.2s',
              }}
            >
              {plan.highlight && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #7B5FFF, #5B3FDF)', borderRadius: 100, padding: '4px 16px', fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', fontFamily: 'Space Grotesk, sans-serif' }}>
                  MOST POPULAR
                </div>
              )}

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: plan.color, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 36, fontWeight: 900, color: '#fff' }}>{plan.price}</span>
                  <span style={{ color: '#555', fontSize: 14 }}>{plan.period}</span>
                </div>
                <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>{plan.prompts} · {plan.model}</div>
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0' }} />

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#ccc' }}>
                    <span style={{ color: plan.color, fontSize: 16 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {plan.ctaLink ? (
                <Link
                  to={plan.ctaLink}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '13px 16px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: '#fff',
                    textDecoration: 'none',
                    textAlign: 'center',
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: 'Space Grotesk, sans-serif',
                    boxSizing: 'border-box',
                  }}
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  onClick={() => handlePlanClick(plan.id)}
                  disabled={loadingPlan === plan.id}
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    background: plan.highlight ? 'linear-gradient(135deg, #7B5FFF, #5B3FDF)' : `linear-gradient(135deg, ${plan.color}22, ${plan.color}11)`,
                    border: `1px solid ${plan.color}55`,
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: 'Space Grotesk, sans-serif',
                    cursor: loadingPlan ? 'not-allowed' : 'pointer',
                    boxShadow: plan.highlight ? '0 0 24px rgba(123,95,255,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {loadingPlan === plan.id ? '⏳ Loading...' : plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div style={{ textAlign: 'center', marginTop: 64, color: '#555', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
            <span>🔒 Secured by Razorpay</span>
            <span>🇮🇳 UPI / Cards / Netbanking</span>
            <span>💳 Cancel anytime</span>
            <span>⚡ Instant activation</span>
          </div>
        </div>
      </main>
    </div>
  );
}
