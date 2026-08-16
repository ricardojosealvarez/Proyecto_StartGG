interface SummaryCardProps {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'accent' | 'success';
}

const toneStyles: Record<NonNullable<SummaryCardProps['tone']>, string> = {
  neutral: 'ui-metric--neutral',
  accent: 'ui-metric--accent',
  success: 'ui-metric--success',
};

export function SummaryCard({ label, value, tone = 'neutral' }: SummaryCardProps) {
  return (
    <div className={`ui-metric ${toneStyles[tone]}`}>
      <div className="ui-metric__label">{label}</div>
      <div className="ui-metric__value">{value}</div>
    </div>
  );
}
