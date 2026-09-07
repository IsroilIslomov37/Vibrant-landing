'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/field';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.status === 429) {
        const body = await response.json();
        setError(`Слишком много попыток. Повторите через ${Math.ceil((body.retryAfter ?? 60) / 60)} мин.`);
        return;
      }
      if (!response.ok) {
        setError('Неверный пароль.');
        return;
      }

      const from = searchParams.get('from');
      router.replace(from && from.startsWith('/admin') ? from : '/admin');
      router.refresh();
    } catch {
      setError('Сервер недоступен. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-4xl border border-white/10 bg-white/[0.04] p-7 shadow-glow-lg backdrop-blur-2xl">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow">
          <LockKeyhole className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="font-display text-xl font-semibold tracking-tight text-white">
          Панель управления
        </h1>
        <p className="mt-1.5 text-sm text-white/55">Vibrant School CMS</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="admin-password" className="text-white/80">
            Пароль
          </Label>
          <div className="relative">
            <Input
              id="admin-password"
              type={reveal ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
              aria-invalid={Boolean(error)}
              className="border-white/15 bg-white/5 pr-11 text-white placeholder:text-white/35"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setReveal((value) => !value)}
              aria-label={reveal ? 'Скрыть пароль' : 'Показать пароль'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/50 transition hover:text-white"
            >
              {reveal ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          <FieldError>{error}</FieldError>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting ? 'Проверяем…' : 'Войти'}
        </Button>
      </form>

      <div className="mt-6 border-t border-white/10 pt-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-white/45 transition hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Вернуться на сайт
        </Link>
        {process.env.NODE_ENV !== 'production' ? (
          <p className="mt-3 rounded-xl bg-white/5 p-3 text-[0.7rem] leading-relaxed text-white/45">
            Пароль по умолчанию для разработки — <code className="text-white/70">vibrant2026</code>. Задайте
            <code className="mx-1 text-white/70">ADMIN_PASSWORD</code> и
            <code className="mx-1 text-white/70">ADMIN_SECRET</code> в <code className="text-white/70">.env.local</code>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
