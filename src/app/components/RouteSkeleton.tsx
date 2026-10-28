import React from 'react';
import { ViewShell } from './ViewShell';

/**
 * Route-chunk loading fallback (Track FE, FE-4). Renders the ViewShell
 * loading state — the same skeleton frame every page shows while its
 * data loads — so a lazy route chunk arriving never shifts the layout:
 * fixed panel order and the skeleton behavior are preserved exactly.
 */
export function RouteSkeleton() {
  return <ViewShell state="loading" />;
}
