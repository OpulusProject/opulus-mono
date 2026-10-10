import * as React from 'react';

/**
 * A ref for the trigger of a menu or popover that calls `onHidden` when the
 * trigger stops being displayed (e.g. a container query hides it as the window
 * narrows). Without it the open menu loses its anchor and jumps to the top-left
 * corner of the page.
 */
export function useCloseWhenHidden<T extends HTMLElement>(
  onHidden: () => void
) {
  const ref = React.useRef<T>(null);
  const latest = React.useRef(onHidden);
  latest.current = onHidden;

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (element.getClientRects().length === 0) latest.current();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return ref;
}
