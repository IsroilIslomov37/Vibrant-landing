'use client';

import { useSite } from '@/components/providers/site-provider';
import { Reveal, SectionShell } from '@/components/site/section';
import { Icon } from '@/components/ui/icon';
import { useCountUp, useTilt } from '@/hooks/use-animations';
import type { FeatureItem, StatItem } from '@/lib/types';
import { cn } from '@/lib/utils';

const ACCENT_RING: Record<string, string> = {
  brand: 'from-brand-500/25 to-brand-500/0 text-brand-400',
  aqua: 'from-aqua-500/25 to-aqua-500/0 text-aqua-400',
  sun: 'from-sun-500/25 to-sun-500/0 text-sun-400',
  rose: 'from-rose-500/25 to-rose-500/0 text-rose-400',
};

function StatCard({ stat }: { stat: StatItem }) {
  const { tx } = useSite();
  const { ref, value } = useCountUp(stat.value);
  // Fractional targets (an average band of 7.0) must not render as "7.0.0".
  const isFractional = stat.suffix.startsWith('.');
  const display = isFractional ? Math.round(value) : Math.round(value).toLocaleString('ru-RU');

  return (
    <div
      ref={ref}
      className="surface-card relative overflow-hidden p-6 text-center transition-shadow duration-300 hover:shadow-glow"
    >
      <div className="absolute inset-x-0 -top-16 h-32 bg-brand-500/10 blur-3xl" aria-hidden />
      <span className="relative mx-auto mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/12 text-brand-400">
        <Icon name={stat.icon} className="h-5 w-5" />
      </span>
      <p className="relative font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {display}
        <span className="gradient-text">{stat.suffix}</span>
      </p>
      <p className="relative mt-1.5 text-sm text-muted-foreground">{tx(stat.label)}</p>
    </div>
  );
}

function FeatureCard({ feature, index }: { feature: FeatureItem; index: number }) {
  const { tx } = useSite();
  const tiltRef = useTilt<HTMLDivElement>(8);

  return (
    <Reveal delay={Math.min(index, 5) * 60} className="h-full perspective-1000">
      <article
        ref={tiltRef}
        className="preserve-3d surface-card group relative h-full overflow-hidden p-6 transition-shadow duration-300 hover:shadow-glow-lg"
        style={{ transform: 'rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))' }}
      >
        {/* Cursor-tracking sheen */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(320px circle at var(--pointer-x, 50%) var(--pointer-y, 50%), hsl(var(--primary) / 0.10), transparent 70%)',
          }}
          aria-hidden
        />
        <span
          className={cn(
            'relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ring-1 ring-inset ring-white/10',
            ACCENT_RING[feature.accent] ?? ACCENT_RING.brand,
          )}
        >
          <Icon name={feature.icon} className="h-5 w-5" />
        </span>
        <h3 className="relative mt-5 font-display text-lg font-semibold tracking-tight">
          {tx(feature.title)}
        </h3>
        <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
          {tx(feature.description)}
        </p>
      </article>
    </Reveal>
  );
}

export function MethodologySection() {
  const { content, tx } = useSite();
  const { features, stats, steps } = content.methodology;

  return (
    <SectionShell
      id="methodology"
      eyebrow={tx(content.methodology.eyebrow)}
      title={tx(content.methodology.title)}
      subtitle={tx(content.methodology.subtitle)}
      className="bg-muted/30"
    >
      {/* Stats */}
      <div className="mb-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Reveal key={stat.id} delay={index * 80}>
            <StatCard stat={stat} />
          </Reveal>
        ))}
      </div>

      {/* Feature grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => (
          <FeatureCard key={feature.id} feature={feature} index={index} />
        ))}
      </div>

      {/* Process */}
      <div className="mt-16">
        <ol className="relative grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Connecting rail, desktop only */}
          <span
            className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
            aria-hidden
          />
          {steps.map((step, index) => (
            <Reveal key={step.id} delay={index * 90}>
              <li className="relative">
                <span className="relative z-10 mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-border bg-card font-display text-lg font-semibold shadow-card">
                  <span className="gradient-text">{String(index + 1).padStart(2, '0')}</span>
                </span>
                <h3 className="font-display text-base font-semibold tracking-tight">{tx(step.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {tx(step.description)}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </SectionShell>
  );
}
