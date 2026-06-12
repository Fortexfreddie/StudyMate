import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  dot?: boolean;
  children?: ReactNode;
}

export function IconButton({ icon, dot, children, className = "", type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={`relative flex items-center justify-center h-10 w-10 rounded-full bg-card-bg border border-border-subtle hover:bg-white/5 hover:border-white/20 transition shrink-0 focus:outline-none ${className}`}
      {...props}
    >
      {icon}
      {dot && (
        <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-brand-primary" />
      )}
      {children}
    </button>
  );
}
