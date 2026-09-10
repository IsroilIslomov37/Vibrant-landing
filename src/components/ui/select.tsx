'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  group?: string;
  disabled?: boolean;
  searchText?: string;
}

export interface SelectProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'defaultValue' | 'name' | 'onChange' | 'type' | 'value'
  > {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  name?: string;
  placeholder?: React.ReactNode;
}

interface MenuPosition {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

const triggerStyle =
  'flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-input bg-background/60 px-4 text-left text-sm text-foreground shadow-sm outline-none transition-[border-color,background-color,box-shadow] hover:border-brand-400/60 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/25';

function firstEnabled(options: SelectOption[]) {
  return options.findIndex((option) => !option.disabled);
}

function nextEnabled(options: SelectOption[], current: number, direction: 1 | -1) {
  if (!options.length) return -1;
  let next = current;
  for (let checked = 0; checked < options.length; checked += 1) {
    next = (next + direction + options.length) % options.length;
    if (!options[next]?.disabled) return next;
  }
  return -1;
}

/**
 * A themed listbox instead of the browser's OS-level select popup. Native
 * option menus ignore most CSS on Windows, which made dark fields open a grey
 * system menu. Focus stays on the trigger so the control also works inside our
 * focus-trapped modals.
 */
export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    className,
    disabled,
    id,
    name,
    onClick,
    onKeyDown,
    onValueChange,
    options,
    placeholder = 'Выберите значение',
    value,
    ...props
  },
  forwardedRef,
) {
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const typeaheadRef = React.useRef('');
  const typeaheadTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [position, setPosition] = React.useState<MenuPosition | null>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const setTriggerRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;

    const rect = trigger.getBoundingClientRect();
    const edge = 8;
    const gap = 8;
    const availableBelow = window.innerHeight - rect.bottom - edge;
    const availableAbove = rect.top - edge;
    const estimatedHeight = Math.min(320, Math.max(96, options.length * 42 + 12));
    const openAbove = availableBelow < Math.min(220, estimatedHeight) && availableAbove > availableBelow;
    const available = Math.max(96, (openAbove ? availableAbove : availableBelow) - gap);
    const width = Math.min(Math.max(rect.width, 176), window.innerWidth - edge * 2);
    const left = Math.min(Math.max(edge, rect.left), Math.max(edge, window.innerWidth - width - edge));

    setPosition({
      left,
      width,
      maxHeight: Math.min(320, available),
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  }, [options.length]);

  const resetTypeahead = React.useCallback(() => {
    typeaheadRef.current = '';
    if (typeaheadTimerRef.current) {
      clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = null;
    }
  }, []);

  const closeMenu = React.useCallback(() => {
    resetTypeahead();
    setOpen(false);
  }, [resetTypeahead]);

  const openMenu = React.useCallback(
    (preferredIndex?: number) => {
      if (disabled || options.length === 0) return;
      const fallback = selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : firstEnabled(options);
      setActiveIndex(preferredIndex ?? fallback);
      updatePosition();
      setOpen(true);
    },
    [disabled, options, selectedIndex, updatePosition],
  );

  const choose = React.useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      onValueChange(option.value);
      closeMenu();
      triggerRef.current?.focus({ preventScroll: true });
    },
    [closeMenu, onValueChange, options],
  );

  React.useEffect(() => {
    if (!open) return;
    updatePosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleViewportChange = () => updatePosition();

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [closeMenu, open, updatePosition]);

  React.useEffect(() => {
    if (disabled) closeMenu();
  }, [closeMenu, disabled]);

  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(`${menuId}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, menuId, open]);

  React.useEffect(
    () => () => {
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    },
    [],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key.length === 1 && /\S/u.test(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const key = event.key.toLocaleLowerCase();
      const search = typeaheadRef.current === key ? key : `${typeaheadRef.current}${key}`;
      typeaheadRef.current = search;
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = setTimeout(() => {
        typeaheadRef.current = '';
        typeaheadTimerRef.current = null;
      }, 600);

      const start = activeIndex >= 0 ? activeIndex : selectedIndex;
      for (let offset = 1; offset <= options.length; offset += 1) {
        const index = (Math.max(-1, start) + offset) % options.length;
        const option = options[index];
        const text = option.searchText ?? (typeof option.label === 'string' ? option.label : '');
        if (!option.disabled && text.toLocaleLowerCase().startsWith(search)) {
          event.preventDefault();
          if (open) setActiveIndex(index);
          else openMenu(index);
          return;
        }
      }
    }

    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        resetTypeahead();
        const start = selectedIndex >= 0 ? selectedIndex : firstEnabled(options);
        openMenu(
          event.key === 'ArrowUp' && start >= 0
            ? nextEnabled(options, start, -1)
            : start,
        );
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => nextEnabled(options, current, event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(firstEnabled(options));
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(nextEnabled(options, firstEnabled(options), -1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
    } else if (event.key === 'Tab') {
      closeMenu();
    }
  };

  let previousGroup: string | undefined;

  return (
    <div className="relative w-full">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        {...props}
        ref={setTriggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-autocomplete="none"
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open && activeIndex >= 0 ? `${menuId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        data-state={open ? 'open' : 'closed'}
        className={cn(triggerStyle, open && 'border-brand-400 ring-2 ring-brand-500/25', className)}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          if (open) closeMenu();
          else {
            resetTypeahead();
            openMenu();
          }
        }}
        onKeyDown={handleKeyDown}
      >
        <span className={cn('flex min-w-0 flex-1 items-center gap-2 truncate', !selectedOption && 'text-muted-foreground')}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180 text-brand-400')}
          aria-hidden
        />
      </button>

      {open && position && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="listbox"
              aria-label={props['aria-label']}
              aria-labelledby={props['aria-label'] ? undefined : (props['aria-labelledby'] ?? id)}
              className="fixed z-[130] overflow-y-auto overscroll-contain rounded-2xl border border-border/80 bg-popover/95 p-1.5 text-popover-foreground shadow-[0_22px_70px_-22px_rgba(0,0,0,0.62)] backdrop-blur-xl animate-scale-in"
              style={position}
            >
              {options.map((option, index) => {
                const showGroup = Boolean(option.group && option.group !== previousGroup);
                previousGroup = option.group;
                const selected = index === selectedIndex;
                const active = index === activeIndex;

                return (
                  <React.Fragment key={`${option.value}-${index}`}>
                    {showGroup ? (
                      <div className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground" role="presentation">
                        {option.group}
                      </div>
                    ) : null}
                    <div
                      id={`${menuId}-option-${index}`}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={option.disabled || undefined}
                      className={cn(
                        'flex min-h-10 cursor-default select-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm outline-none transition-colors',
                        option.disabled
                          ? 'opacity-40'
                          : active
                            ? 'bg-brand-500/15 text-foreground'
                            : 'text-popover-foreground hover:bg-muted',
                      )}
                      onPointerEnter={() => {
                        if (!option.disabled) setActiveIndex(index);
                      }}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => choose(index)}
                    >
                      <span className="flex min-w-0 items-center gap-2">{option.label}</span>
                      <Check className={cn('h-4 w-4 shrink-0 text-brand-400', !selected && 'opacity-0')} aria-hidden />
                    </div>
                  </React.Fragment>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
});
