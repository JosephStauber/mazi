import Image from "next/image";
import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  ring?: boolean;
}

const sizeMap = {
  xs: { container: "h-7 w-7", text: "text-[11px]", px: 28 },
  sm: { container: "h-9 w-9", text: "text-sm", px: 36 },
  md: { container: "h-11 w-11", text: "text-base", px: 44 },
  lg: { container: "h-20 w-20", text: "text-2xl", px: 80 },
  xl: { container: "h-24 w-24", text: "text-3xl", px: 96 },
};

/** Deterministic neutral tint per username so fallbacks aren't all identical. */
function tint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h} 12% 46%)`;
}

export function Avatar({ src, alt, size = "md", className, ring }: AvatarProps) {
  const s = sizeMap[size];
  const ringClass = ring
    ? "ring-2 ring-background ring-offset-2 ring-offset-background"
    : "";

  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={s.px}
        height={s.px}
        className={cn(s.container, "shrink-0 rounded-full object-cover", ringClass, className)}
      />
    );
  }

  const initial = alt?.[0]?.toUpperCase() || "?";

  return (
    <div
      aria-label={alt}
      style={{ backgroundColor: tint(alt || "?") }}
      className={cn(
        s.container,
        s.text,
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        ringClass,
        className
      )}
    >
      {initial}
    </div>
  );
}
