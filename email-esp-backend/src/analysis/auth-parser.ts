/**
 * Authentication results and identity signal parsing
 * Extracts ESP signals from various email headers
 */

export interface AuthResults {
  spf?: { result: string; domain?: string };
  dkim?: { result: string; d?: string };
  dmarc?: { result: string; policy?: string };
}

/**
 * Parse Authentication-Results header values
 * Supports multiple entries, prefers most recent (first header)
 */
export function parseAuthenticationResults(values: string[]): AuthResults {
  if (!values || values.length === 0) return {};

  // Use first (most recent) authentication results
  const authResult = values[0];
  const result: AuthResults = {};

  // Parse SPF
  const spfMatch = authResult.match(/spf=(\w+)(?:\s+\(([^)]+)\))?/i);
  if (spfMatch) {
    result.spf = {
      result: spfMatch[1],
      domain: spfMatch[2],
    };
  }

  // Parse DKIM
  const dkimMatch = authResult.match(/dkim=(\w+)(?:\s+\(([^)]+)\))?/i);
  if (dkimMatch) {
    result.dkim = {
      result: dkimMatch[1],
      d: dkimMatch[2],
    };
  }

  // Parse DMARC
  const dmarcMatch = authResult.match(/dmarc=(\w+)(?:\s+\(([^)]+)\))?/i);
  if (dmarcMatch) {
    result.dmarc = {
      result: dmarcMatch[1],
      policy: dmarcMatch[2],
    };
  }

  return result;
}

/**
 * Extract domain from Message-ID header
 * Returns domain from <...@domain> format
 */
export function extractMessageIdDomain(messageId?: string): string | undefined {
  if (!messageId) return undefined;

  const match = messageId.match(/<.*?@([^>]+)>/);
  return match ? match[1].toLowerCase() : undefined;
}

/**
 * Extract domain from Return-Path header
 * Returns domain from <bounce@domain> or plain domain format
 */
export function extractReturnPathDomain(
  returnPath?: string,
): string | undefined {
  if (!returnPath) return undefined;

  // Handle <bounce@domain> format
  const bracketMatch = returnPath.match(/<([^>]+)>/);
  if (bracketMatch) {
    const email = bracketMatch[1];
    const domainMatch = email.match(/@([^@]+)$/);
    return domainMatch ? domainMatch[1].toLowerCase() : undefined;
  }

  // Handle plain domain format
  const domainMatch = returnPath.match(/@([^@\s]+)/);
  return domainMatch ? domainMatch[1].toLowerCase() : undefined;
}

/**
 * Extract DKIM d= parameter from DKIM-Signature headers
 */
export function extractDkimD(dkimSignatures: string[]): string | undefined {
  if (!dkimSignatures || dkimSignatures.length === 0) return undefined;

  for (const signature of dkimSignatures) {
    const dMatch = signature.match(/d=([^;\s]+)/i);
    if (dMatch) {
      return dMatch[1].toLowerCase();
    }
  }

  return undefined;
}

/**
 * Extract provider signals from X-* headers
 * Collects hints from various ESP-specific headers
 */
export function extractXProviderSignals(
  headers: Record<string, string[]>,
): string[] {
  const signals: string[] = [];

  for (const [name, values] of Object.entries(headers)) {
    const lowerName = name.toLowerCase();

    // SendGrid signals
    if (lowerName.startsWith('x-sg-') || lowerName === 'x-sg-eid') {
      signals.push(`X-SG-${lowerName.substring(5).toUpperCase()}`);
    }

    // Mailgun signals
    if (lowerName.startsWith('x-mailgun-')) {
      signals.push(`X-Mailgun-${lowerName.substring(10).toUpperCase()}`);
    }

    // Mailjet signals
    if (lowerName.startsWith('x-mj-')) {
      signals.push(`X-MJ-${lowerName.substring(4).toUpperCase()}`);
    }

    // Amazon SES signals
    if (lowerName === 'x-ses-outgoing' || lowerName.startsWith('x-ses-')) {
      signals.push(`X-SES-${lowerName.substring(6).toUpperCase()}`);
    }

    // Microsoft Exchange signals
    if (lowerName.startsWith('x-ms-exchange-')) {
      signals.push(`X-MS-Exchange-${lowerName.substring(14).toUpperCase()}`);
    }

    // Postmark signals
    if (lowerName.startsWith('x-pm-') || lowerName === 'x-postmark-tag') {
      signals.push(`X-PM-${lowerName.substring(5).toUpperCase()}`);
    }

    // SparkPost signals
    if (lowerName.startsWith('x-sp-') || lowerName === 'x-spam-score') {
      signals.push(`X-SP-${lowerName.substring(5).toUpperCase()}`);
    }
  }

  return signals;
}
