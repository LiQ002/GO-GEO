import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "alert"
  | "arrow-left"
  | "arrow-right"
  | "article"
  | "bell"
  | "board"
  | "book"
  | "building"
  | "brand"
  | "calendar"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "clock"
  | "database"
  | "download"
  | "edit"
  | "eye"
  | "geo"
  | "grid"
  | "image"
  | "key"
  | "layers"
  | "menu"
  | "mobile"
  | "monitor"
  | "more"
  | "plus"
  | "receipt"
  | "rocket"
  | "search"
  | "send"
  | "settings"
  | "shield"
  | "sparkles"
  | "target"
  | "trash"
  | "trend"
  | "user"
  | "wallet"
  | "x";

const paths: Record<IconName, ReactNode> = {
  alert: <path d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />,
  "arrow-left": <path d="M19 12H5m5-5-5 5 5 5" />,
  "arrow-right": <path d="M5 12h14m-5-5 5 5-5 5" />,
  article: <path d="M6 3h9l3 3v15H6V3Zm8 0v4h4M9 12h6M9 16h6M9 8h2" />,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />,
  board: (
    <path d="M3 4h18v14H3V4Zm0 14h18M9 21h6M7 8h6M7 12h10M7 16h4" />
  ),
  book: (
    <path d="M4 5a3 3 0 0 1 3-3h5v18H7a3 3 0 0 0-3 2V5Zm16 0a3 3 0 0 0-3-3h-5v18h5a3 3 0 0 1 3 2V5Z" />
  ),
  building: <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 12h.01M9 15h.01M9 18h.01M15 9h.01M15 12h.01M15 15h.01M15 18h.01" />,
  brand: <path d="M12 3 3 8v8l9 5 9-5V8l-9-5Zm0 0v18M3 8l9 5 9-5" />,
  calendar: (
    <path d="M3 5h18v4H3V5Zm0 6h18v10H3V11Zm5-8v4m8-4v4M3 5v16h18V5" />
  ),
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-down": <path d="m7 9 5 5 5-5" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  clock: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />,
  database: (
    <path d="M20 6c0 2.2-3.6 4-8 4S4 8.2 4 6s3.6-4 8-4 8 1.8 8 4Zm0 0v6c0 2.2-3.6 4-8 4s-8-1.8-8-4V6m16 6v6c0 2.2-3.6 4-8 4s-8-1.8-8-4v-6" />
  ),
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 21h16" />,
  edit: (
    <path d="M13.5 6.5 17.5 10.5M4 20l4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10L4 20Zm9-13 4 4" />
  ),
  eye: (
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  ),
  geo: (
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-8 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  ),
  grid: (
    <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
  ),
  image: (
    <path d="M4 4h16v16H4V4Zm0 12 4.5-4.5 3 3 2-2 6.5 6.5M15.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
  ),
  key: (
    <path d="M15 7a5 5 0 1 1-4.5 7.2L3 21v-4l2-2h3l2.3-2.3A5 5 0 0 1 15 7Zm2 4h.01" />
  ),
  layers: <path d="m12 2 9 5-9 5-9-5 9-5Zm9 10-9 5-9-5m18 5-9 5-9-5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  mobile: <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm5 17h.01" />,
  monitor: <path d="M4 4h16v12H4V4Zm4 20h8M8 16v4M16 16v4" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  plus: <path d="M12 5v14M5 12h14" />,
  receipt: (
    <path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1ZM8 8h8M8 12h8M8 16h5" />
  ),
  rocket: (
    <path d="M14 5c4-4 7-3 7-3s1 3-3 7l-5 5-4-4 5-5Zm-7 7-3 1-2 4 5-1m5 1-1 5 4-2 1-3M6 18l-2 2" />
  ),
  search: <path d="m21 21-4.4-4.4M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />,
  send: <path d="m22 2-7 20-4-9-9-4 20-7ZM11 13l5-5" />,
  settings: (
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5c0-.5-.1-1-.2-1.4l2-1.6-2-3.4-2.5 1a9 9 0 0 0-2.4-1.4L14 2h-4l-.4 3.2c-.9.3-1.7.8-2.4 1.4l-2.5-1-2 3.4 2 1.6a7 7 0 0 0 0 2.8l-2 1.6 2 3.4 2.5-1c.7.6 1.5 1.1 2.4 1.4L10 22h4l.4-3.2c.9-.3 1.7-.8 2.4-1.4l2.5 1 2-3.4-2-1.6c.1-.4.2-.9.2-1.4Z" />
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  sparkles: (
    <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Zm6 10 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13ZM5 13l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
  ),
  target: (
    <path d="M21 12a9 9 0 1 1-3.2-6.9M21 3l-9 9m4-9h5v5M15 12a3 3 0 1 1-3-3" />
  ),
  trash: <path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" />,
  trend: <path d="m3 17 6-6 4 4 8-9m-5 0h5v5" />,
  user: <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />,
  wallet: (
    <path d="M4 5h14a2 2 0 0 1 2 2v13H4a2 2 0 0 1-2-2V5Zm0 0V3h13v4m0 5h4v5h-4a2.5 2.5 0 0 1 0-5Z" />
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
};

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
