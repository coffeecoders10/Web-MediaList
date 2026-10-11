"use client";

import { useState, type CSSProperties } from "react";
import { coverArt } from "@/lib/media/art";
import type { ArtPattern, MediaItem } from "@/lib/media/types";
import styles from "./Cover.module.css";

function Pattern({ pattern }: { pattern: ArtPattern }) {
  switch (pattern) {
    case "sun":
      return (
        <>
          <circle cx="100" cy="126" r="66" fill="var(--c3)" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="0" y={146 + i * 16} width="200" height={3 + i * 2} fill="var(--c1)" />
          ))}
          <rect x="0" y="232" width="200" height="68" fill="var(--c2)" />
        </>
      );
    case "arches":
      return (
        <>
          {[
            [80, "var(--c2)"],
            [62, "var(--c3)"],
            [44, "var(--c4)"],
            [26, "var(--c1)"],
          ].map(([r, fill]) => (
            <path key={String(r)} d={`M${100 - +r} 300V${170 - +r * 0.2}a${r} ${r} 0 0 1 ${+r * 2} 0V300Z`} fill={String(fill)} />
          ))}
        </>
      );
    case "rays":
      return (
        <>
          {Array.from({ length: 14 }, (_, i) => {
            const a0 = Math.PI * (1 + i / 14);
            const a1 = Math.PI * (1 + (i + 0.5) / 14);
            const p = (a: number) => `${(100 + Math.cos(a) * 260).toFixed(1)} ${(190 + Math.sin(a) * 260).toFixed(1)}`;
            return <path key={i} d={`M100 190L${p(a0)}L${p(a1)}Z`} fill={i % 2 ? "var(--c2)" : "var(--c3)"} />;
          })}
          <rect x="0" y="190" width="200" height="110" fill="var(--c1)" />
          <path d="M66 190a34 34 0 0 1 68 0Z" fill="var(--c4)" />
        </>
      );
    case "bands":
      return (
        <g transform="rotate(-24 100 150)">
          {[
            [-60, 46, "var(--c2)"],
            [-8, 30, "var(--c3)"],
            [34, 62, "var(--c4)"],
            [102, 24, "var(--c2)"],
            [136, 54, "var(--c3)"],
            [196, 38, "var(--c2)"],
          ].map(([y, h, fill]) => (
            <rect key={String(y)} x="-80" y={y} width="360" height={h} fill={String(fill)} />
          ))}
        </g>
      );
    case "orbit":
      return (
        <>
          {[
            [96, "var(--c2)"],
            [74, "var(--c1)"],
            [52, "var(--c3)"],
            [30, "var(--c1)"],
            [12, "var(--c4)"],
          ].map(([r, fill]) => (
            <circle key={String(r)} cx="100" cy="132" r={+r} fill={String(fill)} />
          ))}
          <circle cx="168" cy="52" r="10" fill="var(--c4)" />
        </>
      );
    case "blocks":
      return (
        <>
          <rect x="0" y="0" width="200" height="170" fill="var(--c2)" />
          <circle cx="72" cy="112" r="50" fill="var(--c3)" />
          <rect x="104" y="84" width="96" height="116" fill="var(--c4)" />
          <path d="M0 200 70 130 140 200Z" fill="var(--c1)" />
        </>
      );
  }
}

interface CoverProps {
  item: Pick<MediaItem, "title" | "art" | "posterUrl" | "year">;
  /** Hides the title overlay on generated covers; used for tiny thumbnails. */
  compact?: boolean;
  className?: string;
}

export function Cover({ item, compact = false, className }: CoverProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const { hue, pattern } = coverArt(item);
  const showImage = item.posterUrl && failedUrl !== item.posterUrl;

  const palette = {
    "--c1": `oklch(0.26 0.06 ${hue})`,
    "--c2": `oklch(0.46 0.13 ${hue})`,
    "--c3": `oklch(0.7 0.14 ${(hue + 18) % 360})`,
    "--c4": `oklch(0.9 0.07 ${(hue + 40) % 360})`,
  } as CSSProperties;

  return (
    <div className={[styles.cover, className].filter(Boolean).join(" ")} style={palette}>
      {showImage ? (
        // Poster URLs can point anywhere, so the Next image optimiser (which needs an allow-list) is not used.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.posterUrl} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(item.posterUrl)} />
      ) : (
        <>
          <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
            <rect width="200" height="300" fill="var(--c1)" />
            <Pattern pattern={pattern} />
          </svg>
          {!compact && (
            <span className={styles.title} aria-hidden="true">
              {item.title}
            </span>
          )}
        </>
      )}
    </div>
  );
}
