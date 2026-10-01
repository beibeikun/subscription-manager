import React, {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus } from "lucide-react";

type Props = {
  children: React.ReactNode;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: { target: { value: string } }) => void;
  "aria-label": string;
  disabled?: boolean;
  editable?: boolean;
  maxLength?: number;
  pattern?: string;
  required?: boolean;
};
type Option = {
  value: string;
  label: React.ReactNode;
  color?: string;
  description?: string;
  add?: boolean;
  disabled?: boolean;
};

export function Select({
  children,
  value,
  defaultValue = "",
  onChange,
  "aria-label": label,
  disabled,
  editable,
  maxLength,
  pattern,
  required,
}: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [localValue, setLocalValue] = useState(String(defaultValue));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const props = (child as React.ReactElement<any>).props;
      return {
        value: String(props.value ?? props.children),
        label: props.children,
        color: props["data-color"],
        description: props["data-description"],
        add: props["data-add"],
        disabled: props.disabled,
      } as Option;
    });
  const current = String(value ?? localValue);
  const selectedIndex = options.findIndex((option) => option.value === current);
  const selected = options[selectedIndex];
  const update = (next: string) => {
    setLocalValue(next);
    onChange?.({ target: { value: next } });
  };
  const choose = (index: number) => {
    if (!options[index] || options[index].disabled) return;
    update(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 15;
      const above = rect.top - 15;
      const height = Math.min(280, options.length * 44 + 10);
      const flip = below < height && above > below;
      const width = Math.min(Math.max(rect.width, 200), window.innerWidth - 16);
      setPosition({
        position: "fixed",
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
        top: flip ? undefined : rect.bottom + 7,
        bottom: flip ? window.innerHeight - rect.top + 7 : undefined,
        maxHeight: Math.max(44, Math.min(height, flip ? above : below)),
      });
    };
    const onScroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) place();
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => {
    const option = document.getElementById(`${id}-${active}`);
    if (!open || !option || !menu.current) return;
    const container = menu.current;
    if (option.offsetTop < container.scrollTop)
      container.scrollTop = option.offsetTop;
    else if (
      option.offsetTop + option.offsetHeight >
      container.scrollTop + container.clientHeight
    )
      container.scrollTop =
        option.offsetTop + option.offsetHeight - container.clientHeight;
  }, [open, active, id]);

  const keyboard = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    } else if (
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) &&
      (!editable || open || event.key.startsWith("Arrow"))
    ) {
      event.preventDefault();
      const enabled = options
        .map((option, index) => (option.disabled ? -1 : index))
        .filter((index) => index >= 0);
      if (!enabled.length) return;
      if (!open) {
        setActive(selectedIndex >= 0 ? selectedIndex : enabled[0]);
        setOpen(true);
      } else {
        const index = enabled.indexOf(active);
        setActive(
          event.key === "Home"
            ? enabled[0]
            : event.key === "End"
              ? enabled[enabled.length - 1]
              : enabled[
                  (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    enabled.length) %
                    enabled.length
                ],
        );
      }
    } else if (
      open &&
      (event.key === "Enter" || (!editable && event.key === " "))
    ) {
      event.preventDefault();
      if (active >= 0) choose(active);
      else setOpen(false);
    } else if (
      !editable &&
      event.key.length === 1 &&
      event.key !== " " &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      const now = Date.now();
      search.current = {
        text:
          (now - search.current.time < 700 ? search.current.text : "") +
          event.key.toLocaleLowerCase(),
        time: now,
      };
      const index = options.findIndex(
        (option) =>
          !option.disabled &&
          String(option.label)
            .toLocaleLowerCase()
            .startsWith(search.current.text),
      );
      if (index >= 0) {
        event.preventDefault();
        setActive(index);
        setOpen(true);
      }
    }
  };
  const semantics = {
    role: "combobox",
    "aria-label": label,
    "aria-haspopup": "listbox" as const,
    "aria-expanded": open,
    "aria-controls": open ? id : undefined,
    "aria-activedescendant":
      open && active >= 0 ? `${id}-${active}` : undefined,
    disabled,
    onKeyDown: keyboard,
  };
  const content = (option?: Option) => (
    <>
      {option?.color ? (
        <span
          className="category-color-dot"
          style={{ backgroundColor: option.color }}
        />
      ) : option?.add ? (
        <Plus size={16} />
      ) : null}
      <span className="app-select-name">{option?.label || current}</span>
      {option?.description && (
        <span className="app-select-count">{option.description}</span>
      )}
    </>
  );

  return (
    <div
      ref={root}
      className={`app-select${editable ? " app-select-editable" : ""}`}
      onBlur={(event) => {
        if (
          !root.current?.contains(event.relatedTarget) &&
          !menu.current?.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      {editable ? (
        <>
          <input
            {...semantics}
            ref={(element) => {
              trigger.current = element;
            }}
            className="app-select-trigger"
            value={current}
            maxLength={maxLength}
            pattern={pattern}
            required={required}
            aria-autocomplete="list"
            onClick={() => {
              setActive(selectedIndex);
              setOpen(true);
            }}
            onChange={(event) => {
              update(event.target.value);
              setActive(-1);
              setOpen(true);
            }}
          />
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="app-select-editable-chevron"
          />
        </>
      ) : (
        <button
          {...semantics}
          ref={(element) => {
            trigger.current = element;
          }}
          type="button"
          className="app-select-trigger"
          onClick={() => {
            setActive(Math.max(0, selectedIndex));
            setOpen(!open);
          }}
        >
          {content(selected)}
          <ChevronDown size={16} className="app-select-chevron" />
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            aria-label={`${label}选项`}
            className="app-select-menu"
            style={position}
            onClick={(event) => event.stopPropagation()}
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                id={`${id}-${index}`}
                type="button"
                role="option"
                aria-selected={index === selectedIndex}
                aria-disabled={option.disabled || undefined}
                disabled={option.disabled}
                tabIndex={-1}
                className={`app-select-option ${active === index ? "active" : ""} ${option.add ? "app-select-add" : ""}`}
                onPointerMove={() => {
                  if (!option.disabled) setActive(index);
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                {content(option)}
                <span className="app-select-check">
                  {index === selectedIndex && <Check size={16} />}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
