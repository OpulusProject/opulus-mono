import * as React from 'react';

interface UseOnVisibleOptions {
  /** Observe only while true; turning it back on checks the element again. */
  enabled?: boolean;
  /** How far outside the viewport counts as visible, e.g. "200px". */
  rootMargin?: string;
}

/**
 * Calls `onVisible` when the element this returns a ref for scrolls into view,
 * and again each time `enabled` turns back on while it still is, so a list can
 * keep loading until its end button is out of sight.
 */
export function useOnVisible<T extends Element>(
  onVisible: () => void,
  { enabled = true, rootMargin = '0px' }: UseOnVisibleOptions = {}
) {
  const [element, setElement] = React.useState<T | null>(null);
  const latest = React.useRef(onVisible);
  latest.current = onVisible;

  React.useEffect(() => {
    if (!enabled || !element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) latest.current();
      },
      { rootMargin }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, enabled, rootMargin]);

  return setElement;
}
