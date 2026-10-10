import * as React from 'react';

/**
 * The content width of the nearest ancestor matching `selector`, and a ref for
 * an element inside it (any element that is always rendered). `undefined` until
 * measured, which is before the first paint.
 *
 * For choosing what to render by the width of a container. A CSS container
 * query would only hide the other version, and a menu left open in a version
 * that gets hidden loses its anchor and jumps to the corner of the page.
 */
export function useContainerWidth<T extends HTMLElement>(selector: string) {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState<number>();

  React.useLayoutEffect(() => {
    const container = ref.current?.closest(selector);
    if (!container) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry?.contentRect.width)
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [selector]);

  return [ref, width] as const;
}
