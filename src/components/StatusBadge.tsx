interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusStyles: Record<string, string> = {
  draft: 'bg-zinc-500/20 text-zinc-400 border-zinc-600',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-600',
  published: 'bg-green-500/20 text-green-400 border-green-600',
  rejected: 'bg-red-500/20 text-red-400 border-red-600',
  running: 'bg-blue-500/20 text-blue-400 border-blue-600',
  completed: 'bg-green-500/20 text-green-400 border-green-600',
  failed: 'bg-red-500/20 text-red-400 border-red-600',
  sent: 'bg-green-500/20 text-green-400 border-green-600',
};

const statusLabels: Record<string, string> = {
  draft: 'Bản nháp',
  pending: 'Chờ duyệt',
  published: 'Đã đăng',
  rejected: 'Từ chối',
  running: 'Đang chạy',
  completed: 'Hoàn tất',
  failed: 'Thất bại',
  sent: 'Đã gửi',
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-zinc-500/20 text-zinc-400 border-zinc-600';
  const label = statusLabels[status] || status;
  const px = size === 'sm' ? 'px-2' : 'px-3';
  const py = size === 'sm' ? 'py-0.5' : 'py-1';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full border ${px} ${py} ${textSize} font-medium ${style}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full bg-current`} />
      {label}
    </span>
  );
}
