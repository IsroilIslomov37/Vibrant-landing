'use client';

import { Input, Switch } from '@/components/ui/field';
import { GradientPicker } from '@/components/admin/gradient-picker';
import {
  CollectionEditor,
  Grid,
  ImageField,
  LocalizedField,
  LocalizedListField,
  NumberField,
  Panel,
  SelectField,
  TextField,
} from '@/components/admin/primitives';
import { ICON_NAMES } from '@/components/ui/icon';
import { GRADIENT_PRESETS } from '@/lib/seed';
import type { Course, CourseCategoryId, Mentor, Review, SiteContent } from '@/lib/types';
import { createId, slugify, emptyLocalized, preview } from '@/lib/utils';

interface EditorProps {
  content: SiteContent;
  onChange: (content: SiteContent) => void;
}

const LEVEL_OPTIONS = [
  { value: 'beginner' as const, label: 'С нуля' },
  { value: 'intermediate' as const, label: 'Средний' },
  { value: 'advanced' as const, label: 'Продвинутый' },
];

const BADGE_OPTIONS = [
  { value: 'none' as const, label: 'Без бейджа' },
  { value: 'popular' as const, label: 'Популярный' },
  { value: 'new' as const, label: 'Новый' },
  { value: 'limited' as const, label: 'Мало мест' },
];

const CURRENCY_OPTIONS = [
  { value: 'UZS', label: 'UZS (сум)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'RUB', label: 'RUB (₽)' },
];

const ICON_OPTIONS = ICON_NAMES.map((name) => ({ value: name, label: name }));

/** Multi-select of mentors, rendered as toggle chips. */
function MentorPicker({
  mentors,
  selected,
  onChange,
}: {
  mentors: Mentor[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Менторы курса</legend>
      <div className="flex flex-wrap gap-2">
        {mentors.map((mentor) => {
          const active = selected.includes(mentor.id);
          return (
            <button
              key={mentor.id}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange(
                  active ? selected.filter((id) => id !== mentor.id) : [...selected, mentor.id],
                )
              }
              className={
                active
                  ? 'rounded-full border border-transparent bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-brand-400/60 hover:text-foreground'
              }
            >
              {mentor.name}
            </button>
          );
        })}
        {mentors.length === 0 ? (
          <p className="text-xs text-muted-foreground">Сначала добавьте менторов на вкладке «Менторы».</p>
        ) : null}
      </div>
    </fieldset>
  );
}

export function CoursesEditor({ content, onChange }: EditorProps) {
  const categoryOptions = content.courses.categories.map((category) => ({
    value: category.id,
    label: preview(category.label),
  }));

  return (
    <div className="space-y-5">
      <Panel title="Заголовок раздела">
        <div className="space-y-4">
          <LocalizedField
            label="Надзаголовок"
            value={content.courses.eyebrow}
            onChange={(eyebrow) => onChange({ ...content, courses: { ...content.courses, eyebrow } })}
          />
          <LocalizedField
            label="Заголовок"
            value={content.courses.title}
            onChange={(title) => onChange({ ...content, courses: { ...content.courses, title } })}
          />
          <LocalizedField
            label="Описание"
            multiline
            value={content.courses.subtitle}
            onChange={(subtitle) => onChange({ ...content, courses: { ...content.courses, subtitle } })}
          />
        </div>
      </Panel>

      <Panel title="Категории" description="Фильтры над каталогом курсов.">
        <div className="space-y-3">
          {content.courses.categories.map((category) => (
            <div key={category.id} className="rounded-2xl border border-border/70 bg-muted/20 p-3">
              <Grid cols={2}>
                <LocalizedField
                  label={`Категория «${category.id}»`}
                  value={category.label}
                  onChange={(label) =>
                    onChange({
                      ...content,
                      courses: {
                        ...content.courses,
                        categories: content.courses.categories.map((item) =>
                          item.id === category.id ? { ...item, label } : item,
                        ),
                      },
                    })
                  }
                />
                <SelectField
                  label="Иконка"
                  value={category.icon}
                  onChange={(icon) =>
                    onChange({
                      ...content,
                      courses: {
                        ...content.courses,
                        categories: content.courses.categories.map((item) =>
                          item.id === category.id ? { ...item, icon } : item,
                        ),
                      },
                    })
                  }
                  options={ICON_OPTIONS}
                />
              </Grid>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Курсы"
        description="Цены, длительность, бейджи и обложки. Выключенный переключатель скрывает курс с сайта."
      >
        <CollectionEditor<Course>
          items={content.courses.items}
          onChange={(items) => onChange({ ...content, courses: { ...content.courses, items } })}
          addLabel="Добавить курс"
          onCreate={() => ({
            id: createId('course'),
            title: { ru: 'Новый курс', uz: 'Yangi kurs', en: 'New course' },
            summary: emptyLocalized(),
            description: emptyLocalized(),
            category: (content.courses.categories[0]?.id ?? 'it') as CourseCategoryId,
            level: 'beginner',
            durationMonths: 6,
            hoursPerWeek: 6,
            price: 1000000,
            currency: 'UZS',
            badge: 'new',
            mentorIds: [],
            outcomes: [],
            gradient: GRADIENT_PRESETS[0],
            seats: 12,
            seatsTaken: 0,
            published: false,
            order: content.courses.items.length + 1,
          })}
          renderTitle={(course) => preview(course.title) || 'Без названия'}
          renderSummary={(course) =>
            `${course.category} · ${course.durationMonths} мес · ${course.price.toLocaleString('ru-RU')} ${course.currency}`
          }
          renderFields={(course, update) => (
            <>
              <LocalizedField label="Название" value={course.title} onChange={(title) => update({ title })} />
              <LocalizedField
                label="Краткое описание (на карточке)"
                multiline
                value={course.summary}
                onChange={(summary) => update({ summary })}
              />
              <LocalizedField
                label="Полное описание (в модальном окне)"
                multiline
                value={course.description}
                onChange={(description) => update({ description })}
              />

              <Grid cols={3}>
                <SelectField
                  label="Категория"
                  value={course.category}
                  onChange={(category) => update({ category: category as CourseCategoryId })}
                  options={categoryOptions}
                />
                <SelectField label="Уровень" value={course.level} onChange={(level) => update({ level })} options={LEVEL_OPTIONS} />
                <SelectField label="Бейдж" value={course.badge} onChange={(badge) => update({ badge })} options={BADGE_OPTIONS} />
              </Grid>

              <Grid cols={3}>
                <NumberField
                  label="Длительность, мес."
                  value={course.durationMonths}
                  min={1}
                  max={36}
                  onChange={(durationMonths) => update({ durationMonths })}
                />
                <NumberField
                  label="Часов в неделю"
                  value={course.hoursPerWeek}
                  min={1}
                  max={40}
                  onChange={(hoursPerWeek) => update({ hoursPerWeek })}
                />
                <SelectField
                  label="Валюта"
                  value={course.currency}
                  onChange={(currency) => update({ currency })}
                  options={CURRENCY_OPTIONS}
                />
              </Grid>

              <Grid cols={3}>
                <NumberField label="Цена в месяц" value={course.price} min={0} step={10000} onChange={(price) => update({ price })} />
                <NumberField
                  label="Старая цена"
                  hint="0 — скрыть"
                  value={course.oldPrice ?? 0}
                  min={0}
                  step={10000}
                  onChange={(oldPrice) => update({ oldPrice: oldPrice > 0 ? oldPrice : undefined })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="Всего мест" value={course.seats} min={1} max={200} onChange={(seats) => update({ seats })} />
                  <NumberField
                    label="Занято"
                    value={course.seatsTaken}
                    min={0}
                    max={course.seats}
                    onChange={(seatsTaken) => update({ seatsTaken })}
                  />
                </div>
              </Grid>

              <LocalizedListField
                label="Что получит студент"
                items={course.outcomes}
                onChange={(outcomes) => update({ outcomes })}
              />

              <MentorPicker
                mentors={content.mentors.items}
                selected={course.mentorIds}
                onChange={(mentorIds) => update({ mentorIds })}
              />

              <Grid cols={2}>
                <ImageField
                  label="Обложка курса"
                  value={course.coverImage}
                  onChange={(coverImage) => update({ coverImage })}
                />
                <GradientPicker
                  label="Градиент (если нет обложки)"
                  value={course.gradient}
                  onChange={(gradient) => update({ gradient })}
                />
              </Grid>

              <TextField
                label="Идентификатор (slug)"
                hint="используется в ссылках и заявках"
                value={course.id}
                onChange={(id) => update({ id: slugify(id) || course.id })}
              />
            </>
          )}
        />
      </Panel>
    </div>
  );
}

export function MentorsEditor({ content, onChange }: EditorProps) {
  return (
    <div className="space-y-5">
      <Panel title="Заголовок раздела">
        <div className="space-y-4">
          <LocalizedField
            label="Надзаголовок"
            value={content.mentors.eyebrow}
            onChange={(eyebrow) => onChange({ ...content, mentors: { ...content.mentors, eyebrow } })}
          />
          <LocalizedField
            label="Заголовок"
            value={content.mentors.title}
            onChange={(title) => onChange({ ...content, mentors: { ...content.mentors, title } })}
          />
          <LocalizedField
            label="Описание"
            multiline
            value={content.mentors.subtitle}
            onChange={(subtitle) => onChange({ ...content, mentors: { ...content.mentors, subtitle } })}
          />
        </div>
      </Panel>

      <Panel title="Преподаватели">
        <CollectionEditor<Mentor>
          items={content.mentors.items}
          onChange={(items) => onChange({ ...content, mentors: { ...content.mentors, items } })}
          addLabel="Добавить преподавателя"
          onCreate={() => ({
            id: createId('mentor'),
            name: 'Новый преподаватель',
            role: { ru: 'Ментор', uz: 'Mentor', en: 'Mentor' },
            bio: emptyLocalized(),
            initials: 'NN',
            gradient: GRADIENT_PRESETS[1],
            qualifications: [],
            yearsExperience: 3,
            studentsTaught: 50,
            socials: {},
            published: false,
            order: content.mentors.items.length + 1,
          })}
          renderTitle={(mentor) => mentor.name}
          renderSummary={(mentor) => preview(mentor.role)}
          renderFields={(mentor, update) => (
            <>
              <Grid cols={2}>
                <TextField
                  label="Имя и фамилия"
                  value={mentor.name}
                  onChange={(name) =>
                    update({
                      name,
                      // Keep the avatar fallback in step with the name unless it was set by hand.
                      initials:
                        name
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0]?.toUpperCase() ?? '')
                          .join('') || mentor.initials,
                    })
                  }
                />
                <TextField
                  label="Инициалы"
                  hint="показываются без фото"
                  value={mentor.initials}
                  onChange={(initials) => update({ initials: initials.slice(0, 3).toUpperCase() })}
                />
              </Grid>

              <LocalizedField label="Должность" value={mentor.role} onChange={(role) => update({ role })} />
              <LocalizedField label="О преподавателе" multiline value={mentor.bio} onChange={(bio) => update({ bio })} />

              <LocalizedListField
                label="Квалификации"
                items={mentor.qualifications}
                onChange={(qualifications) => update({ qualifications })}
              />

              <Grid cols={2}>
                <NumberField
                  label="Лет опыта"
                  value={mentor.yearsExperience}
                  min={0}
                  max={60}
                  onChange={(yearsExperience) => update({ yearsExperience })}
                />
                <NumberField
                  label="Студентов обучено"
                  value={mentor.studentsTaught}
                  min={0}
                  step={10}
                  onChange={(studentsTaught) => update({ studentsTaught })}
                />
              </Grid>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Соцсети</legend>
                <Grid cols={2}>
                  {(['telegram', 'linkedin', 'github', 'website'] as const).map((key) => (
                    <Input
                      key={key}
                      value={mentor.socials[key] ?? ''}
                      placeholder={key}
                      aria-label={`${mentor.name} — ${key}`}
                      onChange={(event) =>
                        update({ socials: { ...mentor.socials, [key]: event.target.value || undefined } })
                      }
                    />
                  ))}
                </Grid>
              </fieldset>

              <Grid cols={2}>
                <ImageField label="Фото" value={mentor.avatar} onChange={(avatar) => update({ avatar })} />
                <GradientPicker
                  label="Градиент (если нет фото)"
                  value={mentor.gradient}
                  onChange={(gradient) => update({ gradient })}
                />
              </Grid>
            </>
          )}
        />
      </Panel>
    </div>
  );
}

export function ReviewsEditor({ content, onChange }: EditorProps) {
  const courseOptions = [
    { value: '', label: '— не указан —' },
    ...content.courses.items.map((course) => ({ value: course.id, label: preview(course.title) })),
  ];

  return (
    <div className="space-y-5">
      <Panel title="Заголовок раздела">
        <div className="space-y-4">
          <LocalizedField
            label="Надзаголовок"
            value={content.reviews.eyebrow}
            onChange={(eyebrow) => onChange({ ...content, reviews: { ...content.reviews, eyebrow } })}
          />
          <LocalizedField
            label="Заголовок"
            value={content.reviews.title}
            onChange={(title) => onChange({ ...content, reviews: { ...content.reviews, title } })}
          />
          <LocalizedField
            label="Описание"
            multiline
            value={content.reviews.subtitle}
            onChange={(subtitle) => onChange({ ...content, reviews: { ...content.reviews, subtitle } })}
          />
        </div>
      </Panel>

      <Panel
        title="Отзывы"
        description="Метрика «до / после» — главный элемент доверия, заполняйте её везде, где можно."
      >
        <CollectionEditor<Review>
          items={content.reviews.items}
          onChange={(items) => onChange({ ...content, reviews: { ...content.reviews, items } })}
          addLabel="Добавить отзыв"
          onCreate={() => ({
            id: createId('review'),
            author: 'Новый студент',
            authorRole: { ru: 'Выпускник', uz: 'Bitiruvchi', en: 'Graduate' },
            quote: emptyLocalized(),
            initials: 'НС',
            gradient: GRADIENT_PRESETS[2],
            rating: 5,
            featured: false,
            published: false,
            order: content.reviews.items.length + 1,
          })}
          renderTitle={(review) => review.author}
          renderSummary={(review) => preview(review.quote).slice(0, 90) || preview(review.authorRole)}
          renderFields={(review, update) => (
            <>
              <Grid cols={3}>
                <TextField label="Имя" value={review.author} onChange={(author) => update({ author })} />
                <TextField
                  label="Инициалы"
                  value={review.initials}
                  onChange={(initials) => update({ initials: initials.slice(0, 3).toUpperCase() })}
                />
                <NumberField label="Оценка (1–5)" value={review.rating} min={1} max={5} onChange={(rating) => update({ rating })} />
              </Grid>

              <LocalizedField
                label="Кто это"
                value={review.authorRole}
                onChange={(authorRole) => update({ authorRole })}
              />
              <LocalizedField label="Текст отзыва" multiline value={review.quote} onChange={(quote) => update({ quote })} />

              <Grid cols={2}>
                <SelectField
                  label="Курс"
                  value={review.courseId ?? ''}
                  onChange={(courseId) => update({ courseId: courseId || undefined })}
                  options={courseOptions}
                />
                <TextField
                  label="Ссылка на видео"
                  hint="embed-ссылка YouTube или .mp4"
                  value={review.videoUrl ?? ''}
                  onChange={(videoUrl) => update({ videoUrl: videoUrl || undefined })}
                />
              </Grid>

              <fieldset className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <legend className="px-1 text-sm font-medium">Метрика роста</legend>
                <div className="space-y-3">
                  <LocalizedField
                    label="Название метрики"
                    value={review.metric?.label ?? emptyLocalized()}
                    onChange={(label) =>
                      update({
                        metric: {
                          label,
                          before: review.metric?.before ?? '',
                          after: review.metric?.after ?? '',
                        },
                      })
                    }
                  />
                  <Grid cols={2}>
                    <TextField
                      label="Было"
                      value={review.metric?.before ?? ''}
                      onChange={(before) =>
                        update({
                          metric: {
                            label: review.metric?.label ?? emptyLocalized(),
                            before,
                            after: review.metric?.after ?? '',
                          },
                        })
                      }
                    />
                    <TextField
                      label="Стало"
                      value={review.metric?.after ?? ''}
                      onChange={(after) =>
                        update({
                          metric: {
                            label: review.metric?.label ?? emptyLocalized(),
                            before: review.metric?.before ?? '',
                            after,
                          },
                        })
                      }
                    />
                  </Grid>
                </div>
              </fieldset>

              <Grid cols={2}>
                <ImageField label="Фото" value={review.avatar} onChange={(avatar) => update({ avatar })} />
                <GradientPicker
                  label="Градиент аватара"
                  value={review.gradient}
                  onChange={(gradient) => update({ gradient })}
                />
              </Grid>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/40 p-3">
                <div>
                  <p className="text-sm font-medium">Закрепить в начале списка</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Отзыв будет показан первым.</p>
                </div>
                <Switch
                  checked={review.featured}
                  onCheckedChange={(featured) => update({ featured })}
                  label="Закрепить отзыв в начале списка"
                />
              </div>
            </>
          )}
        />
      </Panel>
    </div>
  );
}
