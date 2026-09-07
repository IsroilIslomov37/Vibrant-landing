'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import {
  CollectionEditor,
  Grid,
  LocalizedField,
  NumberField,
  Panel,
  SelectField,
  TextField,
  ToggleField,
} from '@/components/admin/primitives';
import { ICON_NAMES } from '@/components/ui/icon';
import type { FeatureItem, ProcessStep, SiteContent, StatItem } from '@/lib/types';
import { createId } from '@/lib/utils';

interface EditorProps {
  content: SiteContent;
  onChange: (content: SiteContent) => void;
}

const ICON_OPTIONS = ICON_NAMES.map((name) => ({ value: name, label: name }));
const ACCENT_OPTIONS = [
  { value: 'brand', label: 'Фиолетовый' },
  { value: 'aqua', label: 'Бирюзовый' },
  { value: 'sun', label: 'Оранжевый' },
  { value: 'rose', label: 'Розовый' },
];

/** Features, stats and steps have no `published` flag, so they get plain order-only ids. */
type Orderable<T> = T & { id: string; order: number };

function withOrder<T extends { id: string }>(items: T[]): Orderable<T>[] {
  return items.map((item, index) => ({ ...item, order: index }));
}

function stripOrder<T extends { id: string; order: number }>(items: Orderable<T>[]): Omit<T, 'order'>[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...rest }) => rest as Omit<T, 'order'>);
}

export function MethodologyEditor({ content, onChange }: EditorProps) {
  const methodology = content.methodology;
  const set = (patch: Partial<SiteContent['methodology']>) =>
    onChange({ ...content, methodology: { ...methodology, ...patch } });

  return (
    <div className="space-y-5">
      <Panel title="Заголовок раздела">
        <div className="space-y-4">
          <LocalizedField label="Надзаголовок" value={methodology.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
          <LocalizedField label="Заголовок" value={methodology.title} onChange={(title) => set({ title })} />
          <LocalizedField label="Описание" multiline value={methodology.subtitle} onChange={(subtitle) => set({ subtitle })} />
        </div>
      </Panel>

      <Panel title="Цифры" description="Счётчики оживают при прокрутке до раздела.">
        <CollectionEditor<Orderable<StatItem>>
          items={withOrder(methodology.stats)}
          onChange={(items) => set({ stats: stripOrder(items) as StatItem[] })}
          addLabel="Добавить показатель"
          onCreate={() => ({
            id: createId('stat'),
            label: { ru: 'Новый показатель', en: 'New stat' },
            value: 100,
            suffix: '+',
            icon: 'Trophy',
            order: methodology.stats.length,
          })}
          renderTitle={(stat) => `${stat.value}${stat.suffix} — ${stat.label.ru}`}
          renderFields={(stat, update) => (
            <>
              <LocalizedField label="Подпись" value={stat.label} onChange={(label) => update({ label })} />
              <Grid cols={3}>
                <NumberField label="Значение" value={stat.value} min={0} step={1} onChange={(value) => update({ value })} />
                <TextField
                  label="Суффикс"
                  hint="+, %, .0"
                  value={stat.suffix}
                  onChange={(suffix) => update({ suffix })}
                />
                <SelectField label="Иконка" value={stat.icon} onChange={(icon) => update({ icon })} options={ICON_OPTIONS} />
              </Grid>
            </>
          )}
        />
      </Panel>

      <Panel title="Преимущества" description="Карточки с 3D-наклоном при наведении.">
        <CollectionEditor<Orderable<FeatureItem>>
          items={withOrder(methodology.features)}
          onChange={(items) => set({ features: stripOrder(items) as FeatureItem[] })}
          addLabel="Добавить преимущество"
          onCreate={() => ({
            id: createId('feature'),
            title: { ru: 'Новое преимущество', en: 'New feature' },
            description: { ru: '', en: '' },
            icon: 'Sparkles',
            accent: 'brand',
            order: methodology.features.length,
          })}
          renderTitle={(feature) => feature.title.ru}
          renderSummary={(feature) => feature.description.ru}
          renderFields={(feature, update) => (
            <>
              <LocalizedField label="Заголовок" value={feature.title} onChange={(title) => update({ title })} />
              <LocalizedField
                label="Описание"
                multiline
                value={feature.description}
                onChange={(description) => update({ description })}
              />
              <Grid cols={2}>
                <SelectField label="Иконка" value={feature.icon} onChange={(icon) => update({ icon })} options={ICON_OPTIONS} />
                <SelectField label="Акцент" value={feature.accent} onChange={(accent) => update({ accent })} options={ACCENT_OPTIONS} />
              </Grid>
            </>
          )}
        />
      </Panel>

      <Panel title="Этапы обучения" description="Показываются и в разделе «Методика», и рядом с формой заявки.">
        <CollectionEditor<Orderable<ProcessStep>>
          items={withOrder(methodology.steps)}
          onChange={(items) => set({ steps: stripOrder(items) as ProcessStep[] })}
          addLabel="Добавить этап"
          onCreate={() => ({
            id: createId('step'),
            title: { ru: 'Новый этап', en: 'New step' },
            description: { ru: '', en: '' },
            order: methodology.steps.length,
          })}
          renderTitle={(step) => step.title.ru}
          renderSummary={(step) => step.description.ru}
          renderFields={(step, update) => (
            <>
              <LocalizedField label="Название" value={step.title} onChange={(title) => update({ title })} />
              <LocalizedField
                label="Описание"
                multiline
                value={step.description}
                onChange={(description) => update({ description })}
              />
            </>
          )}
        />
      </Panel>
    </div>
  );
}

export function SettingsEditor({ content, onChange }: EditorProps) {
  const footer = content.footer;
  const setFooter = (patch: Partial<SiteContent['footer']>) =>
    onChange({ ...content, footer: { ...footer, ...patch } });

  return (
    <div className="space-y-5">
      <Panel title="Форма заявки" description="Тексты вокруг формы и сообщение после отправки.">
        <div className="space-y-4">
          <LocalizedField
            label="Надзаголовок"
            value={content.lead.eyebrow}
            onChange={(eyebrow) => onChange({ ...content, lead: { ...content.lead, eyebrow } })}
          />
          <LocalizedField
            label="Заголовок"
            value={content.lead.title}
            onChange={(title) => onChange({ ...content, lead: { ...content.lead, title } })}
          />
          <LocalizedField
            label="Описание"
            multiline
            value={content.lead.subtitle}
            onChange={(subtitle) => onChange({ ...content, lead: { ...content.lead, subtitle } })}
          />
          <LocalizedField
            label="Заголовок после отправки"
            value={content.lead.successTitle}
            onChange={(successTitle) => onChange({ ...content, lead: { ...content.lead, successTitle } })}
          />
          <LocalizedField
            label="Текст после отправки"
            multiline
            value={content.lead.successBody}
            onChange={(successBody) => onChange({ ...content, lead: { ...content.lead, successBody } })}
          />
          <LocalizedField
            label="Согласие на обработку данных"
            multiline
            value={content.lead.consent}
            onChange={(consent) => onChange({ ...content, lead: { ...content.lead, consent } })}
          />
        </div>
      </Panel>

      <Panel title="Контакты и подвал">
        <div className="space-y-4">
          <LocalizedField label="О центре" multiline value={footer.about} onChange={(about) => setFooter({ about })} />
          <LocalizedField label="Адрес" value={footer.address} onChange={(address) => setFooter({ address })} />
          <Grid cols={3}>
            <TextField label="Телефон" value={footer.phone} onChange={(phone) => setFooter({ phone })} />
            <TextField label="Email" type="email" value={footer.email} onChange={(email) => setFooter({ email })} />
            <TextField label="Ссылка на карту" value={footer.mapUrl} onChange={(mapUrl) => setFooter({ mapUrl })} />
          </Grid>
          <LocalizedField
            label="Заголовок рассылки"
            value={footer.newsletterTitle}
            onChange={(newsletterTitle) => setFooter({ newsletterTitle })}
          />
          <LocalizedField
            label="Описание рассылки"
            multiline
            value={footer.newsletterSubtitle}
            onChange={(newsletterSubtitle) => setFooter({ newsletterSubtitle })}
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Соцсети</legend>
            <div className="space-y-2">
              {footer.socials.map((social, index) => (
                <div key={social.id} className="flex items-end gap-2">
                  <div className="grid flex-1 gap-2 sm:grid-cols-3">
                    <Input
                      value={social.label}
                      aria-label={`Соцсеть ${index + 1}: название`}
                      placeholder="Telegram"
                      onChange={(event) =>
                        setFooter({
                          socials: footer.socials.map((item) =>
                            item.id === social.id ? { ...item, label: event.target.value } : item,
                          ),
                        })
                      }
                    />
                    <Input
                      value={social.href}
                      aria-label={`Соцсеть ${index + 1}: ссылка`}
                      placeholder="https://…"
                      onChange={(event) =>
                        setFooter({
                          socials: footer.socials.map((item) =>
                            item.id === social.id ? { ...item, href: event.target.value } : item,
                          ),
                        })
                      }
                    />
                    <select
                      value={social.icon}
                      aria-label={`Соцсеть ${index + 1}: иконка`}
                      onChange={(event) =>
                        setFooter({
                          socials: footer.socials.map((item) =>
                            item.id === social.id ? { ...item, icon: event.target.value } : item,
                          ),
                        })
                      }
                      className="h-11 rounded-xl border border-input bg-background/60 px-3 text-sm"
                    >
                      {ICON_NAMES.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Удалить соцсеть ${index + 1}`}
                    onClick={() => setFooter({ socials: footer.socials.filter((item) => item.id !== social.id) })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  setFooter({
                    socials: [
                      ...footer.socials,
                      { id: createId('social'), label: 'Новая сеть', href: 'https://', icon: 'Globe' },
                    ],
                  })
                }
              >
                <Plus className="h-4 w-4" aria-hidden />
                Добавить соцсеть
              </Button>
            </div>
          </fieldset>
        </div>
      </Panel>

      <Panel
        title="Уведомления о заявках"
        description="Ключи задаются переменными окружения — здесь только включение каналов."
      >
        <div className="space-y-4">
          <ToggleField
            label="Telegram"
            description="Требует TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env.local"
            checked={content.integrations.telegramEnabled}
            onChange={(telegramEnabled) =>
              onChange({ ...content, integrations: { ...content.integrations, telegramEnabled } })
            }
          />
          <ToggleField
            label="Email"
            description="Требует подключённого почтового провайдера в src/lib/notify.ts"
            checked={content.integrations.emailEnabled}
            onChange={(emailEnabled) =>
              onChange({ ...content, integrations: { ...content.integrations, emailEnabled } })
            }
          />
          <TextField
            label="Email для уведомлений"
            type="email"
            value={content.integrations.notifyEmail}
            onChange={(notifyEmail) =>
              onChange({ ...content, integrations: { ...content.integrations, notifyEmail } })
            }
          />
        </div>
      </Panel>
    </div>
  );
}
