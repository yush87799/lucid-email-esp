/**
 * Header normalization utilities for email processing
 * Pure functions with no external dependencies
 */

/**
 * Remove RFC 5322 line folding from headers
 * Replaces CRLF followed by WSP with single space
 */
export function unfoldHeaders(raw: string | Buffer): string {
  const text = Buffer.isBuffer(raw) ? raw.toString() : raw;
  return text.replace(/\r\n[ \t]+/g, ' ');
}

/**
 * Split unfolded headers into name-value pairs
 * Splits at start of each header name, lowercases name, keeps raw value
 */
export function splitHeaderBlocks(unfolded: string): Array<{ name: string; value: string }> {
  const headers: Array<{ name: string; value: string }> = [];
  const lines = unfolded.split(/\r?\n/);
  
  let currentHeader: { name: string; value: string } | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check if this line starts a new header (matches /^\S[^:]*:/m)
    const headerMatch = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (headerMatch) {
      // Save previous header if exists
      if (currentHeader) {
        headers.push(currentHeader);
      }
      
      // Start new header
      currentHeader = {
        name: headerMatch[1].toLowerCase().trim(),
        value: headerMatch[2].trim()
      };
    } else if (currentHeader) {
      // Continuation line - append to current header value
      currentHeader.value += ' ' + trimmed;
    }
  }
  
  // Don't forget the last header
  if (currentHeader) {
    headers.push(currentHeader);
  }
  
  return headers;
}

/**
 * Get all values for a header name (case-insensitive)
 */
export function getAll(headers: Array<{ name: string; value: string }>, name: string): string[] {
  const lowerName = name.toLowerCase();
  return headers
    .filter(h => h.name === lowerName)
    .map(h => h.value);
}

/**
 * Get first value for a header name (case-insensitive)
 */
export function getOne(headers: Array<{ name: string; value: string }>, name: string): string | undefined {
  const lowerName = name.toLowerCase();
  const header = headers.find(h => h.name === lowerName);
  return header?.value;
}

/**
 * Convert headers array to map for easier lookup
 */
export function headersToMap(headers: Array<{ name: string; value: string }>): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  
  for (const header of headers) {
    if (!map[header.name]) {
      map[header.name] = [];
    }
    map[header.name].push(header.value);
  }
  
  return map;
}
