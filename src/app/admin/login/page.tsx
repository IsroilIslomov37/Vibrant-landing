import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/admin/login-form';

export const metadata: Metadata = { title: 'Вход в панель управления', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-slate-950 px-5 py-12">
      {/* Ambient backdrop echoing the landing page's hero. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#1e1b52_0%,#0a0c22_55%,#05060f_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(109,91,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(109,91,255,0.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />
      <div className="relative w-full max-w-sm">
        {/* useSearchParams needs a boundary even on a dynamic route. */}
        <Suspense fallback={<div className="h-96 animate-pulse rounded-4xl bg-white/5" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
