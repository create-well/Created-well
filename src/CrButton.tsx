/**
 * @cr8w/design-system — Button component
 *
 * This is the STAGING SOURCE for the next kit publish.
 * Copy this file into the Figma Make kit authoring session
 * and replace the stub in the kit's src/index.ts.
 *
 * Token contract (from dist/index.css):
 *   --cw-brand-primary  #2f2a26   primary bg / text
 *   --cw-space-md       16px      horizontal padding
 *   --cw-corner-md      8px       border-radius
 *
 * Uses inline styles intentionally — this is a standalone package;
 * no Tailwind or build-time CSS is available to consumers.
 */

import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  borderRadius: "var(--cw-corner-md, 8px)",
  fontFamily: "inherit",
  fontSize: "0.875rem",
  fontWeight: 500,
  letterSpacing: "0.01em",
  lineHeight: 1,
  cursor: "pointer",
  transition: "opacity 0.2s ease",
  whiteSpace: "nowrap",
  textDecoration: "none",
  outline: "none",
};

const SIZES: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: "32px", padding: "0 12px", fontSize: "0.8125rem" },
  md: { height: "40px", padding: "0 var(--cw-space-md, 16px)" },
  lg: { height: "48px", padding: "0 24px", fontSize: "1rem" },
};

const VARIANTS: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: "var(--cw-brand-primary, #2f2a26)",
    color: "#fff",
    border: "none",
  },
  secondary: {
    backgroundColor: "transparent",
    color: "var(--cw-brand-primary, #2f2a26)",
    border: "1.5px solid var(--cw-brand-primary, #2f2a26)",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "var(--cw-brand-primary, #2f2a26)",
    border: "none",
  },
};

const HOVER_OPACITY: Record<ButtonVariant, string> = {
  primary: "0.88",
  secondary: "0.75",
  ghost: "0.65",
};

export function Button({
  variant = "primary",
  size = "md",
  style,
  onMouseEnter,
  onMouseLeave,
  disabled,
  ...props
}: ButtonProps) {
  const [hovered, setHovered] = React.useState(false);

  const computedStyle: React.CSSProperties = {
    ...BASE,
    ...SIZES[size],
    ...VARIANTS[variant],
    opacity: disabled ? 0.45 : hovered ? HOVER_OPACITY[variant] : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    pointerEvents: disabled ? "none" : undefined,
    ...style,
  };

  return (
    <button
      {...props}
      disabled={disabled}
      style={computedStyle}
      onMouseEnter={(e) => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); onMouseLeave?.(e); }}
    />
  );
}
