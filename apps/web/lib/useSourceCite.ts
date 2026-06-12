"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Shared scroll-to + transient-highlight behavior for clickable "Source #N"
 * citations. Pages register each source card's DOM node by index; calling
 * `cite(index)` scrolls that card into view and highlights it briefly.
 *
 * When multiple message groups each render their own source list, namespace the
 * registration key (e.g. `${msgId}:${index}`) and pass the same key to `cite`.
 */
export function useSourceCite<K extends string | number = number>() {
  const refs = useRef<Map<K, HTMLDivElement | null>>(new Map());
  const [active, setActive] = useState<K | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registerRef = useCallback((key: K, el: HTMLDivElement | null) => {
    if (el) refs.current.set(key, el);
    else refs.current.delete(key);
  }, []);

  const cite = useCallback((key: K) => {
    const el = refs.current.get(key);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setActive(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(null), 1800);
  }, []);

  return { registerRef, cite, active };
}
