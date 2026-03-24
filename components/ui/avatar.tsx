import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { container: "h-8 w-8", text: "text-xs", px: 32 },
  md: { container: "h-10 w-10", text: "text-sm", px: 40 },
  lg: { container: "h-16 w-16", text: "text-lg", px: 64 },
};

export function Avatar({ src, alt, size = "md", className = "" }: AvatarProps) {
  const s = sizeMap[size];

  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={s.px}
        height={s.px}
        className={`${s.container} rounded-full object-cover ${className}`}
      />
    );
  }

  const initial = alt?.[0]?.toUpperCase() || "?";

  return (
    <div
      className={`${s.container} rounded-full bg-foreground/10 flex items-center justify-center ${s.text} font-medium text-foreground ${className}`}
      aria-label={alt}
    >
      {initial}
    </div>
  );
}
