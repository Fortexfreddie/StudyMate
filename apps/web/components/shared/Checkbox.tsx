import { type InputHTMLAttributes, type ReactNode, useId } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  error?: boolean;
}

export function Checkbox({ label, error, className = "", ...props }: CheckboxProps) {
  const id = useId();

  return (
    <div className={`flex items-start gap-3 w-full select-none ${className}`}>
      <div className="relative flex items-center h-5">
        <input
          id={id}
          type="checkbox"
          className={`h-4.5 w-4.5 rounded border ${
            error ? "border-error-text" : "border-border-subtle"
          } bg-input-bg text-brand-primary cursor-pointer accent-brand-primary focus:ring-1 focus:ring-brand-primary/50 focus:ring-offset-0 focus:outline-none`}
          {...props}
        />
      </div>
      <label
        htmlFor={id}
        className="text-xs text-text-muted font-normal cursor-pointer leading-tight flex-1"
      >
        {label}
      </label>
    </div>
  );
}
export type { CheckboxProps };
