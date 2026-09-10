'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Database,
  ExternalLink,
  HardDrive,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Moon,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Sun,
  Target,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useToast } from '@/components/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Badge } from '@/components/ui/field';
import { Panel } from '@/components/admin/primitives';
import { HomepageEditor } from '@/components/admin/editors-home';
import { CoursesEditor, MentorsEditor, ReviewsEditor } from '@/components/admin/editors-catalog';
import { MethodologyEditor, SettingsEditor } from '@/components/admin/editors-misc';
import { LeadsTable } from '@/components/admin/leads-table';
import type { Lead, SiteContent } from '@/lib/types';
import { cn, deepClone, formatDate } from '@/lib/utils';

type TabId =
  | 'overview'
  | 'home'
  | 'courses'
  | 'mentors'
  | 'reviews'
  | 'methodology'
  | 'leads'
  | 'settings';

type ConfirmAction = 'discard' | 'reset' | 'logout';

const CONFIRM_ACTIONS: Record<
  ConfirmAction,
  { title: string; description: string; confirmLabel: string; destructive?: boolean }
> = {
  discard: {
    title: 'Отменить изменения?',
    description: 'Все правки после последнего сохранения будут потеряны.',
    confirmLabel: 'Отменить изменения',
  },
  reset: {
    title: 'Сбросить весь контент?',
    description: 'Страницы вернутся к заводским настройкам. Сохранённые заявки останутся на месте.',
    confirmLabel: 'Сбросить контент',
    destructive: true,
  },
  logout: {
    title: 'Выйти без сохранения?',
    description: 'Несохранённые изменения будут потеряны.',
    confirmLabel: 'Выйти',
    destructive: true,
  },
};

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'home', label: 'Главная', icon: Sparkles },
  { id: 'courses', label: 'Курсы', icon: BookOpen },
  { id: 'mentors', label: 'Менторы', icon: Users },
  { id: 'reviews', label: 'Отзывы', icon: MessageSquareQuote },
  { id: 'methodology', label: 'Методика', icon: Target },
  { id: 'leads', label: 'Заявки', icon: Inbox },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

export interface StorageStatus {
  kind: 'fs' | 'sql';
  writable: boolean;
}

export function AdminDashboard({
  initialContent,
  initialLeads,
  storage,
}: {
  initialContent: SiteContent;
  initialLeads: Lead[];
  storage: StorageStatus;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabId>('overview');
  const [draft, setDraft] = useState<SiteContent>(() => deepClone(initialContent));
  const [saved, setSaved] = useState<SiteContent>(() => deepClone(initialContent));
  const [saving, setSaving] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  // Unsaved edits are easy to lose on a stray tab close — warn first.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (response.status === 401) {
        toast({ title: 'Сессия истекла', description: 'Войдите заново.', tone: 'error' });
        router.push('/admin/login');
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? String(response.status));
      }
      const persisted: SiteContent = await response.json();
      setDraft(deepClone(persisted));
      setSaved(deepClone(persisted));
      toast({ title: 'Изменения сохранены', description: 'Сайт обновлён.', tone: 'success' });
      router.refresh();
    } catch (error) {
      console.error('[admin] save failed', error);
      toast({
        title: 'Не удалось сохранить',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  }, [draft, router, toast]);

  // Ctrl/Cmd+S saves, like every other editor.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (dirty && !saving) void save();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dirty, saving, save]);

  const discard = () => {
    setDraft(deepClone(saved));
  };

  const resetToSeed = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/content', { method: 'DELETE' });
      if (!response.ok) throw new Error(String(response.status));
      const fresh: SiteContent = await response.json();
      setDraft(deepClone(fresh));
      setSaved(deepClone(fresh));
      toast({ title: 'Контент сброшен', tone: 'success' });
      router.refresh();
    } catch {
      toast({ title: 'Не удалось сбросить контент', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  const toggleTheme = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      window.localStorage.setItem('vs.theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
    setDark(next);
  };

  const confirmPendingAction = async () => {
    const action = confirmAction;
    if (!action) return;

    if (action === 'discard') discard();
    else if (action === 'reset') await resetToSeed();
    else await logout();

    setConfirmAction(null);
  };

  const newLeads = initialLeads.filter((lead) => lead.status === 'new').length;

  return (
    <div className="min-h-dvh bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            aria-label="Меню разделов"
            aria-expanded={navOpen}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden />
          </button>

          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient text-sm font-bold text-white shadow-glow">
              {draft.brand.logoMark}
            </span>
            <span className="hidden flex-col leading-none sm:flex">
              <span className="font-display text-sm font-semibold tracking-tight">{draft.brand.name}</span>
              <span className="mt-0.5 text-[0.68rem] text-muted-foreground">Панель управления</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {dirty ? (
              <Badge tone="sun" className="hidden sm:inline-flex">
                Есть несохранённые изменения
              </Badge>
            ) : (
              <span className="hidden text-xs text-muted-foreground sm:block">
                Сохранено {formatDate(saved.updatedAt, 'ru')}
              </span>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Сменить тему"
              className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:text-foreground"
            >
              {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </button>

            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
              <a href="/" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden />
                Сайт
              </a>
            </Button>

            {dirty ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirmAction('discard')} className="hidden sm:inline-flex">
                Отменить
              </Button>
            ) : null}

            <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
              {!saving ? <Save className="h-4 w-4" aria-hidden /> : null}
              Сохранить
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[110rem] gap-6 px-4 py-6 sm:px-6">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-x-0 top-16 z-30 border-b border-border bg-background p-4 lg:static lg:z-auto lg:w-60 lg:shrink-0 lg:border-0 lg:bg-transparent lg:p-0',
            navOpen ? 'block' : 'hidden lg:block',
          )}
        >
          <nav aria-label="Разделы панели" className="sticky top-24 space-y-1">
            {TABS.map((item) => {
              const TabIcon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setNavOpen(false);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-500/12 text-brand-400'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <TabIcon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                  {item.id === 'leads' && newLeads > 0 ? (
                    <span className="ml-auto rounded-full bg-brand-500 px-2 py-0.5 text-[0.65rem] font-bold text-white">
                      {newLeads}
                    </span>
                  ) : null}
                </button>
              );
            })}

            <div className="!mt-6 space-y-1 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setConfirmAction('reset')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
                Сбросить контент
              </button>
              <button
                type="button"
                onClick={() => {
                  if (dirty) setConfirmAction('logout');
                  else void logout();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                Выйти
              </button>
            </div>
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 pb-20">
          {tab === 'overview' ? (
            <Overview content={draft} leads={initialLeads} onNavigate={setTab} storage={storage} />
          ) : null}
          {tab === 'home' ? <HomepageEditor content={draft} onChange={setDraft} /> : null}
          {tab === 'courses' ? <CoursesEditor content={draft} onChange={setDraft} /> : null}
          {tab === 'mentors' ? <MentorsEditor content={draft} onChange={setDraft} /> : null}
          {tab === 'reviews' ? <ReviewsEditor content={draft} onChange={setDraft} /> : null}
          {tab === 'methodology' ? <MethodologyEditor content={draft} onChange={setDraft} /> : null}
          {tab === 'leads' ? <LeadsTable initialLeads={initialLeads} /> : null}
          {tab === 'settings' ? <SettingsEditor content={draft} onChange={setDraft} /> : null}
        </main>
      </div>

      {/* Sticky save bar on mobile */}
      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur-xl sm:hidden">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmAction('discard')}>
              Отменить
            </Button>
            <Button className="flex-1" onClick={save} loading={saving}>
              Сохранить
            </Button>
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <ConfirmDialog
          open
          onClose={() => {
            if (!saving) setConfirmAction(null);
          }}
          onConfirm={() => void confirmPendingAction()}
          title={CONFIRM_ACTIONS[confirmAction].title}
          description={CONFIRM_ACTIONS[confirmAction].description}
          confirmLabel={CONFIRM_ACTIONS[confirmAction].confirmLabel}
          destructive={CONFIRM_ACTIONS[confirmAction].destructive}
          loading={confirmAction === 'reset' && saving}
        />
      ) : null}
    </div>
  );
}

/**
 * States which backend is live.
 *
 * Without this the difference between "saved" and "silently not saved" is
 * invisible until someone reloads the public site — which is exactly the trap a
 * serverless deploy on the filesystem store sets.
 */
function StorageBanner({ storage }: { storage: StorageStatus }) {
  if (storage.kind === 'sql') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold">База данных подключена</p>
          <p className="mt-0.5 text-muted-foreground">
            Изменения и заявки сохраняются постоянно и видны всем.
          </p>
        </div>
      </div>
    );
  }

  if (!storage.writable) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold">Хранилище недоступно — изменения не сохранятся</p>
          <p className="mt-0.5 text-muted-foreground">
            Файловая система только для чтения. Добавьте переменную окружения{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">DATABASE_URL</code>, чтобы
            включить постоянное хранилище. Заявки сейчас уходят только в Telegram.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
      <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold">Локальное файловое хранилище</p>
        <p className="mt-0.5 text-muted-foreground">
          Подходит для разработки. На хостинге задайте{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">DATABASE_URL</code> — иначе правки
          и заявки не сохранятся.
        </p>
      </div>
    </div>
  );
}

function Overview({
  content,
  leads,
  onNavigate,
  storage,
}: {
  content: SiteContent;
  leads: Lead[];
  onNavigate: (tab: TabId) => void;
  storage: StorageStatus;
}) {
  const published = content.courses.items.filter((course) => course.published).length;
  const newLeads = leads.filter((lead) => lead.status === 'new').length;
  const enrolled = leads.filter((lead) => lead.status === 'enrolled').length;

  const cards = [
    { label: 'Новых заявок', value: newLeads, icon: Inbox, tab: 'leads' as TabId, tone: 'text-brand-400' },
    { label: 'Записалось', value: enrolled, icon: GraduationCap, tab: 'leads' as TabId, tone: 'text-emerald-400' },
    { label: 'Курсов на сайте', value: published, icon: BookOpen, tab: 'courses' as TabId, tone: 'text-aqua-400' },
    {
      label: 'Преподавателей',
      value: content.mentors.items.filter((mentor) => mentor.published).length,
      icon: Users,
      tab: 'mentors' as TabId,
      tone: 'text-sun-400',
    },
  ];

  const recent = leads.slice(0, 5);

  return (
    <div className="space-y-5">
      <StorageBanner storage={storage} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const CardIcon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => onNavigate(card.tab)}
              className="surface-card p-5 text-left transition-shadow hover:shadow-glow"
            >
              <CardIcon className={cn('mb-3 h-5 w-5', card.tone)} aria-hidden />
              <p className="font-display text-3xl font-semibold tracking-tight">{card.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{card.label}</p>
            </button>
          );
        })}
      </div>

      <Panel
        title="Последние заявки"
        description="Полный список и экспорт — на вкладке «Заявки»."
        actions={
          <Button variant="outline" size="sm" onClick={() => onNavigate('leads')}>
            Все заявки
          </Button>
        }
      >
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            Заявок пока нет. Они появятся здесь сразу после отправки формы на сайте.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {recent.map((lead) => (
              <li key={lead.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span className="font-medium">{lead.name}</span>
                <span className="text-sm text-muted-foreground">{lead.courseTitle}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(lead.createdAt, 'ru')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="С чего начать" description="Три вещи, которые чаще всего меняют перед запуском набора.">
        <ol className="space-y-3 text-sm">
          {[
            { label: 'Обновите баннер с датой старта потока', tab: 'home' as TabId },
            { label: 'Проверьте цены и количество мест в курсах', tab: 'courses' as TabId },
            { label: 'Включите уведомления о заявках в Telegram', tab: 'settings' as TabId },
          ].map((item, index) => (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => onNavigate(item.tab)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3 text-left transition-colors hover:border-brand-400/60"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-xs font-bold text-brand-400">
                  {index + 1}
                </span>
                {item.label}
              </button>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
