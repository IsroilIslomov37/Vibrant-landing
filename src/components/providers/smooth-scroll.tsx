'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Wires Lenis inertia scrolling into GSAP's ticker.
 *
 * Two details matter for a pinned ScrollTrigger to stay glued at 60fps:
 *  - Lenis must be driven by GSAP's ticker (one rAF loop, not two), and
 *  - ScrollTrigger must read scroll position from Lenis via scrollerProxy,
 *    otherwise the pin and the smoothed scroll drift apart by a frame.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.registerPlugin(ScrollTrigger);

    if (reduceMotion) {
      // Native scrolling only; ScrollTrigger still drives the reveal animations.
      ScrollTrigger.refresh();
      return () => {
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      };
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      // Touch devices keep native scrolling — smoothing it fights the OS.
      syncTouch: false,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // No scrollerProxy here on purpose: this Lenis instance scrolls the real
    // window rather than transforming a wrapper, so ScrollTrigger's native
    // scroll reading is already correct. Proxying it through `lenis.scroll`
    // would feed ScrollTrigger the smoothed value and desync pinned progress
    // whenever anything scrolls the page programmatically.

    // Intercept in-page anchors so they use the smoothed scroll.
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a[href^="#"]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -88, duration: 1.25 });
    };
    document.addEventListener('click', onClick);

    ScrollTrigger.refresh();

    return () => {
      document.removeEventListener('click', onClick);
      gsap.ticker.remove(raf);
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}

/** Lets any component pause Lenis (used while a modal is open). */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    document.documentElement.classList.add('lenis-stopped');
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      document.documentElement.classList.remove('lenis-stopped');
    };
  }, [locked]);
}
