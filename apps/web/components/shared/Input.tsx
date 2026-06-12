import {
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  forwardRef,
} from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ type = "text", error, icon, className = "", ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordType = type === "password";
    const currentType = isPasswordType && showPassword ? "text" : type;

    return (
      <div className="w-full flex flex-col gap-1.5">
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-4 text-text-muted pointer-events-none select-none flex items-center justify-center">
              {icon}
            </div>
          )}
          
          <input
            type={currentType}
            ref={ref}
            className={`w-full rounded-2xl bg-input-bg border ${
              error ? "border-error-text" : "border-border-subtle"
            } py-3.5 ${
              icon ? "pl-12" : "pl-4"
            } ${
              isPasswordType ? "pr-12" : "pr-4"
            } text-sm text-white placeholder-text-muted transition duration-200 focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/50`}
            {...props}
          />

          {isPasswordType && (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-4 text-text-muted hover:text-white transition focus:outline-none"
            >
              {showPassword ? (
                <EyeOff className="h-4.5 w-4.5" />
              ) : (
                <Eye className="h-4.5 w-4.5" />
              )}
            </button>
          )}
        </div>
        {error && (
          <span className="text-xs text-error-text px-1 font-medium leading-none">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export type { InputProps };
