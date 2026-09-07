'use client';

import { useState } from 'react';
import { ArrowRight, BadgeCheck, Play, Quote, Star } from 'lucide-react';
import { useSite } from '@/components/providers/site-provider';
import { Reveal, SectionShell } from '@/components/site/section';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import type { Review } from '@/lib/types';

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} / 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            'h-3.5 w-3.5',
            index < rating ? 'fill-sun-400 text-sun-400' : 'text-muted-foreground/35',
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  featured,
  onPlay,
}: {
  review: Review;
  featured: boolean;
  onPlay: (review: Review) => void;
}) {
  const { tx, ts } = useSite();

  return (
    <article
      className={cn(
        'surface-card group relative flex h-full flex-col overflow-hidden p-6 transition-shadow duration-300 hover:shadow-glow-lg',
        featured && 'lg:col-span-2',
      )}
    >
      <Quote
        className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 text-brand-500/[0.07]"
        aria-hidden
      />

      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br text-sm font-bold text-white',
              review.gradient,
            )}
          >
            {review.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={review.avatar} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              review.initials
            )}
          </span>
          <div className="leading-tight">
            <p className="font-semibold">{review.author}</p>
            <p className="text-xs text-muted-foreground">{tx(review.authorRole)}</p>
          </div>
        </div>
        <Stars rating={review.rating} />
      </header>

      <blockquote className="relative mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
        “{tx(review.quote)}”
      </blockquote>

      <footer className="mt-5 space-y-4">
        {review.metric ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/40 p-3">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {tx(review.metric.label)}
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="truncate text-muted-foreground line-through decoration-muted-foreground/40">
                  {review.metric.before}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand-400" aria-hidden />
                <span className="truncate font-semibold gradient-text">{review.metric.after}</span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <BadgeCheck className="h-4 w-4" aria-hidden />
            {ts('reviews.verified')}
          </span>

          {review.videoUrl ? (
            <button
              type="button"
              onClick={() => onPlay(review)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:border-brand-400 hover:text-brand-400"
            >
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
              {ts('reviews.watch')}
            </button>
          ) : null}
        </div>
      </footer>
    </article>
  );
}

export function ReviewsSection() {
  const { content, tx, ts } = useSite();
  const [playing, setPlaying] = useState<Review | null>(null);

  const reviews = content.reviews.items
    .filter((review) => review.published)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.order - b.order);

  if (reviews.length === 0) return null;

  return (
    <>
      <SectionShell
        id="reviews"
        eyebrow={tx(content.reviews.eyebrow)}
        title={tx(content.reviews.title)}
        subtitle={tx(content.reviews.subtitle)}
        className="bg-muted/30"
      >
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, index) => (
            <Reveal
              key={review.id}
              delay={Math.min(index, 5) * 70}
              className={cn('h-full', review.featured && index === 0 && 'lg:col-span-2')}
            >
              <ReviewCard review={review} featured={false} onPlay={setPlaying} />
            </Reveal>
          ))}
        </div>
      </SectionShell>

      <Modal
        open={Boolean(playing)}
        onClose={() => setPlaying(null)}
        size="xl"
        bare
        closeLabel={ts('a11y.closeModal')}
      >
        {playing?.videoUrl ? (
          <div className="aspect-video w-full overflow-hidden rounded-t-4xl bg-black sm:rounded-4xl">
            <iframe
              src={playing.videoUrl}
              title={`${playing.author} — ${tx(playing.authorRole)}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        ) : null}
        <div className="p-6">
          <p className="font-semibold">{playing?.author}</p>
          <p className="text-sm text-muted-foreground">{playing ? tx(playing.authorRole) : null}</p>
        </div>
      </Modal>
    </>
  );
}
