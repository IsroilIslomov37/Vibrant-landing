'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, ChevronDown, MousePointer2 } from 'lucide-react';
import { useSite } from '@/components/providers/site-provider';
import { Button } from '@/components/ui/button';
import { usePrefersReducedMotion } from '@/hooks/use-animations';
import {
  createScene,
  detectQuality,
  loadCampus,
  renderScene,
  toCameraState,
  type CameraState,
  type Scene,
} from '@/lib/scene3d';
import { cn } from '@/lib/utils';

/**
 * The pinned hero.
 *
 * The section is `stages * 100dvh` tall. ScrollTrigger pins the inner viewport
 * and scrubs a GSAP timeline that tweens one flat `CameraState` object; a
 * separate render loop reads that object every frame and repaints the canvas.
 * Keeping the tween and the paint decoupled is what stops the camera from
 * stuttering when the main thread hiccups — GSAP keeps interpolating, the
 * renderer just draws whatever the latest values are.
 */
export function HeroScene() {
  const { content, tx, ts, openApply, theme } = useSite();
  const stages = content.hero.stages;

  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRefs = useRef<(HTMLDivElement | null)[]>([]);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  const camRef = useRef<CameraState | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const visibleRef = useRef(true);
  const pointerRef = useRef({ yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 });
  const triggerRef = useRef<ScrollTrigger | null>(null);

  const [activeStage, setActiveStage] = useState(0);
  const [ready, setReady] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  /* ------------------------------------------------------------ rendering */
  useEffect(() => {
    const canvas = canvasRef.current;
    const pin = pinRef.current;
    if (!canvas || !pin || stages.length === 0) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const quality = detectQuality();
    // First paint uses the procedural scene so the hero is never blank; the
    // Blender-authored campus swaps in as soon as its payload lands.
    sceneRef.current = createScene(quality);
    const cam = toCameraState(stages[0].camera);
    camRef.current = cam;

    const abort = new AbortController();
    void loadCampus('/scene/campus.json', abort.signal).then((campus) => {
      if (campus && !abort.signal.aborted) {
        sceneRef.current = createScene(quality, campus);
      }
    });

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = pin.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(pin);

    // Skip painting entirely when the hero is off-screen.
    const intersection = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    intersection.observe(pin);

    const render = () => {
      const scene = sceneRef.current;
      if (!visibleRef.current || !camRef.current || !scene) return;
      const pointer = pointerRef.current;
      pointer.yaw += (pointer.targetYaw - pointer.yaw) * 0.06;
      pointer.pitch += (pointer.targetPitch - pointer.pitch) * 0.06;
      camRef.current.parallaxYaw = pointer.yaw;
      camRef.current.parallaxPitch = pointer.pitch;

      renderScene(context, scene, camRef.current, {
        width,
        height,
        dpr,
        time: gsap.ticker.time,
        opacity: 1,
      });
    };

    gsap.ticker.add(render);
    setReady(true);

    return () => {
      abort.abort();
      gsap.ticker.remove(render);
      resizeObserver.disconnect();
      intersection.disconnect();
    };
    // `stages` identity changes only when the admin edits content, which should
    // rebuild the scene — that is the intended dependency.
  }, [stages]);

  /* ---------------------------------------------------- scroll choreography */
  useEffect(() => {
    const section = sectionRef.current;
    const pin = pinRef.current;
    const cam = camRef.current;
    if (!section || !pin || !cam || !ready || stages.length < 2) return;

    if (reducedMotion) {
      // No pin, no scrub: the stage dots become the navigation instead.
      overlayRefs.current.forEach((element, index) => {
        if (element) gsap.set(element, { autoAlpha: index === 0 ? 1 : 0, y: 0, filter: 'none' });
      });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      overlayRefs.current.forEach((element, index) => {
        if (!element) return;
        gsap.set(element, index === 0 ? { autoAlpha: 1, y: 0 } : { autoAlpha: 0, y: 48 });
      });

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          // The viewport is held by CSS `position: sticky` rather than
          // ScrollTrigger's pin — no pin-spacer is injected, so the layout below
          // stays untouched and there is nothing to re-measure on resize.
          scrub: 0.85,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const index = Math.min(
              stages.length - 1,
              Math.round(self.progress * (stages.length - 1)),
            );
            setActiveStage((current) => (current === index ? current : index));
            if (progressBarRef.current) {
              progressBarRef.current.style.transform = `scaleX(${self.progress})`;
            }
            if (hintRef.current) {
              hintRef.current.style.opacity = String(Math.max(0, 1 - self.progress * 14));
            }
          },
        },
      });

      for (let i = 0; i < stages.length - 1; i += 1) {
        const next = toCameraState(stages[i + 1].camera);
        const outgoing = overlayRefs.current[i];
        const incoming = overlayRefs.current[i + 1];

        timeline.to(
          cam,
          {
            yaw: next.yaw,
            pitch: next.pitch,
            distance: next.distance,
            targetX: next.targetX,
            targetY: next.targetY,
            targetZ: next.targetZ,
            fov: next.fov,
            roll: next.roll,
            lightYaw: next.lightYaw,
            exposure: next.exposure,
            focusHub: next.focusHub,
            focusDesks: next.focusDesks,
            focusCommunity: next.focusCommunity,
            duration: 1,
            ease: 'power2.inOut',
          },
          i,
        );

        if (outgoing) {
          timeline.to(
            outgoing,
            { autoAlpha: 0, y: -56, filter: 'blur(10px)', duration: 0.4, ease: 'power2.in' },
            i,
          );
        }
        if (incoming) {
          timeline.fromTo(
            incoming,
            { autoAlpha: 0, y: 56, filter: 'blur(10px)' },
            { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: 'power2.out' },
            i + 0.5,
          );
          // Inner parallax: the elements settle at slightly different rates.
          const layers = incoming.querySelectorAll<HTMLElement>('[data-parallax]');
          layers.forEach((layer) => {
            const depth = Number(layer.dataset.parallax) || 1;
            timeline.fromTo(
              layer,
              { y: 26 * depth },
              { y: 0, duration: 0.55, ease: 'power3.out' },
              i + 0.5,
            );
          });
        }
      }

      triggerRef.current = timeline.scrollTrigger ?? null;
    }, section);

    return () => {
      context.revert();
      triggerRef.current = null;
    };
  }, [ready, reducedMotion, stages]);

  /* ------------------------------------------------------ pointer parallax */
  useEffect(() => {
    const pin = pinRef.current;
    if (!pin || reducedMotion) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const onMove = (event: PointerEvent) => {
      const rect = pin.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      pointerRef.current.targetYaw = px * 5.5;
      pointerRef.current.targetPitch = -py * 3.5;
    };
    const onLeave = () => {
      pointerRef.current.targetYaw = 0;
      pointerRef.current.targetPitch = 0;
    };

    pin.addEventListener('pointermove', onMove);
    pin.addEventListener('pointerleave', onLeave);
    return () => {
      pin.removeEventListener('pointermove', onMove);
      pin.removeEventListener('pointerleave', onLeave);
    };
  }, [reducedMotion]);

  /* ------------------------------------------------------- stage switching */
  const goToStage = useCallback(
    (index: number) => {
      if (reducedMotion || !triggerRef.current) {
        // Static mode: jump the camera and swap the overlay outright.
        const cam = camRef.current;
        if (cam) Object.assign(cam, toCameraState(stages[index].camera));
        overlayRefs.current.forEach((element, i) => {
          if (element) gsap.to(element, { autoAlpha: i === index ? 1 : 0, duration: 0.35 });
        });
        setActiveStage(index);
        return;
      }
      const trigger = triggerRef.current;
      const ratio = stages.length > 1 ? index / (stages.length - 1) : 0;
      const target = trigger.start + (trigger.end - trigger.start) * ratio;
      window.scrollTo({ top: target, behavior: 'smooth' });
    },
    [reducedMotion, stages],
  );

  if (stages.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      id="about"
      aria-label={tx(content.brand.tagline)}
      className="relative"
      style={{ height: reducedMotion ? '100dvh' : `${stages.length * 100}dvh` }}
    >
      <div
        ref={pinRef}
        className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-slate-950"
      >
        {/* Painted backdrop sits under the canvas so the section never flashes empty. */}
        <div
          className={cn(
            'absolute inset-0',
            theme === 'dark'
              ? 'bg-[radial-gradient(120%_80%_at_50%_-10%,#1b1b4d_0%,#0a0c22_55%,#05060f_100%)]'
              : 'bg-[radial-gradient(120%_80%_at_50%_-10%,#2a2668_0%,#111436_55%,#080a1c_100%)]',
          )}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          aria-hidden
        />
        {/* Vignette + bottom fade into the next section. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_50%,transparent_45%,rgba(4,6,18,0.72)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />

        {/* ------------------------------------------------------- overlays */}
        <div className="pointer-events-none absolute inset-0">
          {/* Padding (not margin) so the content centres inside the space the
              fixed header leaves, instead of centring behind it. */}
          <div className="container flex h-full items-center pb-14 pt-[6.5rem]">
            <div className="relative w-full max-w-3xl">
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  ref={(element) => {
                    overlayRefs.current[index] = element;
                  }}
                  className="hero-stage pointer-events-auto absolute inset-x-0 top-1/2 -translate-y-1/2"
                  aria-hidden={activeStage !== index}
                >
                  <p
                    data-parallax="0.5"
                    className="hero-badge inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur-md"
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-aqua-400" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-aqua-400" />
                    </span>
                    {tx(stage.badge)}
                  </p>

                  <h1
                    data-parallax="1"
                    className="hero-title font-display font-semibold tracking-tight text-white text-balance"
                  >
                    {tx(stage.title)}{' '}
                    <span className="bg-gradient-to-r from-brand-300 via-aqua-300 to-sun-300 bg-clip-text text-transparent">
                      {tx(stage.highlight)}
                    </span>
                  </h1>

                  <p
                    data-parallax="1.5"
                    className="hero-sub max-w-xl leading-relaxed text-white/70 text-pretty"
                  >
                    {tx(stage.subtitle)}
                  </p>

                  <div data-parallax="2" className="hero-actions flex flex-wrap items-center gap-3">
                    {stage.primaryCta.href === '#apply' ? (
                      <Button size="lg" onClick={() => openApply()}>
                        {tx(stage.primaryCta.label)}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Button>
                    ) : (
                      <Button size="lg" asChild>
                        <a href={stage.primaryCta.href}>
                          {tx(stage.primaryCta.label)}
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </a>
                      </Button>
                    )}
                    <Button size="lg" variant="glass" asChild>
                      <a href={stage.secondaryCta.href} className="text-white">
                        {tx(stage.secondaryCta.label)}
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --------------------------------------------------- stage rail */}
        <nav
          aria-label={ts('hero.progress')}
          className="absolute right-5 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex"
        >
          {stages.map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => goToStage(index)}
              aria-label={`${ts('hero.progress')} ${index + 1}: ${tx(stage.title)}`}
              aria-current={activeStage === index ? 'step' : undefined}
              className="group relative flex h-8 w-8 items-center justify-center"
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full transition-all duration-500 ease-smooth',
                  activeStage === index
                    ? 'h-8 w-2 bg-gradient-to-b from-brand-300 to-aqua-300'
                    : 'bg-white/30 group-hover:bg-white/70',
                )}
              />
            </button>
          ))}
        </nav>

        {/* ------------------------------------------------- scroll affordance */}
        <div
          ref={hintRef}
          className="hero-scroll-hint pointer-events-none absolute inset-x-0 bottom-7 flex flex-col items-center gap-2 text-white/60"
        >
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em]">
            {reducedMotion ? <MousePointer2 className="h-3.5 w-3.5" aria-hidden /> : null}
            {tx(content.hero.scrollHint)}
          </span>
          {!reducedMotion ? <ChevronDown className="h-4 w-4 animate-float" aria-hidden /> : null}
        </div>

        {/* Scrub progress bar */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
          <div
            ref={progressBarRef}
            className="h-full origin-left scale-x-0 bg-gradient-to-r from-brand-400 via-aqua-400 to-sun-400"
          />
        </div>
      </div>
    </section>
  );
}
