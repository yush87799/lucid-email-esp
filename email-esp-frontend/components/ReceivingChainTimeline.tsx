import type { ChainHop } from '../types/email';

interface ReceivingChainTimelineProps {
  chain: ChainHop[];
}

export function ReceivingChainTimeline({ chain }: ReceivingChainTimelineProps) {
  if (chain.length === 0) {
    return null;
  }

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return null;
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <ol className="relative border-l border-gray-200 ml-4">
      {chain.map((hop, index) => (
        <li
          key={index}
          className="relative mb-6 last:mb-0"
          aria-label={`hop ${index + 1}`}
        >
          {/* Timeline dot */}
          <div className="absolute -left-3 top-2 h-2 w-2 bg-blue-600 rounded-full border-2 border-white shadow-sm" />
          
          {/* Content */}
          <div className="ml-4">
            {/* Line 1: by → from (with IP if present) */}
            <div className="text-sm font-medium text-gray-900">
              {hop.by} → {hop.from}
              {hop.ip && (
                <span className="text-gray-500 ml-1">({hop.ip})</span>
              )}
            </div>
            
            {/* Line 2: with / id / for (only if defined) */}
            {(hop.with || hop.id || hop.for) && (
              <div className="text-xs text-gray-500 mt-1">
                {[
                  hop.with && `with: ${hop.with}`,
                  hop.id && `id: ${hop.id}`,
                  hop.for && `for: ${hop.for}`
                ].filter(Boolean).join(' / ')}
              </div>
            )}
            
            {/* Line 3: formatted timestamp */}
            {hop.timestamp && (
              <div className="text-xs text-gray-400 mt-1">
                {formatTimestamp(hop.timestamp)}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}