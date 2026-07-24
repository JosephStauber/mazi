"use client";

import { TIME_SLIDER, reclaimedMinutes } from "@/lib/reserve/config";
import { useCountUp } from "@/lib/hooks/use-count-up";

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function AnimatedStat({
  value,
  unit,
  label,
  decimals = 0,
}: {
  value: number;
  unit: string;
  label: string;
  decimals?: number;
}) {
  const animated = useCountUp(value);
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface px-3 py-4 text-center">
      <div className="brand text-3xl leading-none text-accent sm:text-4xl">
        {animated.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
        <span className="ml-0.5 text-lg text-muted-foreground">{unit}</span>
      </div>
      <div className="mt-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/** Daily social-media time slider → animated "time you could reclaim". */
export function TimeSlider({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const reclaimed = reclaimedMinutes(minutes);
  const weekHours = reclaimed.week / 60;
  const monthHours = reclaimed.month / 60;
  const yearDays = reclaimed.year / (60 * 24);

  return (
    <div className="space-y-7">
      <div className="text-center">
        <div className="brand text-5xl text-foreground">{clock(minutes)}</div>
        <div className="mt-1 text-sm text-muted-foreground">a day on social media</div>
      </div>

      <input
        type="range"
        min={TIME_SLIDER.min}
        max={TIME_SLIDER.max}
        step={TIME_SLIDER.step}
        value={minutes}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Minutes per day on social media"
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--accent)]"
      />
      <div className="flex justify-between text-xs text-subtle">
        <span>{clock(TIME_SLIDER.min)}</span>
        <span>{clock(TIME_SLIDER.max)}+</span>
      </div>

      <div>
        <p className="mb-3 text-center text-sm text-muted-foreground">
          Time you could reclaim on Mazi
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          <AnimatedStat value={weekHours} unit="h" label="a week" decimals={1} />
          <AnimatedStat value={monthHours} unit="h" label="a month" />
          <AnimatedStat value={yearDays} unit="d" label="a year" decimals={1} />
        </div>
      </div>
    </div>
  );
}
