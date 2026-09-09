/**
 * Shared content model for the Vibrant School site.
 *
 * Everything the admin panel can edit lives in `SiteContent`. Leads are stored
 * separately so that a content save can never clobber inbound applications.
 */

export const LOCALES = ['ru', 'uz', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Editable copy is always bilingual — the admin panel renders one input per locale. */
export type LocalizedText = Record<Locale, string>;

export type CourseCategoryId = 'it' | 'languages' | 'math' | 'creative';

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export type CourseBadge = 'popular' | 'new' | 'limited' | 'none';

export interface CourseCategory {
  id: CourseCategoryId;
  label: LocalizedText;
  /** Lucide icon name, resolved at render time through the icon registry. */
  icon: string;
  accent: string;
}

export interface Course {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText;
  category: CourseCategoryId;
  level: CourseLevel;
  /** Duration in months. */
  durationMonths: number;
  hoursPerWeek: number;
  price: number;
  oldPrice?: number;
  currency: string;
  badge: CourseBadge;
  mentorIds: string[];
  outcomes: LocalizedText[];
  coverImage?: string;
  /** Tailwind-friendly gradient used when no cover image is uploaded. */
  gradient: string;
  seats: number;
  seatsTaken: number;
  published: boolean;
  order: number;
}

export interface Mentor {
  id: string;
  name: string;
  role: LocalizedText;
  bio: LocalizedText;
  avatar?: string;
  /** Initials fallback when no avatar is uploaded. */
  initials: string;
  gradient: string;
  qualifications: LocalizedText[];
  yearsExperience: number;
  studentsTaught: number;
  socials: { telegram?: string; linkedin?: string; github?: string; website?: string };
  published: boolean;
  order: number;
}

export interface Review {
  id: string;
  author: string;
  authorRole: LocalizedText;
  quote: LocalizedText;
  avatar?: string;
  initials: string;
  gradient: string;
  rating: number;
  /** Optional video testimonial (YouTube/Vimeo embed or direct mp4). */
  videoUrl?: string;
  /** Before/after growth metric shown on the card. */
  metric?: { label: LocalizedText; before: string; after: string };
  courseId?: string;
  featured: boolean;
  published: boolean;
  order: number;
}

export interface StatItem {
  id: string;
  label: LocalizedText;
  value: number;
  suffix: string;
  icon: string;
}

export interface FeatureItem {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  icon: string;
  accent: string;
}

export interface ProcessStep {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
}

/** One keyframe of the pinned scrollytelling sequence. */
export interface HeroStage {
  id: string;
  badge: LocalizedText;
  title: LocalizedText;
  highlight: LocalizedText;
  subtitle: LocalizedText;
  primaryCta: { label: LocalizedText; href: string };
  secondaryCta: { label: LocalizedText; href: string };
  /** Camera keyframe driving the canvas scene at this stage. */
  camera: CameraKeyframe;
}

export interface CameraKeyframe {
  /** Horizontal orbit in degrees. */
  yaw: number;
  /** Vertical orbit in degrees, clamped to avoid gimbal flips. */
  pitch: number;
  /** Orbit radius in world units. */
  distance: number;
  /** Look-at target. */
  target: { x: number; y: number; z: number };
  /** Vertical field of view in degrees. */
  fov: number;
  /** Camera roll in degrees — a small amount adds cinematic tilt. */
  roll: number;
  /** Direction of the key light, in degrees around Y. */
  lightYaw: number;
  /** Overall scene exposure multiplier. */
  exposure: number;
  /** Focus weight per scene cluster (0–1) — drives emissive intensity and fog. */
  focus: { hub: number; desks: number; community: number };
}

export interface NavLink {
  id: string;
  label: LocalizedText;
  href: string;
}

export interface SiteContent {
  version: number;
  updatedAt: string;
  brand: {
    name: string;
    tagline: LocalizedText;
    logoMark: string;
  };
  announcement: {
    enabled: boolean;
    text: LocalizedText;
    ctaLabel: LocalizedText;
    ctaHref: string;
    /** Tailwind gradient classes for the bar. */
    tone: 'brand' | 'sun' | 'aqua';
  };
  nav: {
    links: NavLink[];
    ctaLabel: LocalizedText;
    ctaHref: string;
  };
  hero: {
    stages: HeroStage[];
    scrollHint: LocalizedText;
  };
  courses: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    subtitle: LocalizedText;
    categories: CourseCategory[];
    items: Course[];
  };
  methodology: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    subtitle: LocalizedText;
    features: FeatureItem[];
    stats: StatItem[];
    steps: ProcessStep[];
  };
  mentors: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    subtitle: LocalizedText;
    items: Mentor[];
  };
  reviews: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    subtitle: LocalizedText;
    items: Review[];
  };
  lead: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    subtitle: LocalizedText;
    successTitle: LocalizedText;
    successBody: LocalizedText;
    consent: LocalizedText;
  };
  footer: {
    about: LocalizedText;
    address: LocalizedText;
    phone: string;
    email: string;
    mapUrl: string;
    newsletterTitle: LocalizedText;
    newsletterSubtitle: LocalizedText;
    socials: { id: string; label: string; href: string; icon: string }[];
    columns: { id: string; title: LocalizedText; links: NavLink[] }[];
  };
  integrations: {
    telegramEnabled: boolean;
    emailEnabled: boolean;
    notifyEmail: string;
  };
}

export type LeadStatus = 'new' | 'contacted' | 'enrolled' | 'archived';

export interface Lead {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  courseId: string;
  courseTitle: string;
  /** Preferred format chosen in step 2 of the form. */
  format: 'online' | 'offline' | 'hybrid';
  level: CourseLevel;
  message: string;
  status: LeadStatus;
  source: string;
  locale: Locale;
  notes: string;
}

export interface LeadInput {
  name: string;
  phone: string;
  email: string;
  courseId: string;
  format: Lead['format'];
  level: CourseLevel;
  message?: string;
  locale?: Locale;
  source?: string;
}
