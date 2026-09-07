import type { Metadata } from 'next';
import { AdminDashboard } from '@/components/admin/dashboard';
import { ToastProvider } from '@/components/providers/toast-provider';
import { getContent, getLeads } from '@/lib/store';

export const metadata: Metadata = {
  title: 'Панель управления',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // The middleware has already verified the session before this renders.
  const [content, leads] = await Promise.all([getContent(), getLeads()]);

  return (
    <ToastProvider>
      <AdminDashboard initialContent={content} initialLeads={leads} />
    </ToastProvider>
  );
}
