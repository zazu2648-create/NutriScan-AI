import React from 'react';

interface CircularProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  unit: string;
  sublabel?: string;
  accentColor?: string;
}

export const CircularProgressRing: React.FC<CircularProgressRingProps> = ({
  value,
  max,
  size = 132,
  strokeWidth = 10,
  label,
  unit,
  sublabel,
  accentColor = '#15803D',
}) => {
  const safeMax = Math.max(1, max);
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);
  const isOver = value > max;

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          role="img"
          aria-label={`${label}: ${Math.round(value)} of ${Math.round(max)} ${unit}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-emerald-950/10 dark:text-emerald-100/10"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isOver ? '#B45309' : accentColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
          <span className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-[#111C16] dark:text-[#EDF4EF]">
            {Math.round(value).toLocaleString()}
          </span>
          <span className="text-xs text-[#4C6154] dark:text-[#9BB5A4] tabular-nums">
            / {Math.round(max).toLocaleString()} {unit}
          </span>
        </div>
      </div>
      <div className="mt-2.5 text-sm font-semibold text-[#111C16] dark:text-[#EDF4EF]">
        {label}
      </div>
      {sublabel && (
        <div className="text-xs text-[#4C6154] dark:text-[#9BB5A4] tabular-nums">
          {sublabel}
        </div>
      )}
    </div>
  );
};

interface MacroBarProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
  barClass?: string;
}

export const MacroProgressBar: React.FC<MacroBarProps> = ({
  label,
  value,
  max,
  unit = 'g',
  barClass = 'bg-[#15803D] dark:bg-[#22C55E]',
}) => {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-[#111C16] dark:text-[#EDF4EF]">{label}</span>
        <span className="text-xs font-mono tabular-nums text-[#4C6154] dark:text-[#9BB5A4]">
          {value} / {max} {unit}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-emerald-950/10 dark:bg-emerald-100/10">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
