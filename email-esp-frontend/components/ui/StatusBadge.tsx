import type { TestStatus } from '../../types/email';

interface StatusBadgeProps {
  status: TestStatus;
  className?: string;
}

const statusConfig = {
  waiting: {
    label: 'Waiting',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  received: {
    label: 'Received',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  parsed: {
    label: 'Parsed',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  error: {
    label: 'Error',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
} as const;

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      role="status"
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}
