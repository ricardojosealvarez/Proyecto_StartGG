interface SummaryCardProps {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'accent' | 'success';
}

const toneStyles: Record<NonNullable<SummaryCardProps['tone']>, string> = {
  neutral: 'border-slate-200 bg-white text-slate-900',
  accent: 'border-cyan-200 bg-cyan-50 text-cyan-950',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
};

export function SummaryCard({
  label,
  value,
  tone = 'neutral',
}: SummaryCardProps) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneStyles[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
