import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline";
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  children,
  variant = "primary",
  loading = false,
  icon,
  className = "",
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const baseStyles = "flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 px-4 font-semibold text-sm transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-brand-primary text-black hover:bg-brand-primary-hover focus:ring-brand-primary",
    outline: "bg-transparent border border-border-subtle text-white hover:bg-white/5 focus:ring-border-subtle",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
export type { ButtonProps };
