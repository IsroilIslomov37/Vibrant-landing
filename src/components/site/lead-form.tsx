'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Laptop, MapPin, Send, Users } from 'lucide-react';
import { useSite } from '@/components/providers/site-provider';
import { useToast } from '@/components/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { SectionShell } from '@/components/site/section';
import type { CourseLevel, Lead } from '@/lib/types';
import { cn, EMAIL_RE, PHONE_RE } from '@/lib/utils';

type Format = Lead['format'];

interface FormState {
  name: string;
  phone: string;
  email: string;
  courseId: string;
  format: Format;
  level: CourseLevel;
  message: string;
}

const EMPTY: FormState = {
  name: '',
  phone: '',
  email: '',
  courseId: '',
  format: 'offline',
  level: 'beginner',
  message: '',
};

const FORMAT_OPTIONS: { value: Format; icon: typeof Laptop; key: 'form.format.online' | 'form.format.offline' | 'form.format.hybrid' }[] = [
  { value: 'online', icon: Laptop, key: 'form.format.online' },
  { value: 'offline', icon: MapPin, key: 'form.format.offline' },
  { value: 'hybrid', icon: Users, key: 'form.format.hybrid' },
];

const STEP_COUNT = 3;

export function LeadForm({
  presetCourseId,
  onSuccess,
  compact = false,
}: {
  presetCourseId?: string | null;
  onSuccess?: () => void;
  compact?: boolean;
}) {
  const { content, tx, ts, locale } = useSite();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormState>({ ...EMPTY, courseId: presetCourseId ?? '' });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setValues((current) => ({ ...current, courseId: presetCourseId ?? current.courseId }));
  }, [presetCourseId]);

  const courses = useMemo(
    () => content.courses.items.filter((course) => course.published).sort((a, b) => a.order - b.order),
    [content.courses.items],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validateStep = (index: number) => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (index === 0) {
      if (values.name.trim().length < 2) next.name = ts('form.error.name');
      if (!PHONE_RE.test(values.phone.trim())) next.phone = ts('form.error.phone');
      if (!EMAIL_RE.test(values.email.trim())) next.email = ts('form.error.email');
    }
    // Step 2 has no required field on purpose: "not decided yet" is a valid and
    // common answer, and forcing a pick here costs more leads than it qualifies.
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(STEP_COUNT - 1, current + 1));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Guard every step, not just the last — a keyboard user can reach submit early.
    for (let index = 0; index < STEP_COUNT; index += 1) {
      if (!validateStep(index)) {
        setStep(index);
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, locale, source: compact ? 'modal' : 'landing' }),
      });
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);

      setDone(true);
      toast({
        title: ts('form.success'),
        description: tx(content.lead.successBody),
        tone: 'success',
      });
      onSuccess?.();
    } catch (error) {
      console.error('[lead] submit failed', error);
      toast({ title: ts('form.error.generic'), tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center px-2 py-10 text-center">
        <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </span>
        <h3 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
          {tx(content.lead.successTitle)}
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {tx(content.lead.successBody)}
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setValues({ ...EMPTY, courseId: presetCourseId ?? '' });
            setStep(0);
            setDone(false);
          }}
        >
          {ts('form.another')}
        </Button>
      </div>
    );
  }

  const stepLabels = [ts('form.stepContacts'), ts('form.stepCourse'), ts('form.stepDetails')];

  return (
    <form onSubmit={submit} noValidate className={cn('flex flex-col', compact ? 'gap-5' : 'gap-6')}>
      {/* Stepper */}
      <div>
        <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            {ts('form.step')} {step + 1} {ts('form.of')} {STEP_COUNT}
          </span>
          <span className="font-semibold text-foreground">{stepLabels[step]}</span>
        </div>
        <div className="flex gap-1.5" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEP_COUNT}>
          {stepLabels.map((label, index) => (
            <span
              key={label}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-500',
                index <= step ? 'bg-brand-gradient' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>

      {/* Step 1 — contacts */}
      {step === 0 ? (
        <div className="grid gap-4">
          <div>
            <Label htmlFor="lead-name">{ts('form.name')}</Label>
            <Input
              id="lead-name"
              value={values.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder={ts('form.namePlaceholder')}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'lead-name-error' : undefined}
            />
            <span id="lead-name-error">
              <FieldError>{errors.name}</FieldError>
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="lead-phone">{ts('form.phone')}</Label>
              <Input
                id="lead-phone"
                type="tel"
                inputMode="tel"
                value={values.phone}
                onChange={(event) => set('phone', event.target.value)}
                placeholder="+998 90 123 45 67"
                autoComplete="tel"
                aria-invalid={Boolean(errors.phone)}
              />
              <FieldError>{errors.phone}</FieldError>
            </div>
            <div>
              <Label htmlFor="lead-email">{ts('form.email')}</Label>
              <Input
                id="lead-email"
                type="email"
                inputMode="email"
                value={values.email}
                onChange={(event) => set('email', event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
              />
              <FieldError>{errors.email}</FieldError>
            </div>
          </div>
        </div>
      ) : null}

      {/* Step 2 — track + format */}
      {step === 1 ? (
        <div className="grid gap-5">
          <div>
            <Label htmlFor="lead-course">{ts('form.course')}</Label>
            <Select
              id="lead-course"
              aria-label={ts('form.course')}
              value={values.courseId}
              onValueChange={(courseId) => set('courseId', courseId)}
              options={[
                { value: '', label: ts('form.courseAny') },
                ...content.courses.categories.flatMap((category) =>
                  courses
                    .filter((course) => course.category === category.id)
                    .map((course) => ({
                      value: course.id,
                      label: tx(course.title),
                      group: tx(category.label),
                    })),
                ),
              ]}
              aria-invalid={Boolean(errors.courseId)}
            />
            <FieldError>{errors.courseId}</FieldError>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{ts('form.format')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((option) => {
                const OptionIcon = option.icon;
                const selected = values.format === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => set('format', option.value)}
                    aria-pressed={selected}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl border p-3 text-xs font-medium transition-all duration-300',
                      selected
                        ? 'border-brand-400 bg-brand-500/10 text-foreground shadow-glow'
                        : 'border-border bg-card text-muted-foreground hover:border-brand-400/60',
                    )}
                  >
                    <OptionIcon className="h-5 w-5" aria-hidden />
                    {ts(option.key)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      ) : null}

      {/* Step 3 — details */}
      {step === 2 ? (
        <div className="grid gap-4">
          <div>
            <Label htmlFor="lead-level">{ts('form.level')}</Label>
            <Select
              id="lead-level"
              aria-label={ts('form.level')}
              value={values.level}
              onValueChange={(level) => set('level', level as CourseLevel)}
              options={[
                { value: 'beginner', label: ts('courses.level.beginner') },
                { value: 'intermediate', label: ts('courses.level.intermediate') },
                { value: 'advanced', label: ts('courses.level.advanced') },
              ]}
            />
          </div>
          <div>
            <Label htmlFor="lead-message" hint={ts('form.optional')}>
              {ts('form.message')}
            </Label>
            <Textarea
              id="lead-message"
              value={values.message}
              onChange={(event) => set('message', event.target.value)}
              placeholder={ts('form.messagePlaceholder')}
              maxLength={800}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{tx(content.lead.consent)}</p>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {ts('form.back')}
          </Button>
        ) : null}

        {step < STEP_COUNT - 1 ? (
          <Button type="button" className="flex-1" size="lg" onClick={goNext}>
            {ts('form.next')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button type="submit" className="flex-1" size="lg" loading={submitting}>
            {submitting ? ts('form.sending') : ts('form.submit')}
            {!submitting ? <Send className="h-4 w-4" aria-hidden /> : null}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Global modal wired to `openApply()` from anywhere on the page. */
export function ApplyModal() {
  const { applyOpen, closeApply, applyCourseId, content, tx, ts } = useSite();
  return (
    <Modal
      open={applyOpen}
      onClose={closeApply}
      size="lg"
      title={tx(content.lead.title)}
      description={tx(content.lead.subtitle)}
      closeLabel={ts('a11y.closeModal')}
    >
      <div className="p-6 sm:p-8">
        <LeadForm presetCourseId={applyCourseId} compact />
      </div>
    </Modal>
  );
}

/** Embedded booking section with the centre's contact details alongside. */
export function ApplySection() {
  const { content, tx } = useSite();

  return (
    <SectionShell
      id="apply"
      eyebrow={tx(content.lead.eyebrow)}
      title={tx(content.lead.title)}
      subtitle={tx(content.lead.subtitle)}
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
        {/* Reassurance column */}
        <div className="space-y-5">
          {content.methodology.steps.map((step, index) => (
            <div key={step.id} className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-border bg-card font-display text-sm font-semibold">
                <span className="gradient-text">{index + 1}</span>
              </span>
              <div>
                <p className="font-semibold">{tx(step.title)}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {tx(step.description)}
                </p>
              </div>
            </div>
          ))}

          <div className="!mt-8 rounded-3xl border border-border/70 bg-gradient-to-br from-brand-500/10 via-transparent to-aqua-500/10 p-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {tx(content.footer.about)}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <a href={`tel:${content.footer.phone.replace(/[^+\d]/g, '')}`} className="font-semibold hover:text-brand-400">
                {content.footer.phone}
              </a>
              <a href={`mailto:${content.footer.email}`} className="font-semibold hover:text-brand-400">
                {content.footer.email}
              </a>
            </div>
          </div>
        </div>

        {/* The form itself */}
        <div className="surface-card p-6 sm:p-8">
          <LeadForm />
        </div>
      </div>
    </SectionShell>
  );
}
