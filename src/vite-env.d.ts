/// <reference types="vite/client" />

/* Figma Make asset scheme: PNGs imported as figma:asset/<hash>.png are
   resolved by the build toolchain; for the type checker they are plain
   string URLs, like every other image import. */
declare module "figma:asset/*.png" {
  const src: string;
  export default src;
}

/* @types/react-dom is not installed in this project; main.tsx uses only
   createRoot. This declaration mirrors the real react-dom/client surface
   the app consumes, nothing more. */
declare module "react-dom/client" {
  import type { ReactNode } from "react";
  export interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }
  export function createRoot(
    container: Element | DocumentFragment,
    options?: { identifierPrefix?: string },
  ): Root;
}

/* Same situation for the bare react-dom module: AddTaskModal (Phase B)
   consumes only createPortal, so the declaration mirrors exactly that
   surface, nothing more. */
declare module "react-dom" {
  import type { ReactNode } from "react";
  export function createPortal(
    children: ReactNode,
    container: Element | DocumentFragment,
    key?: string | null,
  ): ReactNode;
}
