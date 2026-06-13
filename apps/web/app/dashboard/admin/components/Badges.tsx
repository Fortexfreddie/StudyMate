import { ROLE_LABEL } from "./adminHelpers";

export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    super_admin: "bg-accent-gold/10 text-accent-gold border-accent-gold/20",
    admin: "bg-brand-primary/10 text-brand-primary border-brand-primary/20",
    user: "bg-white/5 text-text-muted border-border-subtle",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider ${
        styles[role] ?? styles.user
      }`}
    >
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

// Tier pill — Pro filled, Free outlined.
export function TierBadge({ isPro }: { isPro: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider ${
        isPro
          ? "bg-accent-gold/10 text-accent-gold border-accent-gold/20"
          : "bg-transparent text-text-muted border-border-subtle"
      }`}
    >
      {isPro ? "Pro" : "Free"}
    </span>
  );
}
