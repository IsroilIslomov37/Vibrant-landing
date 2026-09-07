'use client';

import { SiteProvider } from '@/components/providers/site-provider';
import { SmoothScrollProvider } from '@/components/providers/smooth-scroll';
import { ToastProvider } from '@/components/providers/toast-provider';
import { SiteHeader } from '@/components/site/header';
import { HeroScene } from '@/components/site/hero-scene';
import { CoursesSection } from '@/components/site/courses';
import { MethodologySection } from '@/components/site/methodology';
import { MentorsSection } from '@/components/site/mentors';
import { ReviewsSection } from '@/components/site/reviews';
import { ApplyModal, ApplySection } from '@/components/site/lead-form';
import { SiteFooter } from '@/components/site/footer';
import type { SiteContent } from '@/lib/types';

/**
 * Client shell for the landing page. The server component above reads the CMS
 * content and hands it down, so the first paint already carries real copy.
 */
export function LandingPage({ content }: { content: SiteContent }) {
  return (
    <SiteProvider initialContent={content}>
      <ToastProvider>
        <SmoothScrollProvider>
          <a
            href="#courses"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-primary focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary-foreground"
          >
            Skip to content
          </a>

          <SiteHeader />

          <main>
            <HeroScene />
            <CoursesSection />
            <MethodologySection />
            <MentorsSection />
            <ReviewsSection />
            <ApplySection />
          </main>

          <SiteFooter />
          <ApplyModal />
        </SmoothScrollProvider>
      </ToastProvider>
    </SiteProvider>
  );
}
