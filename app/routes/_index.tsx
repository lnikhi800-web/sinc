/**
 * SINC: Landing Page
 * Route: / (index) — shows landing if not logged in, app if logged in
 */

import { useEffect, useState, useRef } from 'react';
import { Link } from '@remix-run/react';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

const features = [
  { icon: '⚡', title: 'AI Builds in Seconds', desc: 'Describe your app in plain English. SINC writes complete React + Vite code instantly.' },
  { icon: '👁️', title: 'Live Preview', desc: 'See your app running live immediately. Share a real URL with anyone.' },
  { icon: '📦', title: 'Full Code Export', desc: 'Download your complete source code. No lock-in. Real production-ready React projects.' },
  { icon: '🔒', title: 'Private & Secure', desc: 'Your code is yours. We never sell or train on your project data.' },
  { icon: '🤖', title: 'Multi-Model AI', desc: 'Routes to the best AI model for your task — Gemini, DeepSeek, Claude, and more.' },
  { icon: '🚀', title: 'Deploy Instantly', desc: 'One-click deploy. Your app is live in minutes, not days.' },
];

const stats = [
  { value: '<10s', label: 'Generation time' },
  { value: '500+', label: 'AI Models' },
  { value: '₹0', label: 'To start' },
  { value: '99.9%', label: 'Uptime' },
];

const landingStyles = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes spin-reverse {
    from { transform: rotate(360deg); }
    to { transform: rotate(0deg); }
  }
  @keyframes scan {
    0% { top: -5%; }
    50% { top: 105%; }
    100% { top: -5%; }
  }
  @keyframes tech-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @keyframes marquee-scroll {
    0% { transform: translate3d(0, 0, 0); }
    100% { transform: translate3d(-50%, 0, 0); }
  }

  .sinc-top-banner {
    background: rgba(201, 149, 106, 0.05);
    border-bottom: 1px solid rgba(201, 149, 106, 0.18);
    padding: 10px 0;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.08em;
    overflow: hidden;
    position: relative;
    z-index: 100;
    width: 100%;
    box-shadow: 0 1px 15px rgba(201, 149, 106, 0.03);
  }

  .sinc-top-banner-container {
    display: flex;
    white-space: nowrap;
    width: max-content;
  }

  .sinc-top-banner-text {
    background: linear-gradient(135deg, #E8B88A, #C9956A);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    padding: 0 40px;
    display: inline-block;
  }

  @media (min-width: 641px) {
    .sinc-top-banner-container {
      margin: 0 auto;
      justify-content: center;
      width: 100%;
    }
    .sinc-top-banner-text:last-child {
      display: none !important;
    }
  }

  @media (max-width: 640px) {
    .sinc-top-banner-container {
      animation: marquee-scroll 18s linear infinite;
    }
  }

  .sinc-logo-container {
    position: relative;
    width: 380px;
    height: 380px;
    margin: 0 auto 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sinc-logo-card {
    width: 250px;
    height: 250px;
    cursor: pointer;
    border-radius: 60px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(8, 8, 16, 0.88);
    border: 1.5px solid rgba(123, 95, 255, 0.45);
    transform-style: preserve-3d;
    transition: box-shadow 0.3s ease, border-color 0.3s ease, transform 0.5s cubic-bezier(0.25, 1, 0.5, 1);
    overflow: hidden;
  }

  .sinc-logo-card.hovered {
    box-shadow: 0 40px 80px -15px rgba(123, 95, 255, 0.75), 
                0 0 60px rgba(96, 212, 245, 0.45), 
                inset 0 0 30px rgba(255, 255, 255, 0.25);
    border-color: rgba(96, 212, 245, 0.7);
  }

  .sinc-logo-card.normal {
    box-shadow: 0 20px 45px -10px rgba(123, 95, 255, 0.45), 
                0 0 35px rgba(123, 95, 255, 0.2), 
                inset 0 0 12px rgba(255, 255, 255, 0.1);
  }

  .sinc-ring-outer {
    position: absolute;
    inset: -52px;
    border-radius: 50%;
    border: 1.5px dashed rgba(123, 95, 255, 0.35);
    animation: spin 30s linear infinite;
    pointer-events: none;
    transition: border-color 0.3s, opacity 0.3s;
  }
  .sinc-logo-container:hover .sinc-ring-outer {
    border-color: rgba(123, 95, 255, 0.65);
    border-width: 2px;
  }

  .sinc-ring-middle {
    position: absolute;
    inset: -34px;
    border-radius: 50%;
    border: 1.2px dotted rgba(96, 212, 245, 0.3);
    animation: spin-reverse 20s linear infinite;
    pointer-events: none;
  }
  .sinc-logo-container:hover .sinc-ring-middle {
    border-color: rgba(96, 212, 245, 0.6);
  }

  .sinc-ring-inner {
    position: absolute;
    inset: -16px;
    border-radius: 50%;
    border: 2px solid rgba(244, 63, 94, 0.12);
    border-top-color: rgba(244, 63, 94, 0.5);
    border-bottom-color: rgba(244, 63, 94, 0.5);
    animation: spin 10s linear infinite;
    pointer-events: none;
  }
  .sinc-logo-container:hover .sinc-ring-inner {
    border-top-color: rgba(244, 63, 94, 0.85);
    border-bottom-color: rgba(244, 63, 94, 0.85);
  }

  .sinc-hud-label {
    position: absolute;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 9px;
    letter-spacing: 0.18em;
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    transition: color 0.3s, opacity 0.3s;
    pointer-events: none;
  }
  .sinc-logo-container:hover .sinc-hud-label {
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 0 8px rgba(96, 212, 245, 0.4);
  }

  .sinc-hud-tl { top: -20px; left: -20px; }
  .sinc-hud-tr { top: -20px; right: -20px; }
  .sinc-hud-bl { bottom: -20px; left: -20px; }
  .sinc-hud-br { bottom: -20px; right: -20px; }

  .sinc-hud-bracket {
    position: absolute;
    width: 24px;
    height: 24px;
    transition: all 0.35s cubic-bezier(0.25, 1, 0.5, 1);
    pointer-events: none;
    z-index: 10;
  }
  .sinc-bracket-tl {
    top: -30px;
    left: -30px;
    border-left: 2px solid rgba(123, 95, 255, 0.4);
    border-top: 2px solid rgba(123, 95, 255, 0.4);
  }
  .sinc-bracket-tr {
    top: -30px;
    right: -30px;
    border-right: 2px solid rgba(123, 95, 255, 0.4);
    border-top: 2px solid rgba(123, 95, 255, 0.4);
  }
  .sinc-bracket-bl {
    bottom: -30px;
    left: -30px;
    border-left: 2px solid rgba(123, 95, 255, 0.4);
    border-bottom: 2px solid rgba(123, 95, 255, 0.4);
  }
  .sinc-bracket-br {
    bottom: -30px;
    right: -30px;
    border-right: 2px solid rgba(123, 95, 255, 0.4);
    border-bottom: 2px solid rgba(123, 95, 255, 0.4);
  }

  .sinc-logo-container:hover .sinc-bracket-tl {
    transform: translate(-6px, -6px);
    border-color: rgba(96, 212, 245, 0.85);
  }
  .sinc-logo-container:hover .sinc-bracket-tr {
    transform: translate(6px, -6px);
    border-color: rgba(96, 212, 245, 0.85);
  }
  .sinc-logo-container:hover .sinc-bracket-bl {
    transform: translate(-6px, 6px);
    border-color: rgba(96, 212, 245, 0.85);
  }
  .sinc-logo-container:hover .sinc-bracket-br {
    transform: translate(6px, 6px);
    border-color: rgba(96, 212, 245, 0.85);
  }

  @media (max-width: 640px) {
    .sinc-logo-container {
      width: 280px;
      height: 280px;
      margin-bottom: 24px;
    }
    .sinc-logo-card {
      width: 190px;
      height: 190px;
      border-radius: 48px;
    }
    .sinc-ring-outer { inset: -35px; }
    .sinc-ring-middle { inset: -22px; }
    .sinc-ring-inner { inset: -10px; }
    .sinc-hud-label {
      display: none !important;
    }
    .sinc-hud-bracket {
      display: none !important;
    }
  }
`;

function FuturisticLogo() {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Mouse coordinates relative to card center
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;

    // Limit rotation angle (max 15 degrees)
    const rotateX = -(mouseY / (height / 2)) * 15;
    const rotateY = (mouseX / (width / 2)) * 15;

    setCoords({ x: rotateY, y: rotateX });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCoords({ x: 0, y: 0 });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const transformStyle = {
    transform: `perspective(1000px) rotateX(${coords.y}deg) rotateY(${coords.x}deg) scale(${isPressed ? 0.95 : isHovered ? 1.04 : 1})`,
    transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
  };

  // Telemetry status texts
  const [secStatus, setSecStatus] = useState("ACTIVE");
  useEffect(() => {
    if (!isHovered) return;
    const interval = setInterval(() => {
      const statuses = ["ACTIVE", "SYNCED", "STABLE", "OPTIMIZED"];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      setSecStatus(randomStatus);
    }, 3000);
    return () => clearInterval(interval);
  }, [isHovered]);

  return (
    <div className="sinc-logo-container" ref={containerRef}>
      
      {/* Outer scifi rings */}
      <div className="sinc-ring-outer" />
      <div className="sinc-ring-middle" />
      <div className="sinc-ring-inner" />

      {/* Sci-Fi HUD Corner Brackets */}
      <div className="sinc-hud-bracket sinc-bracket-tl" />
      <div className="sinc-hud-bracket sinc-bracket-tr" />
      <div className="sinc-hud-bracket sinc-bracket-bl" />
      <div className="sinc-hud-bracket sinc-bracket-br" />

      {/* HUD Telemetry Labels */}
      <div className="sinc-hud-label sinc-hud-tl">
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#4ade80', marginRight: 6, animation: 'tech-blink 1.5s infinite' }} />
        SYS_LOAD: {secStatus}
      </div>
      <div className="sinc-hud-label sinc-hud-tr">
        INTELLIGENCE: 100%
      </div>
      <div className="sinc-hud-label sinc-hud-bl">
        MODEL: MULTI_AI_v4
      </div>
      <div className="sinc-hud-label sinc-hud-br">
        GRID: SECURE
      </div>

      {/* Glow aura behind the card (parallax depth layer: translateZ(-25px)) */}
      <div style={{
        position: 'absolute',
        inset: -10,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(123,95,255,0.35) 0%, transparent 70%)',
        filter: 'blur(25px)',
        opacity: isHovered ? 1 : 0.45,
        transform: 'translateZ(-25px)',
        transition: 'opacity 0.3s, transform 0.3s',
        pointerEvents: 'none'
      }} />

      {/* Main card */}
      <div
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        className={`sinc-logo-card ${isHovered ? 'hovered' : 'normal'}`}
        style={transformStyle}
      >
        {/* Parallax Layer 1: Matrix grid backing */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(123,95,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(123,95,255,0.15) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          opacity: isHovered ? 0.35 : 0.15,
          borderRadius: 62,
          transform: 'translateZ(10px)',
          transition: 'opacity 0.3s',
          pointerEvents: 'none'
        }} />

        {/* Parallax Layer 2: Core Logo Image (floats at translateZ(45px)) */}
        <div style={{
          position: 'absolute',
          inset: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'translateZ(45px)',
          filter: isHovered ? 'drop-shadow(0 15px 30px rgba(123,95,255,0.55))' : 'none',
          transition: 'filter 0.3s',
          pointerEvents: 'none'
        }}>
          <img
            src="/sinc-logo.png"
            alt="SINC"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 48,
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          />
        </div>

        {/* Parallax Layer 3: Sweeping Sci-Fi Laser Scanline */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(96,212,245,0.6), transparent)',
          animation: 'scan 4s linear infinite',
          zIndex: 8,
          pointerEvents: 'none',
          transform: 'translateZ(55px)',
        }} />

        {/* Parallax Layer 4: Dynamic Holographic Cursor Glare */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle 200px at ${50 + coords.x * 3}% ${50 - coords.y * 3}%, rgba(255,255,255,0.2) 0%, transparent 80%)`,
          pointerEvents: 'none',
          zIndex: 9,
          mixBlendMode: 'overlay',
          transform: 'translateZ(65px)',
          borderRadius: 62
        }} />
      </div>
    </div>
  );
}

export default function IndexPage() {
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const supabase = getSupabase();

    if (supabase) {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s);
        setChecking(false);

        // If logged in, redirect to app (the existing bolt.diy chat interface)
        if (s) {
          // Don't redirect — let the bolt.diy Outlet handle the chat UI
        }
      });
    } else {
      setChecking(false);
    }
  }, []);

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.4 + 0.1,
    }));

    let animId: number;

    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas!.width) {
          p.vx *= -1;
        }

        if (p.y < 0 || p.y > canvas!.height) {
          p.vy *= -1;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(123,95,255,${p.opacity})`;
        ctx.fill();

        particles.forEach((p2) => {
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(123,95,255,${0.06 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(draw);
    }

    draw();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/sinc-logo.png" alt="SINC" style={{ width: 64, height: 64, borderRadius: 16, animation: 'pulse 2s infinite', boxShadow: '0 0 40px rgba(123,95,255,0.5)' }} />
          <div style={{ color: '#555', fontSize: 13, marginTop: 16, fontFamily: 'Space Grotesk, sans-serif' }}>Loading SINC...</div>
        </div>
      </div>
    );
  }

  // If logged in, show the bolt.diy chat UI directly (it renders via Outlet)
  if (session) {
    return null; // Let parent route handle
  }

  // Landing page for unauthenticated users
  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#fff', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: landingStyles }} />
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />

      {/* Top Banner (Bronze / Made in India announcement with marquee scroll on mobile) */}
      <div className="sinc-top-banner">
        <div className="sinc-top-banner-container">
          <span className="sinc-top-banner-text">⚡ Synchronized Intelligence &amp; Coding — Made in India 🇮🇳</span>
          <span className="sinc-top-banner-text">⚡ Synchronized Intelligence &amp; Coding — Made in India 🇮🇳</span>
        </div>
      </div>

      {/* Background glows */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(123,95,255,0.1) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(123,95,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(123,95,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0 }} />

      {/* Header */}
      <header style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid rgba(123,95,255,0.1)', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/sinc-logo.png" alt="SINC" style={{ width: 40, height: 40, borderRadius: 12, boxShadow: '0 0 20px rgba(123,95,255,0.4)' }} />
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20, letterSpacing: '0.15em', background: 'linear-gradient(135deg, #A78BFA, #60D4F5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>SINC</span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/pricing" style={{ color: '#888', textDecoration: 'none', fontSize: 14, fontFamily: 'Space Grotesk, sans-serif', transition: 'color 0.2s' }}>Pricing</Link>
          <Link to="/auth" style={{ padding: '8px 18px', background: 'rgba(123,95,255,0.15)', border: '1px solid rgba(123,95,255,0.3)', borderRadius: 10, color: '#A78BFA', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Sign In</Link>
          <Link to="/auth" style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #7B5FFF, #5B3FDF)', borderRadius: 10, color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600, boxShadow: '0 0 20px rgba(123,95,255,0.3)' }}>Start Free ⚡</Link>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: 'clamp(40px, 8vw, 80px) 24px 80px' }}>
        <FuturisticLogo />

        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 900, lineHeight: 1.12, marginBottom: 20, maxWidth: 1000, margin: '0 auto 20px' }}>
          Build Full Apps and Software<br />
          <span style={{ background: 'linear-gradient(135deg, #A78BFA, #7B5FFF, #60D4F5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>with SINC in Seconds</span>
        </h1>

        <p style={{ color: '#888', fontSize: 'clamp(16px, 2vw, 20px)', maxWidth: 620, margin: '0 auto 40px', lineHeight: 1.7 }}>
          Describe your software in plain English. SINC builds a complete React + Vite application, generates a live preview, and lets you download the code — instantly.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/auth" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 36px', background: 'linear-gradient(135deg, #7B5FFF, #5B3FDF)', borderRadius: 14, color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', boxShadow: '0 0 30px rgba(123,95,255,0.4)' }}>
            ⚡ Start Building — Free
          </Link>
          <Link to="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, color: '#ccc', textDecoration: 'none', fontSize: 16, fontFamily: 'Space Grotesk, sans-serif' }}>
            View Pricing →
          </Link>
        </div>
      </section>

      {/* App Preview mockup */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(123,95,255,0.25)', boxShadow: '0 0 80px rgba(123,95,255,0.12), 0 40px 80px rgba(0,0,0,0.6)', background: '#0e0e1c' }}>
          {/* Window chrome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#12121f', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FFBD2E' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
            <div style={{ flex: 1, height: 26, background: '#1a1a2e', borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 12, marginLeft: 8 }}>
              <span style={{ color: '#555', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>sinc.dev/workspace/my-app</span>
            </div>
          </div>
          {/* 3-panel workspace */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', height: 320 }}>
            {/* File tree */}
            <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', padding: 12, background: '#0a0a14' }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, fontFamily: 'Space Grotesk, sans-serif' }}>Files</div>
              {['src/', 'App.tsx', 'index.css', 'components/'].map((f, i) => (
                <div key={i} style={{ padding: '5px 8px', borderRadius: 6, fontSize: 12, color: i === 1 ? '#A78BFA' : '#555', background: i === 1 ? 'rgba(123,95,255,0.1)' : 'transparent', marginBottom: 2, fontFamily: 'Inter, sans-serif' }}>
                  {f.endsWith('/') ? '📁 ' : '📄 '}{f}
                </div>
              ))}
            </div>
            {/* Chat */}
            <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#555', fontFamily: 'Space Grotesk, sans-serif' }}>💬 AI Chat</div>
              <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
                <div style={{ alignSelf: 'flex-end', background: 'rgba(123,95,255,0.2)', border: '1px solid rgba(123,95,255,0.3)', borderRadius: '12px 12px 4px 12px', padding: '8px 12px', fontSize: 12, color: '#ddd', maxWidth: '80%' }}>
                  Build me a SaaS landing page with pricing
                </div>
                <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px 12px 12px 4px', padding: '8px 12px', fontSize: 12, color: '#aaa', maxWidth: '85%' }}>
                  <span style={{ color: '#A78BFA', fontWeight: 600 }}>SINC</span><br />
                  Building your SaaS landing page... ✨ Creating Hero, Features & Pricing sections
                </div>
              </div>
              <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#444', fontFamily: 'Inter, sans-serif' }}>
                  ⚡ Describe changes...
                </div>
              </div>
            </div>
            {/* Preview */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#555', fontFamily: 'Space Grotesk, sans-serif' }}>👁️ Live Preview</div>
              <div style={{ flex: 1, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', marginBottom: 8 }}>LaunchPad SaaS</div>
                  <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Scale your business with AI</div>
                  <div style={{ display: 'inline-block', background: '#7B5FFF', color: '#fff', fontSize: 12, padding: '8px 20px', borderRadius: 8 }}>Start Free Trial</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ position: 'relative', zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '48px 24px', background: 'rgba(14,14,28,0.4)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 36, background: 'linear-gradient(135deg, #A78BFA, #7B5FFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 4 }}>{s.value}</div>
              <div style={{ color: '#555', fontSize: 13, fontFamily: 'Space Grotesk, sans-serif' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, marginBottom: 12 }}>
            Built for{' '}
            <span style={{ background: 'linear-gradient(135deg, #C9956A, #E8B88A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Indian Builders</span>
          </h2>
          <p style={{ color: '#666', maxWidth: 480, margin: '0 auto' }}>Everything you need to go from idea to deployed app</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{ background: 'rgba(14,14,28,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24, backdropFilter: 'blur(8px)', transition: 'border-color 0.2s, transform 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(123,95,255,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 15, color: '#fff', marginBottom: 8 }}>{f.title}</div>
              <div style={{ color: '#666', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: 'relative', zIndex: 10, padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', background: 'linear-gradient(135deg, rgba(123,95,255,0.1), rgba(96,212,245,0.05))', border: '1px solid rgba(123,95,255,0.25)', borderRadius: 24, padding: 'clamp(40px, 6vw, 64px) 40px', backdropFilter: 'blur(12px)' }}>
          <img src="/sinc-logo.png" alt="SINC" style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 20, boxShadow: '0 0 30px rgba(123,95,255,0.5)' }} />
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 900, marginBottom: 12 }}>Ready to Build?</h2>
          <p style={{ color: '#888', fontSize: 16, marginBottom: 32, lineHeight: 1.6 }}>
            Join thousands of Indian developers building with SINC. Start free — no credit card required.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/auth" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', background: 'linear-gradient(135deg, #7B5FFF, #5B3FDF)', borderRadius: 12, color: '#fff', textDecoration: 'none', fontSize: 15, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', boxShadow: '0 0 24px rgba(123,95,255,0.4)' }}>
              ⚡ Start Free
            </Link>
            <Link to="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 24px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#ccc', textDecoration: 'none', fontSize: 15, fontFamily: 'Space Grotesk, sans-serif' }}>
              Pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.04)', padding: '32px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/sinc-logo.png" alt="SINC" style={{ width: 28, height: 28, borderRadius: 8 }} />
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: '0.12em', background: 'linear-gradient(135deg, #A78BFA, #60D4F5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>SINC</span>
            <span style={{ color: '#444', fontSize: 12 }}>Synchronized Intelligence &amp; Coding</span>
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#555' }}>
            <Link to="/pricing" style={{ color: '#555', textDecoration: 'none' }}>Pricing</Link>
            <a href="mailto:hello@sinc.dev" style={{ color: '#555', textDecoration: 'none' }}>Contact</a>
            <span>© 2025 SINC · Built in India 🇮🇳</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
