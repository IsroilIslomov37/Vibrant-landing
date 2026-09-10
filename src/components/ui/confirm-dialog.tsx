'use client';

import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Отмена',
  destructive = false,
  loading = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onClose}
      size="sm"
      title={
        <span className="flex items-center gap-3">
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
              destructive ? 'bg-destructive/12 text-destructive' : 'bg-sun-500/12 text-sun-400',
            )}
          >
            <TriangleAlert className="h-4 w-4" aria-hidden />
          </span>
          {title}
        </span>
      }
      description={description}
      closeLabel="Закрыть подтверждение"
    >
      <div className="flex flex-col-reverse gap-2 p-5 sm:flex-row sm:justify-end sm:px-8 sm:py-6">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={destructive ? 'destructive' : 'solid'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
