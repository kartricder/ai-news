
interface ScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function getScoreConfig(score: number) {
  if (score >= 85) {
    return {
      label: 'Rất quan trọng',
      shortLabel: 'Hot',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
    };
  }
  if (score >= 75) {
    return {
      label: 'Quan trọng',
      shortLabel: 'Nổi bật',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
    };
  }
  if (score >= 60) {
    return {
      label: 'Theo dõi',
      shortLabel: 'Đáng đọc',
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      border: 'border-sky-200',
      dot: 'bg-sky-400',
    };
  }
  return {
    label: 'Thường',
    shortLabel: '',
    bg: 'bg-slate-50',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  };
}

export default function ScoreBadge({ score, showLabel = false, size = 'sm' }: ScoreBadgeProps) {
  const cfg = getScoreConfig(score);
  const sizeClass = size === 'lg' ? 'px-3 py-1.5 text-sm' : size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClass}`}
      title={`Điểm quan trọng: ${score}/100 — ${cfg.label}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {score}
      {showLabel && <span className="opacity-75">· {cfg.label}</span>}
    </span>
  );
}
