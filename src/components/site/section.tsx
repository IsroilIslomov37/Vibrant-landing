'use client';

import { useReveal } from '@/hooks/use-animations';
import { cn } from '@/lib/utils';

export function SectionShell({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  align = 'left',
  className,
  headerAside,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
  headerAside?: React.ReactNode;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();

  return (
    <section id={id} className={cn('relative scroll-mt-28 py-20 sm:py-28', className)}>
      <div className="container">
        <div
          ref={ref}
          className={cn(
            'flex flex-col gap-6 transition-all duration-700 ease-smooth lg:flex-row lg:items-end lg:justify-between',
            align === 'center' && 'lg:flex-col lg:items-center lg:text-center',
            visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
          )}
        >
          <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
            {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
            <h2 className="section-title text-balance">{title}</h2>
            {subtitle ? (
              <p className={cn('section-sub mt-4', align === 'center' && 'mx-auto')}>{subtitle}</p>
            ) : null}
          </div>
          {headerAside ? <div className="shrink-0">{headerAside}</div> : null}
        </div>

        <div className="mt-12 sm:mt-14">{children}</div>
      </div>
    </section>
  );
}

/** Fades a block up the first time it enters the viewport. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'transition-all duration-700 ease-smooth',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
