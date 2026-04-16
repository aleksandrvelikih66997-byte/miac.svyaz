'use client';

import { useMemo, DependencyList } from 'react';

/**
 * A utility hook to stabilize Firestore references and queries.
 */
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  return useMemo(factory, deps);
}
