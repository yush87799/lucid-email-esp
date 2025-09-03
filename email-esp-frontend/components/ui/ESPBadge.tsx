interface ESPBadgeProps {
  esp: string;
  className?: string;
}

export function ESPBadge({ esp, className = '' }: ESPBadgeProps) {
  const isUnknown = esp === 'Unknown' || !esp;
  
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
        isUnknown 
          ? 'bg-gray-100 text-gray-600 border border-gray-200' 
          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
      } ${className}`}
    >
      {esp || 'Unknown'}
    </span>
  );
}
