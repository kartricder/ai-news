interface TagPillProps {
  label: string;
  variant?: 'default' | 'category' | 'source' | 'active';
  size?: 'xs' | 'sm';
}

export default function TagPill({ label, variant = 'default', size = 'xs' }: TagPillProps) {
  const sizeClass = size === 'sm' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  const variantClass = {
    default: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
    category: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
    source: 'bg-sky-50 text-sky-700 border border-sky-100',
    active: 'bg-indigo-600 text-white',
  }[variant];

  return (
    <span className={`inline-flex items-center rounded-full font-medium transition-colors ${sizeClass} ${variantClass}`}>
      {label}
    </span>
  );
}
