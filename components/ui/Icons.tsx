import type { SVGProps } from "react";
import type { Category, Status } from "@/lib/media/types";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Svg({ size = 16, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export function CategoryIcon({ category, ...props }: IconProps & { category: Category }) {
  switch (category) {
    case "book":
      return (
        <Svg {...props}>
          <path d="M4 2.75h7.25a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H4a1.25 1.25 0 0 1-1.25-1.25v-8A1.25 1.25 0 0 1 4 2.75Z" />
          <path d="M5.5 2.75v10.5M7.75 5.75h2.5" />
        </Svg>
      );
    case "movie":
      return (
        <Svg {...props}>
          <rect x="2.25" y="3" width="11.5" height="10" rx="1.5" />
          <path d="M5.5 3v10M10.5 3v10M2.25 6.5h3.25M2.25 9.5h3.25M10.5 6.5h3.25M10.5 9.5h3.25" />
        </Svg>
      );
    case "series":
      return (
        <Svg {...props}>
          <rect x="2.25" y="5" width="11.5" height="8" rx="1.5" />
          <path d="m5.5 2.25 2.5 2.5 2.5-2.5" />
        </Svg>
      );
    case "anime":
      return (
        <Svg {...props}>
          <path d="M8 2c.55 3.3 2.7 5.45 6 6-3.3.55-5.45 2.7-6 6-.55-3.3-2.7-5.45-6-6 3.3-.55 5.45-2.7 6-6Z" />
        </Svg>
      );
  }
}

/** One glyph per status so state never depends on colour alone. */
export function StatusGlyph({ status, ...props }: IconProps & { status: Status }) {
  switch (status) {
    case "completed":
      return (
        <Svg {...props}>
          <circle cx="8" cy="8" r="6" />
          <path d="m5.5 8.25 1.75 1.75 3.25-3.75" />
        </Svg>
      );
    case "in-progress":
      return (
        <Svg {...props}>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor" />
        </Svg>
      );
    case "planned":
      return (
        <Svg {...props}>
          <circle cx="8" cy="8" r="6" strokeDasharray="2.2 2.4" />
        </Svg>
      );
    case "on-hold":
      return (
        <Svg {...props}>
          <circle cx="8" cy="8" r="6" />
          <path d="M6.25 5.75v4.5M9.75 5.75v4.5" />
        </Svg>
      );
    case "dropped":
      return (
        <Svg {...props}>
          <circle cx="8" cy="8" r="6" />
          <path d="m5.9 5.9 4.2 4.2M10.1 5.9l-4.2 4.2" />
        </Svg>
      );
  }
}
