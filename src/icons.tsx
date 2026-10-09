/** Minimal inline SVG icons — paths from Lucide (ISC license, https://lucide.dev). */
import type { ReactNode } from "react";

interface IconProps {
  size?: number;
  [key: string]: unknown;
}

function base(size: number, props: IconProps, children: ReactNode) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlusIcon = (props: IconProps = {}) =>
  base(props.size ?? 14, props, <>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </>);

export const TrashIcon = (props: IconProps = {}) =>
  base(props.size ?? 14, props, <>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </>);

export const CloseIcon = (props: IconProps = {}) =>
  base(props.size ?? 14, props, <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>);
