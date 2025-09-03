interface ESPBadgeProps {
  esp: string;
  confidence?: number;
  reasons?: string[];
  className?: string;
}

export function ESPBadge({ esp, confidence, reasons, className = '' }: ESPBadgeProps) {
  const isUnknown = esp === 'Unknown' || !esp;
  const confidencePercent = confidence ? Math.round(confidence * 100) : 0;
  
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
        isUnknown 
          ? 'bg-gray-100 text-gray-600 border border-gray-200' 
          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
      } ${className}`}
      title={reasons && reasons.length > 0 ? `Confidence: ${confidencePercent}%\nReasons: ${reasons.join(', ')}` : undefined}
    >
      {esp || 'Unknown'}
      {confidence !== undefined && confidence > 0 && (
        <span className="ml-1 text-xs opacity-75">
          ({confidencePercent}%)
        </span>
      )}
    </span>
  );
}
