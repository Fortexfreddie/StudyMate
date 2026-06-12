interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer outline-none focus:outline-none disabled:opacity-50 ${
        checked ? "bg-accent-gold" : "bg-surface-raised border border-white/10"
      }`}
    >
      <span
        className={`block h-4.5 w-4.5 rounded-full shadow transition-transform ${
          checked ? "translate-x-5 bg-accent-gold-fg" : "translate-x-0 bg-text-muted"
        }`}
      />
    </button>
  );
}
