import type { Metadata, Viewport } from 'next';
import './globals.css';
import { themeBootstrapScript } from '@/components/providers/site-provider';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Vibrant School — учебный центр нового поколения',
    template: '%s · Vibrant School',
  },
  description:
    'Vibrant School — учебный центр в Ташкенте: IT и программирование, языки, точные науки и дизайн. Группы до 12 человек, 70% практики, защита проектов.',
  keywords: ['учебный центр', 'курсы программирования', 'IELTS', 'математика', 'UI/UX', 'Ташкент'],
  openGraph: {
    type: 'website',
    title: 'Vibrant School — учебный центр нового поколения',
    description:
      '12 направлений, 38 менторов, один стандарт качества. IT, языки, точные науки и дизайн в одной экосистеме.',
    siteName: 'Vibrant School',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#05060f' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Sets the theme class before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
        />
      </head>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
