'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Github, Globe, Linkedin, Send } from 'lucide-react';
import { useSite } from '@/components/providers/site-provider';
import { SectionShell } from '@/components/site/section';
import { cn } from '@/lib/utils';
import type { Mentor } from '@/lib/types';

const SOCIAL_ICONS = {
  telegram: Send,
  linkedin: Linkedin,
  github: Github,
  website: Globe,
} as const;

function MentorCard({ mentor }: { mentor: Mentor }) {
  const { tx, ts } = useSite();

  return (
    <article className="surface-card group flex h-full w-[19rem] shrink-0 snap-center flex-col overflow-hidden transition-shadow duration-300 hover:shadow-glow-lg sm:w-[21rem]">
      <div className={cn('relative h-44 overflow-hidden bg-gradient-to-br', mentor.gradient)}>
        {mentor.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mentor.avatar}
            alt={mentor.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center font-display text-5xl font-bold text-white/85">
            {mentor.initials}
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card/90 via-transparent to-transparent" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold tracking-tight">{mentor.name}</h3>
        <p className="mt-0.5 text-sm font-medium text-brand-400">{tx(mentor.role)}</p>
        <p className="mt-3 line-clamp-4 flex-1 text-sm leading-relaxed text-muted-foreground">
          {tx(mentor.bio)}
        </p>

        <ul className="mt-4 flex flex-wrap gap-1.5">
          {mentor.qualifications.map((qualification, index) => (
            <li
              key={index}
              className="rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
            >
              {tx(qualification)}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
          <dl className="flex gap-4 text-xs text-muted-foreground">
            <div>
              <dt className="sr-only">{ts('mentors.years')}</dt>
              <dd>
                <strong className="font-display text-base text-foreground">{mentor.yearsExperience}</strong>{' '}
                {ts('mentors.years')}
              </dd>
            </div>
            <div>
              <dt className="sr-only">{ts('mentors.students')}</dt>
              <dd>
                <strong className="font-display text-base text-foreground">{mentor.studentsTaught}</strong>{' '}
                {ts('mentors.students')}
              </dd>
            </div>
          </dl>

          <div className="flex gap-1">
            {(Object.keys(SOCIAL_ICONS) as (keyof typeof SOCIAL_ICONS)[]).map((key) => {
              const href = mentor.socials[key];
              if (!href) return null;
              const SocialIcon = SOCIAL_ICONS[key];
              return (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${mentor.name} — ${key}`}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-brand-400"
                >
                  <SocialIcon className="h-4 w-4" aria-hidden />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}

export function MentorsSection() {
  const { content, tx, ts } = useSite();
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const mentors = content.mentors.items
    .filter((mentor) => mentor.published)
    .sort((a, b) => a.order - b.order);

  const syncEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setAtStart(track.scrollLeft < 8);
    setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 8);
  }, []);

  useEffect(() => {
    syncEdges();
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener('scroll', syncEdges, { passive: true });
    window.addEventListener('resize', syncEdges);
    return () => {
      track.removeEventListener('scroll', syncEdges);
      window.removeEventListener('resize', syncEdges);
    };
  }, [syncEdges, mentors.length]);

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('article');
    const step = card ? card.clientWidth + 20 : track.clientWidth * 0.8;
    track.scrollBy({ left: step * direction, behavior: 'smooth' });
  };

  if (mentors.length === 0) return null;

  return (
    <SectionShell
      id="mentors"
      eyebrow={tx(content.mentors.eyebrow)}
      title={tx(content.mentors.title)}
      subtitle={tx(content.mentors.subtitle)}
      headerAside={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={atStart}
            aria-label={ts('mentors.prev')}
            className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-foreground transition-all hover:border-brand-400 hover:text-brand-400 disabled:opacity-35 disabled:hover:border-border disabled:hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={atEnd}
            aria-label={ts('mentors.next')}
            className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-foreground transition-all hover:border-brand-400 hover:text-brand-400 disabled:opacity-35 disabled:hover:border-border disabled:hover:text-foreground"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      }
    >
      <div
        ref={trackRef}
        // The carousel is a plain scroll container: keyboard, trackpad, touch and
        // screen-reader navigation all work without a single custom handler.
        tabIndex={0}
        role="region"
        aria-label={tx(content.mentors.title)}
        className="no-scrollbar mask-fade-x -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 sm:mx-0 sm:px-0"
      >
        {mentors.map((mentor) => (
          <MentorCard key={mentor.id} mentor={mentor} />
        ))}
      </div>
    </SectionShell>
  );
}
