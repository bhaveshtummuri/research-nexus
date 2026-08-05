import { useEffect, useState } from 'react';

/**
 * Delays propagating a rapidly changing value.
 *
 * Search inputs and filter fields feed straight into query keys, so debouncing
 * here is what stops every keystroke from issuing a graph traversal.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
