import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { DateTime } from "luxon";

type Props = {
  value: string;
  onChange: (date: string) => void;
  today: string;
  "aria-label": string;
  required?: boolean;
};
const parse = (value: string): DateTime => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? DateTime.fromISO(value)
    : DateTime.invalid("format");
  return date.isValid && date.year >= 1 ? date : DateTime.invalid("date");
};

export function DatePicker({
  value,
  onChange,
  today,
  "aria-label": label,
  required,
}: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"days" | "months" | "years">("days");
  const [cursor, setCursor] = useState<DateTime>(
    parse(value).isValid ? parse(value) : parse(today),
  );
  const [position, setPosition] = useState<React.CSSProperties>({});
  const month = cursor.startOf("month");
  const first = month.minus({ days: month.weekday - 1 });
  const yearStart = Math.floor(cursor.year / 12) * 12;
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const show = () => {
    setCursor(parse(value).isValid ? parse(value) : parse(today));
    setMode("days");
    setOpen(true);
  };
  const choose = (date: DateTime) => {
    if (!date.isValid || date.year < 1 || date.year > 9999) return;
    onChange(date.toISODate()!);
    close();
  };
  useEffect(() => {
    input.current?.setCustomValidity(
      value && !parse(value).isValid ? "请输入有效日期，格式为 YYYY-MM-DD" : "",
    );
  }, [value]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = root.current!.getBoundingClientRect();
      const width = Math.min(336, window.innerWidth - 24);
      const height = panel.current?.offsetHeight || 390;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const top =
        below >= height
          ? rect.bottom + 8
          : above >= height
            ? rect.top - height - 8
            : Math.max(12, (window.innerHeight - height) / 2);
      setPosition({
        position: "fixed",
        width,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top,
        maxHeight: window.innerHeight - 24,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, mode]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const focusOutside = (event: FocusEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focusOutside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", focusOutside);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (open && mode === "days")
      panel.current
        ?.querySelector<HTMLButtonElement>(
          `[data-date="${cursor.toISODate()}"]`,
        )
        ?.focus({ preventScroll: true });
  }, [open, cursor, mode]);
  const move = (direction: number) => {
    const next = cursor.plus(
      mode === "years"
        ? { years: 12 * direction }
        : mode === "months"
          ? { years: direction }
          : { months: direction },
    );
    if (next.year >= 1 && next.year <= 9999) setCursor(next);
  };
  const keyboard = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };
  return (
    <div ref={root} className="date-picker" onKeyDown={keyboard}>
      <input
        ref={input}
        aria-label={label}
        value={value}
        placeholder="YYYY-MM-DD"
        required={required}
        pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
        maxLength={10}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            show();
          }
        }}
      />
      <button
        ref={trigger}
        type="button"
        className="date-picker-trigger"
        aria-label={`选择${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : show())}
      >
        <CalendarDays size={18} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={`${label}日历`}
            className="date-picker-panel"
            style={position}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={keyboard}
          >
            <div className="date-picker-caption">
              <span>选择日期</span>
              <button type="button" aria-label="关闭日历" onClick={close}>
                <X size={16} />
              </button>
            </div>
            <div className="date-picker-heading">
              <button
                type="button"
                aria-label={
                  mode === "days"
                    ? "上个月"
                    : mode === "years"
                      ? "上一组年份"
                      : "上一年"
                }
                onClick={() => move(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <div aria-live="polite">
                {mode === "years" ? (
                  <span>
                    {yearStart} – {Math.min(9999, yearStart + 11)}
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label="选择年份"
                      onClick={() => setMode("years")}
                    >
                      {cursor.year}年
                    </button>
                    <button
                      type="button"
                      aria-label="选择月份"
                      onClick={() =>
                        setMode(mode === "months" ? "days" : "months")
                      }
                    >
                      {cursor.month}月
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                aria-label={
                  mode === "days"
                    ? "下个月"
                    : mode === "years"
                      ? "下一组年份"
                      : "下一年"
                }
                onClick={() => move(1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            {mode === "days" ? (
              <>
                <div className="date-picker-weekdays">
                  {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div
                  className="date-picker-days"
                  role="group"
                  aria-label="日期"
                >
                  {Array.from({ length: 42 }, (_, i) => {
                    const date = first.plus({ days: i }),
                      iso = date.toISODate()!;
                    return (
                      <button
                        key={iso}
                        data-date={iso}
                        type="button"
                        aria-label={iso}
                        aria-pressed={iso === value}
                        aria-current={iso === today ? "date" : undefined}
                        tabIndex={iso === cursor.toISODate() ? 0 : -1}
                        disabled={date.year < 1 || date.year > 9999}
                        className={`${date.month !== month.month ? "outside" : ""} ${iso === value ? "selected" : ""} ${iso === today ? "today" : ""}`}
                        onClick={() => choose(date)}
                        onKeyDown={(event) => {
                          let next: DateTime | undefined;
                          if (event.key === "ArrowLeft")
                            next = date.minus({ days: 1 });
                          if (event.key === "ArrowRight")
                            next = date.plus({ days: 1 });
                          if (event.key === "ArrowUp")
                            next = date.minus({ days: 7 });
                          if (event.key === "ArrowDown")
                            next = date.plus({ days: 7 });
                          if (event.key === "Home")
                            next = date.minus({ days: date.weekday - 1 });
                          if (event.key === "End")
                            next = date.plus({ days: 7 - date.weekday });
                          if (event.key === "PageUp")
                            next = date.minus(
                              event.shiftKey ? { years: 1 } : { months: 1 },
                            );
                          if (event.key === "PageDown")
                            next = date.plus(
                              event.shiftKey ? { years: 1 } : { months: 1 },
                            );
                          if (next) {
                            event.preventDefault();
                            if (next.year >= 1 && next.year <= 9999)
                              setCursor(next);
                          }
                        }}
                      >
                        {date.day}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="date-picker-options">
                {Array.from({ length: 12 }, (_, i) =>
                  mode === "months" ? i + 1 : yearStart + i,
                ).map((number) => (
                  <button
                    type="button"
                    key={number}
                    disabled={number < 1 || number > 9999}
                    className={
                      number ===
                      (mode === "months" ? cursor.month : cursor.year)
                        ? "selected"
                        : ""
                    }
                    onClick={() => {
                      setCursor(
                        cursor.set(
                          mode === "months"
                            ? { month: number }
                            : { year: number },
                        ),
                      );
                      setMode(mode === "years" ? "months" : "days");
                    }}
                  >
                    {number}
                    {mode === "months" ? "月" : "年"}
                  </button>
                ))}
              </div>
            )}
            <div className="date-picker-footer">
              <span>
                {value && parse(value).isValid
                  ? parse(value).toFormat("yyyy年M月d日")
                  : "YYYY-MM-DD"}
              </span>
              <button type="button" onClick={() => choose(parse(today))}>
                今天
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
