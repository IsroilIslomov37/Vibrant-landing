'use client';

import { useEffect, useRef, useState } from 'react';

/** True once the user has asked the OS to reduce motion. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Adds a class once the element scrolls into view.
 * Uses IntersectionObserver rather than ScrollTrigger so simple reveals do not
 * add work to the pinned hero's scroll pipeline.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: { threshold?: number; once?: boolean }) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (options?.once !== false) observer.disconnect();
        } else if (options?.once === false) {
          setVisible(false);
        }
      },
      { threshold: options?.threshold ?? 0.18, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [options?.threshold, options?.once]);

  return { ref, visible };
}

/** Counts from 0 to `target` once the element is on screen. */
export function useCountUp(target: number, duration = 1600) {
  const { ref, visible } = useReveal<HTMLDivElement>({ threshold: 0.4 });
  const [value, setValue] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!visible) return;
    if (reduced) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutExpo — fast start, long settle, reads as "counting up".
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, target, duration, reduced]);

  return { ref, value, visible };
}

/**
 * Pointer-driven 3D tilt. Writes CSS custom properties instead of React state so
 * a hover never triggers a re-render.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(strength = 9) {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element || reduced) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let active = false;

    const render = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      element.style.setProperty('--tilt-x', `${currentY.toFixed(3)}deg`);
      element.style.setProperty('--tilt-y', `${currentX.toFixed(3)}deg`);
      if (active || Math.abs(currentX) > 0.01 || Math.abs(currentY) > 0.01) {
        frame = requestAnimationFrame(render);
      } else {
        frame = 0;
      }
    };

    const start = () => {
      active = true;
      if (!frame) frame = requestAnimationFrame(render);
    };

    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      targetX = px * strength;
      targetY = -py * strength;
      element.style.setProperty('--pointer-x', `${((px + 0.5) * 100).toFixed(1)}%`);
      element.style.setProperty('--pointer-y', `${((py + 0.5) * 100).toFixed(1)}%`);
      start();
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      active = false;
      if (!frame) frame = requestAnimationFrame(render);
    };

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    return () => {
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [strength, reduced]);

  return ref;
}

/** Tracks a media query as boolean state. */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
