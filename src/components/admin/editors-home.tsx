'use client';

import { useState } from 'react';
import { Camera, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import {
  Grid,
  LocalizedField,
  NumberField,
  Panel,
  SelectField,
  TextField,
  ToggleField,
} from '@/components/admin/primitives';
import { LOCALES, type HeroStage, type SiteContent } from '@/lib/types';
import { cn, createId, emptyLocalized, preview } from '@/lib/utils';

interface EditorProps {
  content: SiteContent;
  onChange: (content: SiteContent) => void;
}

/** Numeric controls for one hero keyframe — this is the no-code camera rig. */
function CameraEditor({
  stage,
  onChange,
}: {
  stage: HeroStage;
  onChange: (camera: HeroStage['camera']) => void;
}) {
  const [open, setOpen] = useState(false);
  const camera = stage.camera;
  const set = (patch: Partial<HeroStage['camera']>) => onChange({ ...camera, ...patch });

  return (
    <div className="rounded-2xl border border-border/70 bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Camera className="h-4 w-4 text-brand-400" aria-hidden />
          Положение камеры
          <span className="font-normal text-muted-foreground">
            (поворот {camera.yaw}°, наклон {camera.pitch}°, дистанция {camera.distance})
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border/70 p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Эти значения задают ракурс 3D-сцены на этом этапе прокрутки. Между этапами камера
            перелетает плавно — достаточно задать крайние точки.
          </p>

          <Grid cols={3}>
            <NumberField label="Поворот (yaw°)" value={camera.yaw} min={-720} max={720} onChange={(yaw) => set({ yaw })} />
            <NumberField label="Наклон (pitch°)" value={camera.pitch} min={-78} max={78} onChange={(pitch) => set({ pitch })} />
            <NumberField label="Дистанция" value={camera.distance} min={4} max={80} step={0.5} onChange={(distance) => set({ distance })} />
            <NumberField label="Угол обзора (fov°)" value={camera.fov} min={16} max={90} onChange={(fov) => set({ fov })} />
            <NumberField label="Крен (roll°)" value={camera.roll} min={-25} max={25} step={0.5} onChange={(roll) => set({ roll })} />
            <NumberField label="Направление света°" value={camera.lightYaw} min={0} max={360} onChange={(lightYaw) => set({ lightYaw })} />
          </Grid>

          <Grid cols={3}>
            <NumberField
              label="Цель X"
              value={camera.target.x}
              min={-30}
              max={30}
              step={0.2}
              onChange={(x) => set({ target: { ...camera.target, x } })}
            />
            <NumberField
              label="Цель Y"
              value={camera.target.y}
              min={-5}
              max={20}
              step={0.2}
              onChange={(y) => set({ target: { ...camera.target, y } })}
            />
            <NumberField
              label="Цель Z"
              value={camera.target.z}
              min={-30}
              max={30}
              step={0.2}
              onChange={(z) => set({ target: { ...camera.target, z } })}
            />
          </Grid>

          <Grid cols={2}>
            <NumberField
              label="Яркость сцены"
              value={camera.exposure}
              min={0.4}
              max={2}
              step={0.01}
              onChange={(exposure) => set({ exposure })}
            />
            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label="Фокус: центр"
                value={camera.focus.hub}
                min={0}
                max={1}
                step={0.05}
                onChange={(hub) => set({ focus: { ...camera.focus, hub } })}
              />
              <NumberField
                label="Фокус: столы"
                value={camera.focus.desks}
                min={0}
                max={1}
                step={0.05}
                onChange={(desks) => set({ focus: { ...camera.focus, desks } })}
              />
              <NumberField
                label="Фокус: комьюнити"
                value={camera.focus.community}
                min={0}
                max={1}
                step={0.05}
                onChange={(community) => set({ focus: { ...camera.focus, community } })}
              />
            </div>
          </Grid>
        </div>
      ) : null}
    </div>
  );
}

export function HomepageEditor({ content, onChange }: EditorProps) {
  const [openStage, setOpenStage] = useState<string | null>(content.hero.stages[0]?.id ?? null);

  const setHeroStage = (id: string, patch: Partial<HeroStage>) => {
    onChange({
      ...content,
      hero: {
        ...content.hero,
        stages: content.hero.stages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)),
      },
    });
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= content.hero.stages.length) return;
    const stages = [...content.hero.stages];
    [stages[index], stages[target]] = [stages[target], stages[index]];
    onChange({ ...content, hero: { ...content.hero, stages } });
  };

  const addStage = () => {
    const last = content.hero.stages[content.hero.stages.length - 1];
    const stage: HeroStage = {
      id: createId('stage'),
      badge: { ru: 'Новый этап', uz: 'Yangi bosqich', en: 'New stage' },
      title: { ru: 'Заголовок', uz: 'Sarlavha', en: 'Headline' },
      highlight: { ru: 'акцент', uz: 'urg‘u', en: 'accent' },
      subtitle: emptyLocalized(),
      primaryCta: { label: { ru: 'Записаться', uz: 'Yozilish', en: 'Enroll' }, href: '#apply' },
      secondaryCta: { label: { ru: 'Курсы', uz: 'Kurslar', en: 'Courses' }, href: '#courses' },
      // Seed the new keyframe from the previous one so the camera move is sane.
      camera: last
        ? { ...last.camera, yaw: last.camera.yaw + 60, target: { ...last.camera.target } }
        : {
            yaw: 0,
            pitch: 24,
            distance: 28,
            target: { x: 0, y: 2, z: 0 },
            fov: 42,
            roll: 0,
            lightYaw: 60,
            exposure: 1,
            focus: { hub: 1, desks: 0.3, community: 0.3 },
          },
    };
    onChange({ ...content, hero: { ...content.hero, stages: [...content.hero.stages, stage] } });
    setOpenStage(stage.id);
  };

  return (
    <div className="space-y-5">
      <Panel title="Бренд" description="Название и подпись используются в шапке, подвале и мета-тегах.">
        <Grid cols={2}>
          <TextField
            label="Название центра"
            value={content.brand.name}
            onChange={(name) => onChange({ ...content, brand: { ...content.brand, name } })}
          />
          <TextField
            label="Логотип (2 буквы)"
            value={content.brand.logoMark}
            onChange={(logoMark) =>
              onChange({ ...content, brand: { ...content.brand, logoMark: logoMark.slice(0, 3) } })
            }
          />
        </Grid>
        <div className="mt-4">
          <LocalizedField
            label="Подпись под названием"
            value={content.brand.tagline}
            onChange={(tagline) => onChange({ ...content, brand: { ...content.brand, tagline } })}
          />
        </div>
      </Panel>

      <Panel
        title="Баннер-объявление"
        description="Верхняя полоса над шапкой. Используйте для набора, дедлайнов и скидок."
      >
        <div className="space-y-4">
          <ToggleField
            label="Показывать баннер"
            description="Посетитель может закрыть баннер — он вернётся при следующем визите."
            checked={content.announcement.enabled}
            onChange={(enabled) =>
              onChange({ ...content, announcement: { ...content.announcement, enabled } })
            }
          />
          <LocalizedField
            label="Текст баннера"
            value={content.announcement.text}
            onChange={(text) => onChange({ ...content, announcement: { ...content.announcement, text } })}
          />
          <Grid cols={3}>
            <div className="sm:col-span-2">
              <LocalizedField
                label="Текст кнопки"
                value={content.announcement.ctaLabel}
                onChange={(ctaLabel) =>
                  onChange({ ...content, announcement: { ...content.announcement, ctaLabel } })
                }
              />
            </div>
            <TextField
              label="Ссылка кнопки"
              hint="#apply откроет форму"
              value={content.announcement.ctaHref}
              onChange={(ctaHref) =>
                onChange({ ...content, announcement: { ...content.announcement, ctaHref } })
              }
            />
          </Grid>
          <SelectField
            label="Цвет"
            value={content.announcement.tone}
            onChange={(tone) => onChange({ ...content, announcement: { ...content.announcement, tone } })}
            options={[
              { value: 'brand', label: 'Фиолетовый' },
              { value: 'sun', label: 'Оранжевый' },
              { value: 'aqua', label: 'Бирюзовый' },
            ]}
          />
        </div>
      </Panel>

      <Panel title="Навигация" description="Пункты меню в шапке и кнопка-призыв.">
        <div className="space-y-3">
          {content.nav.links.map((link, index) => (
            <div key={link.id} className="flex items-end gap-2 rounded-2xl border border-border/70 bg-muted/20 p-3">
              <div className="grid flex-1 gap-2 sm:grid-cols-3">
                {LOCALES.map((locale) => (
                  <Input
                    key={locale}
                    value={link.label[locale]}
                    aria-label={`Пункт меню ${index + 1} (${locale.toUpperCase()})`}
                    placeholder={locale.toUpperCase()}
                    onChange={(event) =>
                      onChange({
                        ...content,
                        nav: {
                          ...content.nav,
                          links: content.nav.links.map((item) =>
                            item.id === link.id
                              ? { ...item, label: { ...item.label, [locale]: event.target.value } }
                              : item,
                          ),
                        },
                      })
                    }
                  />
                ))}
                <Input
                  value={link.href}
                  aria-label={`Ссылка пункта ${index + 1}`}
                  placeholder="#courses"
                  onChange={(event) =>
                    onChange({
                      ...content,
                      nav: {
                        ...content.nav,
                        links: content.nav.links.map((item) =>
                          item.id === link.id ? { ...item, href: event.target.value } : item,
                        ),
                      },
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Удалить пункт ${index + 1}`}
                onClick={() =>
                  onChange({
                    ...content,
                    nav: { ...content.nav, links: content.nav.links.filter((item) => item.id !== link.id) },
                  })
                }
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
              onChange({
                ...content,
                nav: {
                  ...content.nav,
                  links: [
                    ...content.nav.links,
                    { id: createId('nav'), label: { ru: 'Новый пункт', uz: 'Yangi bo‘lim', en: 'New link' }, href: '#' },
                  ],
                },
              })
            }
          >
            <Plus className="h-4 w-4" aria-hidden />
            Добавить пункт меню
          </Button>

          <div className="grid gap-4 pt-2 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <LocalizedField
                label="Кнопка в шапке"
                value={content.nav.ctaLabel}
                onChange={(ctaLabel) => onChange({ ...content, nav: { ...content.nav, ctaLabel } })}
              />
            </div>
            <TextField
              label="Ссылка кнопки"
              value={content.nav.ctaHref}
              onChange={(ctaHref) => onChange({ ...content, nav: { ...content.nav, ctaHref } })}
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="Первый экран (3D-сцена)"
        description="Каждый этап — это один экран прокрутки: свой текст и свой ракурс камеры."
      >
        <div className="space-y-3">
          {content.hero.stages.map((stage, index) => {
            const open = openStage === stage.id;
            return (
              <article key={stage.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2 p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenStage(open ? null : stage.id)}
                    aria-expanded={open}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-semibold">
                      {preview(stage.title)} {preview(stage.highlight)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{preview(stage.badge)}</span>
                  </button>

                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveStage(index, -1)}
                      disabled={index === 0}
                      aria-label="Выше"
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-25"
                    >
                      <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStage(index, 1)}
                      disabled={index === content.hero.stages.length - 1}
                      aria-label="Ниже"
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-25"
                    >
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Удалить этап"
                    disabled={content.hero.stages.length <= 1}
                    onClick={() =>
                      onChange({
                        ...content,
                        hero: {
                          ...content.hero,
                          stages: content.hero.stages.filter((item) => item.id !== stage.id),
                        },
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={open ? 'Свернуть' : 'Развернуть'}
                    onClick={() => setOpenStage(open ? null : stage.id)}
                  >
                    <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
                  </Button>
                </div>

                {open ? (
                  <div className="space-y-4 border-t border-border/70 bg-muted/20 p-4 sm:p-5">
                    <LocalizedField
                      label="Бейдж"
                      value={stage.badge}
                      onChange={(badge) => setHeroStage(stage.id, { badge })}
                    />
                    <LocalizedField
                      label="Заголовок"
                      value={stage.title}
                      onChange={(title) => setHeroStage(stage.id, { title })}
                    />
                    <LocalizedField
                      label="Выделенная часть заголовка"
                      value={stage.highlight}
                      onChange={(highlight) => setHeroStage(stage.id, { highlight })}
                    />
                    <LocalizedField
                      label="Подзаголовок"
                      multiline
                      value={stage.subtitle}
                      onChange={(subtitle) => setHeroStage(stage.id, { subtitle })}
                    />

                    <Grid cols={2}>
                      <div className="space-y-2">
                        <LocalizedField
                          label="Основная кнопка"
                          value={stage.primaryCta.label}
                          onChange={(label) =>
                            setHeroStage(stage.id, { primaryCta: { ...stage.primaryCta, label } })
                          }
                        />
                        <Input
                          value={stage.primaryCta.href}
                          aria-label="Ссылка основной кнопки"
                          placeholder="#apply"
                          onChange={(event) =>
                            setHeroStage(stage.id, {
                              primaryCta: { ...stage.primaryCta, href: event.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <LocalizedField
                          label="Вторая кнопка"
                          value={stage.secondaryCta.label}
                          onChange={(label) =>
                            setHeroStage(stage.id, { secondaryCta: { ...stage.secondaryCta, label } })
                          }
                        />
                        <Input
                          value={stage.secondaryCta.href}
                          aria-label="Ссылка второй кнопки"
                          placeholder="#courses"
                          onChange={(event) =>
                            setHeroStage(stage.id, {
                              secondaryCta: { ...stage.secondaryCta, href: event.target.value },
                            })
                          }
                        />
                      </div>
                    </Grid>

                    <CameraEditor stage={stage} onChange={(camera) => setHeroStage(stage.id, { camera })} />
                  </div>
                ) : null}
              </article>
            );
          })}

          <Button type="button" variant="outline" className="w-full" onClick={addStage}>
            <Plus className="h-4 w-4" aria-hidden />
            Добавить этап
          </Button>

          <div className="pt-2">
            <LocalizedField
              label="Подсказка о прокрутке"
              value={content.hero.scrollHint}
              onChange={(scrollHint) => onChange({ ...content, hero: { ...content.hero, scrollHint } })}
            />
          </div>
        </div>
      </Panel>
    </div>
  );
}
