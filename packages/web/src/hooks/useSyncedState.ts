/**
 * Custom hook that syncs local state with a prop value
 * Useful for widgets that need to update when parent data refetches
 */
import { useState, useEffect } from 'react';

/**
 * Hook that creates a state synchronized with a prop value
 * The state will update whenever the prop changes
 *
 * @param initialValue - The prop value to sync with
 * @param defaultValue - Default value if initialValue is null/undefined
 * @returns [state, setState] tuple
 */
export function useSyncedState<T>(
  initialValue: T | null | undefined,
  defaultValue: T | null = null
): [T | null, React.Dispatch<React.SetStateAction<T | null>>] {
  const [state, setState] = useState<T | null>(initialValue ?? defaultValue);

  // Sync state with prop changes (when data refetches)
  useEffect(() => {
    setState(initialValue ?? defaultValue);
  }, [initialValue, defaultValue]);

  return [state, setState];
}
