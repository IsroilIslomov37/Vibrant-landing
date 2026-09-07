'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, CalendarClock, Check, Clock, Search, Star, Users } from 'lucide-react';
import { useSite } from '@/components/providers/site-provider';
import { Reveal, SectionShell } from '@/components/site/section';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Modal } from '@/components/ui/modal';
import { useTilt } from '@/hooks/use-animations';
import type { Course, CourseCategoryId } from '@/lib/types';
import { cn, formatPrice } from '@/lib/utils';

const BADGE_TONE = {
  popular: 'sun',
  new: 'aqua',
  limited: 'rose',
  none: 'muted',
} as const;

function CourseCard({ course, onOpen }: { course: Course; onOpen: (course: Course) => void }) {
  const { tx, ts, locale, openApply } = useSite();
  const tiltRef = useTilt<HTMLDivElement>(7);
  const seatsLeft = Math.max(0, course.seats - course.seatsTaken);
  const fill = course.seats > 0 ? Math.min(100, (course.seatsTaken / course.seats) * 100) : 0;

  return (
    <div className="perspective-1000 h-full">
      <article
        ref={tiltRef}
        className="group preserve-3d surface-card relative flex h-full flex-col overflow-hidden transition-[transform,box-shadow] duration-300 ease-smooth hover:shadow-glow-lg"
        style={{ transform: 'rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))' }}
      >
        {/* Cover */}
        <div className={cn('relative h-40 overflow-hidden bg-gradient-to-br', course.gradient)}>
          {course.coverImage ? (
            // Admin-uploaded covers are data URLs or arbitrary remote links, so a
            // plain <img> avoids next/image's loader constraints here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.coverImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
          ) : null}
          <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_20%_0%,rgba(255,255,255,0.35),transparent_60%)] mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />

          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {course.badge !== 'none' ? (
              <Badge tone={BADGE_TONE[course.badge]} className="bg-white/90 text-slate-900 backdrop-blur">
                {course.badge === 'popular' ? <Star className="h-3 w-3 fill-current" aria-hidden /> : null}
                {ts(`courses.badge.${course.badge}` as 'courses.badge.popular')}
              </Badge>
            ) : null}
          </div>

          <span className="absolute bottom-3 left-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/85">
            {ts(`courses.level.${course.level}` as 'courses.level.beginner')}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold leading-snug tracking-tight">
            {tx(course.title)}
          </h3>
          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
            {tx(course.summary)}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="h-4 w-4 shrink-0 text-brand-400" aria-hidden />
              <dd>
                {course.durationMonths} {ts('courses.months')}
              </dd>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0 text-aqua-400" aria-hidden />
              <dd>
                {course.hoursPerWeek} {ts('courses.hoursWeek')}
              </dd>
            </div>
          </dl>

          {/* Seats */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" aria-hidden />
                {seatsLeft} {ts('courses.seatsLeft')}
              </span>
              <span>
                {course.seatsTaken}/{course.seats}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full bg-gradient-to-r transition-all duration-700',
                  fill > 85 ? 'from-rose-500 to-sun-500' : 'from-brand-500 to-aqua-500',
                )}
                style={{ width: `${fill}%` }}
              />
            </div>
          </div>

          {/* Price + actions */}
          {/* Stacks below ~420px: the price plus two nowrap buttons cannot shrink
              past ~410px, which is what pushed the card wider than its grid cell. */}
          <div className="mt-5 flex flex-col gap-3 border-t border-border/60 pt-5 xs:flex-row xs:items-end xs:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-display text-xl font-semibold tracking-tight">
                  {formatPrice(course.price, course.currency, locale)}
                </span>
                {course.oldPrice ? (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(course.oldPrice, course.currency, locale)}
                  </span>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">{ts('courses.perMonth')}</span>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" className="flex-1 xs:flex-none" onClick={() => onOpen(course)}>
                {ts('courses.details')}
              </Button>
              <Button size="sm" className="flex-1 xs:flex-none" onClick={() => openApply(course.id)}>
                {ts('courses.enroll')}
              </Button>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function CourseQuickView({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const { content, tx, ts, locale, openApply } = useSite();
  if (!course) return null;

  const mentors = content.mentors.items.filter((mentor) => course.mentorIds.includes(mentor.id));

  return (
    <Modal open={Boolean(course)} onClose={onClose} size="xl" bare closeLabel={ts('a11y.closeModal')}>
      <div className={cn('relative h-44 overflow-hidden bg-gradient-to-br sm:h-56', course.gradient)}>
        {course.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {course.badge !== 'none' ? (
              <Badge tone={BADGE_TONE[course.badge]}>
                {ts(`courses.badge.${course.badge}` as 'courses.badge.popular')}
              </Badge>
            ) : null}
            <Badge tone="muted">{ts(`courses.level.${course.level}` as 'courses.level.beginner')}</Badge>
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {tx(course.title)}
          </h2>
        </div>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <p className="leading-relaxed text-muted-foreground">{tx(course.description)}</p>

          <h3 className="mt-7 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {ts('courses.outcomes')}
          </h3>
          <ul className="mt-3 space-y-2.5">
            {course.outcomes.map((outcome, index) => (
              <li key={index} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-400">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
                <span className="leading-relaxed">{tx(outcome)}</span>
              </li>
            ))}
          </ul>

          {mentors.length > 0 ? (
            <>
              <h3 className="mt-7 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {ts('courses.mentors')}
              </h3>
              <div className="mt-3 flex flex-wrap gap-3">
                {mentors.map((mentor) => (
                  <div
                    key={mentor.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/40 py-2 pl-2 pr-4"
                  >
                    <span
                      className={cn(
                        'grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-xs font-bold text-white',
                        mentor.gradient,
                      )}
                    >
                      {mentor.initials}
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold">{mentor.name}</p>
                      <p className="text-xs text-muted-foreground">{tx(mentor.role)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <aside className="h-fit rounded-3xl border border-border/70 bg-muted/40 p-5">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold tracking-tight">
              {formatPrice(course.price, course.currency, locale)}
            </span>
            {course.oldPrice ? (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(course.oldPrice, course.currency, locale)}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{ts('courses.perMonth')}</p>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{ts('courses.months')}</dt>
              <dd className="font-semibold">{course.durationMonths}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{ts('courses.hoursWeek')}</dt>
              <dd className="font-semibold">{course.hoursPerWeek}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{ts('courses.seatsLeft')}</dt>
              <dd className="font-semibold">{Math.max(0, course.seats - course.seatsTaken)}</dd>
            </div>
          </dl>

          <Button
            className="mt-6 w-full"
            size="lg"
            onClick={() => {
              onClose();
              openApply(course.id);
            }}
          >
            {ts('courses.enroll')}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Button>
        </aside>
      </div>
    </Modal>
  );
}

export function CoursesSection() {
  const { content, tx, ts } = useSite();
  const [category, setCategory] = useState<CourseCategoryId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Course | null>(null);

  const published = useMemo(
    () => content.courses.items.filter((course) => course.published).sort((a, b) => a.order - b.order),
    [content.courses.items],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return published.filter((course) => {
      if (category !== 'all' && course.category !== category) return false;
      if (!needle) return true;
      return (
        tx(course.title).toLowerCase().includes(needle) ||
        tx(course.summary).toLowerCase().includes(needle)
      );
    });
  }, [published, category, query, tx]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const course of published) {
      map.set(course.category, (map.get(course.category) ?? 0) + 1);
    }
    return map;
  }, [published]);

  return (
    <>
      <SectionShell
        id="courses"
        eyebrow={tx(content.courses.eyebrow)}
        title={tx(content.courses.title)}
        subtitle={tx(content.courses.subtitle)}
        className="dot-grid"
        headerAside={
          <div className="relative w-full lg:w-72">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={ts('courses.search')}
              aria-label={ts('courses.search')}
              className="h-11 w-full rounded-full border border-input bg-background/70 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/25"
            />
          </div>
        }
      >
        {/* Filters */}
        <div
          role="tablist"
          aria-label={tx(content.courses.title)}
          className="no-scrollbar -mx-5 mb-9 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={category === 'all'}
            onClick={() => setCategory('all')}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300',
              category === 'all'
                ? 'border-transparent bg-brand-gradient text-white shadow-glow'
                : 'border-border bg-card text-muted-foreground hover:border-brand-400/60 hover:text-foreground',
            )}
          >
            {ts('courses.all')}
            <span className="ml-1.5 opacity-70">{published.length}</span>
          </button>

          {content.courses.categories.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={category === item.id}
              onClick={() => setCategory(item.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300',
                category === item.id
                  ? 'border-transparent bg-brand-gradient text-white shadow-glow'
                  : 'border-border bg-card text-muted-foreground hover:border-brand-400/60 hover:text-foreground',
              )}
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {tx(item.label)}
              <span className="opacity-70">{counts.get(item.id) ?? 0}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {ts('courses.empty')}
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
            {filtered.map((course, index) => (
              <Reveal key={course.id} delay={Math.min(index, 5) * 70} className="h-full">
                <CourseCard course={course} onOpen={setActive} />
              </Reveal>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground" aria-live="polite">
          {ts('courses.found')}: <strong className="text-foreground">{filtered.length}</strong>
        </p>
      </SectionShell>

      <CourseQuickView course={active} onClose={() => setActive(null)} />
    </>
  );
}
