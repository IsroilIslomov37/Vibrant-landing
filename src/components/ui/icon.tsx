'use client';

import {
  Award,
  BookOpen,
  Braces,
  Code2,
  Compass,
  GraduationCap,
  Globe,
  Github,
  Instagram,
  Landmark,
  Languages,
  LineChart,
  Linkedin,
  type LucideIcon,
  Network,
  Palette,
  Presentation,
  Rocket,
  Send,
  Sigma,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Wrench,
  Youtube,
} from 'lucide-react';

/**
 * Content stores icons as names so the admin panel can offer a picker without
 * shipping the whole lucide bundle to the client.
 */
const REGISTRY: Record<string, LucideIcon> = {
  Award,
  BookOpen,
  Braces,
  Code2,
  Compass,
  GraduationCap,
  Globe,
  Github,
  Instagram,
  Landmark,
  Languages,
  LineChart,
  Linkedin,
  Network,
  Palette,
  Presentation,
  Rocket,
  Send,
  Sigma,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Wrench,
  Youtube,
};

export const ICON_NAMES = Object.keys(REGISTRY).sort();

export function Icon({
  name,
  className,
  fallback = 'Sparkles',
}: {
  name: string;
  className?: string;
  fallback?: string;
}) {
  const Component = REGISTRY[name] ?? REGISTRY[fallback] ?? Sparkles;
  return <Component className={className} aria-hidden />;
}
