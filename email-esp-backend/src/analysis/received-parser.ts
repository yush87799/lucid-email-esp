import { unfoldHeaders } from './header-utils';

export type Hop = {
  from: string;
  by: string;
  with?: string;
  id?: string;
  for?: string;
  ip?: string;
  timestamp?: Date;
  hopDurationMs?: number; // to next hop
};

export type ChainParseResult = {
  hops: Hop[];
  warnings?: string[];
};

export function parseReceivingChainWithWarnings(
  rawHeaders: string | Buffer,
): ChainParseResult {
  if (process.env.LOG_LEVEL === 'debug') {
    console.log(
      'parseReceivingChain input length:',
      rawHeaders.toString().length,
    );
    console.log(
      'parseReceivingChain input preview:',
      rawHeaders.toString().substring(0, 500),
    );
  }

  // Step 1: Unfold headers to handle line folding
  const unfolded = unfoldHeaders(rawHeaders);

  // Step 2: Split into header blocks and extract Received and X-Received headers
  const headerBlocks = unfolded.split(/\r?\n(?=[A-Za-z-]+:)/);
  const receivedHeaders: string[] = [];
  const xReceivedHeaders: string[] = [];

  for (const block of headerBlocks) {
    const lines = block.split(/\r?\n/);
    const firstLine = lines[0].trim();

    if (firstLine.toLowerCase().startsWith('received:')) {
      // Join all lines of this Received header and normalize whitespace
      const fullHeader = lines
        .join(' ')
        .replace(/^received:\s*/i, '')
        .trim();
      receivedHeaders.push(fullHeader);
    } else if (firstLine.toLowerCase().startsWith('x-received:')) {
      // Join all lines of this X-Received header and normalize whitespace
      const fullHeader = lines
        .join(' ')
        .replace(/^x-received:\s*/i, '')
        .trim();
      xReceivedHeaders.push(fullHeader);
    }
  }

  if (process.env.LOG_LEVEL === 'debug') {
    console.log('Found received headers:', receivedHeaders.length);
    console.log('Found x-received headers:', xReceivedHeaders.length);
  }

  const warnings: string[] = [];
  let headersToParse: string[] = [];

  // Use Received headers first, fallback to X-Received if none found
  if (receivedHeaders.length > 0) {
    headersToParse = receivedHeaders;
  } else if (xReceivedHeaders.length > 0) {
    headersToParse = xReceivedHeaders;
    warnings.push('Used X-Received headers (Gmail)');
  } else {
    warnings.push("No 'Received' or 'X-Received' headers found");
    return { hops: [], warnings };
  }

  // Step 3: Parse each header with improved regex
  const RX =
    /(?:^|\s)from\s+(?<from>.+?)\s+by\s+(?<by>.+?)(?:\s+with\s+(?<with>.+?))?(?:\s+id\s+(?<id>.+?))?(?:\s+for\s+(?<for>.+?))?\s*;\s*(?<date>.+)$/i;
  const RX_IP = /\[(?<ip>(?:\d{1,3}\.){3}\d{1,3}|[a-f0-9:]+)\]/i;

  const parsedChain = headersToParse
    .map((header) => {
      // Normalize to single line and collapse internal whitespace
      const cleanHeader = header.replace(/\s+/g, ' ').trim();

      const match = RX.exec(cleanHeader);
      if (!match || !match.groups) {
        // Skip headers that don't match our pattern
        return null;
      }

      const {
        from,
        by,
        with: withValue,
        id,
        for: forValue,
        date,
      } = match.groups;

      // Try to find IP in either from or by
      let ip: string | undefined;
      const fromIpMatch = RX_IP.exec(from);
      const byIpMatch = RX_IP.exec(by);
      if (fromIpMatch?.groups?.ip) {
        ip = fromIpMatch.groups.ip;
      } else if (byIpMatch?.groups?.ip) {
        ip = byIpMatch.groups.ip;
      }

      // Parse timestamp
      let timestamp: Date | undefined;
      try {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          timestamp = parsedDate;
        }
          } catch {
      // If date parsing fails, leave timestamp undefined
    }

      return {
        from: from.trim(),
        by: by.trim(),
        with: withValue?.trim(),
        id: id?.trim(),
        for: forValue?.trim(),
        ip,
        timestamp,
      };
    })
    .filter((hop) => hop !== null) as Hop[];

  // Step 4: Calculate hop durations and return oldest->newest
  // Received headers are typically newest first, so reverse to get oldest->newest
  const orderedChain = parsedChain.reverse();

  // Calculate hop durations between consecutive timestamps
  for (let i = 0; i < orderedChain.length - 1; i++) {
    const current = orderedChain[i];
    const next = orderedChain[i + 1];

    if (current.timestamp && next.timestamp) {
      current.hopDurationMs =
        next.timestamp.getTime() - current.timestamp.getTime();
    }
  }

  if (process.env.LOG_LEVEL === 'debug') {
    console.log('Parsed receiving chain:', orderedChain.length, 'hops');
  }

  return {
    hops: orderedChain,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function parseReceivingChain(rawHeaders: string | Buffer): Hop[] {
  // Backward compatibility - just return the hops from the enhanced parser
  const result = parseReceivingChainWithWarnings(rawHeaders);
  return result.hops;
}
