'use client';

import { useMemo, useState } from 'react';
import {
  Download,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/components/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Badge, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Panel } from '@/components/admin/primitives';
import type { Lead, LeadStatus } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Новая',
  contacted: 'Связались',
  enrolled: 'Записан',
  archived: 'Архив',
};

const STATUS_TONE: Record<LeadStatus, 'brand' | 'sun' | 'success' | 'muted'> = {
  new: 'brand',
  contacted: 'sun',
  enrolled: 'success',
  archived: 'muted',
};

const STATUS_DOT: Record<LeadStatus, string> = {
  new: 'bg-brand-400',
  contacted: 'bg-sun-400',
  enrolled: 'bg-emerald-400',
  archived: 'bg-muted-foreground',
};

const STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'enrolled', 'archived'];

const FORMAT_LABEL: Record<Lead['format'], string> = {
  online: 'Онлайн',
  offline: 'В центре',
  hybrid: 'Смешанный',
};

export function LeadsTable({ initialLeads }: { initialLeads: Lead[] }) {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const base: Record<LeadStatus | 'all', number> = {
      all: leads.length,
      new: 0,
      contacted: 0,
      enrolled: 0,
      archived: 0,
    };
    for (const lead of leads) base[lead.status] += 1;
    return base;
  }, [leads]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter !== 'all' && lead.status !== filter) return false;
      if (!needle) return true;
      return (
        lead.name.toLowerCase().includes(needle) ||
        lead.phone.toLowerCase().includes(needle) ||
        lead.email.toLowerCase().includes(needle) ||
        lead.courseTitle.toLowerCase().includes(needle)
      );
    });
  }, [leads, filter, query]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/leads', { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      setLeads(await response.json());
    } catch {
      toast({ title: 'Не удалось обновить список заявок', tone: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const patch = async (id: string, body: Partial<Pick<Lead, 'status' | 'notes'>>) => {
    setBusyId(id);
    // Optimistic: the table stays responsive, and a failure rolls the row back.
    const previous = leads;
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, ...body } : lead)));
    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(String(response.status));
      const updated: Lead = await response.json();
      setLeads((current) => current.map((lead) => (lead.id === id ? updated : lead)));
      setDetail((current) => (current?.id === id ? updated : current));
    } catch {
      setLeads(previous);
      toast({ title: 'Не удалось сохранить изменение', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    const previous = leads;
    setDeletingId(id);
    setLeads((current) => current.filter((lead) => lead.id !== id));
    setDetail(null);
    try {
      const response = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(String(response.status));
      toast({ title: 'Заявка удалена', tone: 'success' });
    } catch {
      setLeads(previous);
      toast({ title: 'Не удалось удалить заявку', tone: 'error' });
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  const openDetail = (lead: Lead) => {
    setDetail(lead);
    setNoteDraft(lead.notes);
  };

  return (
    <>
      <Panel
        title="Заявки"
        description="Все обращения с лендинга. Статус меняется в один клик, заметки сохраняются автоматически."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh} loading={refreshing}>
              {!refreshing ? <RefreshCw className="h-4 w-4" aria-hidden /> : null}
              Обновить
            </Button>
            <Button size="sm" asChild>
              <a href="/api/leads/export" download>
                <Download className="h-4 w-4" aria-hidden />
                Экспорт CSV
              </a>
            </Button>
          </div>
        }
      >
        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {(['all', 'new', 'contacted', 'enrolled', 'archived'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  filter === key
                    ? 'border-transparent bg-brand-gradient text-white'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {key === 'all' ? 'Все' : STATUS_LABEL[key]}
                <span className="ml-1.5 opacity-70">{counts[key]}</span>
              </button>
            ))}
          </div>

          <div className="relative sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Имя, телефон, курс…"
              aria-label="Поиск по заявкам"
              className="pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {leads.length === 0 ? 'Заявок пока нет.' : 'Ничего не найдено по этому фильтру.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[54rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-semibold">Дата</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Студент</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Контакты</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Направление</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Статус</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr
                    key={lead.id}
                    className={cn(
                      'border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30',
                      busyId === lead.id && 'opacity-60',
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(lead.createdAt, 'ru')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openDetail(lead)}
                        className="text-left font-semibold hover:text-brand-400"
                      >
                        {lead.name}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {FORMAT_LABEL[lead.format]} · {lead.source}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5 text-xs">
                        <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-400">
                          <Phone className="h-3 w-3" aria-hidden />
                          {lead.phone}
                        </a>
                        <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-brand-400">
                          <Mail className="h-3 w-3" aria-hidden />
                          {lead.email}
                        </a>
                      </div>
                    </td>
                    <td className="max-w-[14rem] px-4 py-3">
                      <span className="block truncate">{lead.courseTitle}</span>
                      {lead.message ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3" aria-hidden />
                          есть комментарий
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={lead.status}
                        aria-label={`Статус заявки ${lead.name}`}
                        onValueChange={(status) => patch(lead.id, { status: status as LeadStatus })}
                        options={STATUS_ORDER.map((status) => ({
                          value: status,
                          searchText: STATUS_LABEL[status],
                          label: (
                            <>
                              <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[status])} aria-hidden />
                              <span>{STATUS_LABEL[status]}</span>
                            </>
                          ),
                        }))}
                        className="h-9 w-36 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Удалить заявку ${lead.name}`}
                        onClick={() => setDeleteTarget(lead)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Detail drawer */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        size="lg"
        title={detail?.name}
        description={detail ? `${detail.courseTitle} · ${formatDate(detail.createdAt, 'ru')}` : undefined}
        closeLabel="Закрыть карточку заявки"
      >
        {detail ? (
          <div className="space-y-5 p-6">
            <div className="flex flex-wrap gap-2">
              <Badge tone={STATUS_TONE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
              <Badge tone="muted">{FORMAT_LABEL[detail.format]}</Badge>
              <Badge tone="muted">{detail.level}</Badge>
              <Badge tone="muted">{detail.locale.toUpperCase()}</Badge>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                <dt className="text-xs text-muted-foreground">Телефон</dt>
                <dd className="mt-0.5">
                  <a href={`tel:${detail.phone}`} className="font-semibold hover:text-brand-400">
                    {detail.phone}
                  </a>
                </dd>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="mt-0.5">
                  <a href={`mailto:${detail.email}`} className="font-semibold hover:text-brand-400">
                    {detail.email}
                  </a>
                </dd>
              </div>
            </dl>

            {detail.message ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Комментарий студента
                </p>
                <p className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm leading-relaxed">
                  {detail.message}
                </p>
              </div>
            ) : null}

            <div>
              <label
                htmlFor="lead-notes"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Внутренние заметки
              </label>
              <Textarea
                id="lead-notes"
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Что обсудили, когда перезвонить…"
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  size="sm"
                  onClick={() => patch(detail.id, { notes: noteDraft })}
                  loading={busyId === detail.id}
                >
                  Сохранить заметку
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deletingId) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget.id);
        }}
        title="Удалить заявку?"
        description={
          deleteTarget
            ? `Заявка «${deleteTarget.name}» будет удалена без возможности восстановления.`
            : undefined
        }
        confirmLabel="Удалить"
        destructive
        loading={Boolean(deleteTarget && deletingId === deleteTarget.id)}
      />
    </>
  );
}
