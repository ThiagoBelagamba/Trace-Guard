import clsx from "clsx";
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import type { Tone } from "../../lib/view";
import { Icon, type IconName } from "./Icon";

export function Chip({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[7px] border border-tg-border-strong px-[9px] py-1 text-xs text-tg-text-2">
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

interface PillProps {
  tone: Tone;
  mono?: boolean;
  icon?: IconName;
  children: ReactNode;
}

export function Pill({ tone, mono = false, icon, children }: PillProps) {
  return (
    <span className={clsx("tg-pill", `tg-pill--${tone}`, mono && "tg-pill--level")}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive";
  size?: "md" | "sm";
  icon?: IconName;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-2 border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "h-10 rounded-[9px] px-4 text-[13px]" : "h-8 rounded-[7px] px-3 text-xs",
        variant === "primary" && "border-tg-text bg-tg-text text-[#111113] hover:bg-white",
        variant === "secondary" &&
          "border-tg-border-strong bg-[#1A1A1E] text-[#D4D4D8] hover:border-[#3A3A41] hover:text-tg-text",
        variant === "destructive" &&
          "border-[rgb(217_119_111/.28)] bg-transparent text-tg-error-text hover:bg-[rgb(217_119_111/.08)]",
        className
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "md" ? 16 : 14} />}
      {children}
    </button>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

export function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-tg-md border border-[#26262A] bg-tg-surface pl-3 pr-9 text-[13px] text-tg-text hover:border-tg-border-strong"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevron-down"
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tg-text-3"
      />
    </div>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Field({ label, className, ...rest }: FieldProps) {
  const id = useId();
  return (
    <div className={clsx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] text-tg-text-2">
        {label}
      </label>
      <input
        id={id}
        className="h-10 w-full rounded-tg-md border border-tg-border-strong bg-tg-sidebar px-3 text-[13px] text-tg-text placeholder:text-tg-text-3"
        {...rest}
      />
    </div>
  );
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string; count?: number }>;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  items,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-0.5 rounded-[9px] border border-tg-border bg-tg-sidebar p-[3px]"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={clsx(
              "inline-flex h-[34px] items-center gap-2 rounded-[7px] border px-3 text-[13px]",
              active
                ? "border-tg-border-strong bg-[#202024] text-tg-text"
                : "border-transparent bg-transparent text-tg-text-2 hover:text-tg-text"
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={clsx("font-mono text-[11px]", active ? "text-[#D4D4D8]" : "text-tg-text-3")}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
