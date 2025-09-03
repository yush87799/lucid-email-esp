import { headersToMap, getAll } from './header-utils';
import { 
  parseAuthenticationResults, 
  extractMessageIdDomain, 
  extractReturnPathDomain, 
  extractDkimD, 
  extractXProviderSignals 
} from './auth-parser';

export type EspDetection = {
  provider: string;              // e.g., "Amazon SES", "SendGrid", ...
  confidence: number;            // 0..1
  reasons: string[];             // human-readable bullets
  signals: Record<string,string>;// extracted signal summary
};

const DOMAIN_TO_PROVIDER: Record<string, string> = {
  'amazonses.com': 'Amazon SES',
  'sendgrid.net': 'SendGrid',
  'mailgun.org': 'Mailgun',
  'sparkpostmail.com': 'SparkPost',
  'mailjet.com': 'Mailjet',
  'postmarkapp.com': 'Postmark',
  'protection.outlook.com': 'Microsoft 365/Outlook',
  'outlook.com': 'Microsoft 365/Outlook',
  'smtp.office365.com': 'Microsoft 365/Outlook',
  'zohomail.com': 'Zoho',
  'zoho.com': 'Zoho',
  'google.com': 'Gmail',
  'gmail.com': 'Gmail',
  'yahoo.com': 'Yahoo',
  'yahoo-inc.com': 'Yahoo',
};

export function detectESP(headers: Record<string, string | string[]>, messageId?: string): EspDetection {
  if (process.env.LOG_LEVEL === 'debug') {
    console.log('detectESP headers keys:', Object.keys(headers));
    console.log('detectESP messageId:', messageId);
  }

  // Convert headers to normalized format
  const headersMap = headersToMap(
    Object.entries(headers).map(([name, value]) => ({
      name: name.toLowerCase(),
      value: Array.isArray(value) ? value.join(' ') : value
    }))
  );

  const signals: Record<string, string> = {};
  const reasons: string[] = [];
  const providerScores: Record<string, number> = {};

  // Extract DKIM d= domain (weight: 5)
  const dkimSignatures = getAll(
    Object.entries(headersMap).map(([name, values]) => ({ name, value: values.join(' ') })),
    'dkim-signature'
  );
  const dkimDomain = extractDkimD(dkimSignatures);
  if (dkimDomain) {
    signals.dkim_d = dkimDomain;
    const provider = DOMAIN_TO_PROVIDER[dkimDomain];
    if (provider) {
      providerScores[provider] = (providerScores[provider] || 0) + 5;
      reasons.push(`DKIM d=${dkimDomain}`);
    }
  }

  // Extract Received hostnames (weight: 4)
  const receivedHeaders = getAll(
    Object.entries(headersMap).map(([name, values]) => ({ name, value: values.join(' ') })),
    'received'
  );
  for (const received of receivedHeaders) {
    for (const [domain, provider] of Object.entries(DOMAIN_TO_PROVIDER)) {
      if (received.toLowerCase().includes(domain)) {
        providerScores[provider] = (providerScores[provider] || 0) + 4;
        reasons.push(`Received via ${domain}`);
        signals.received_domain = domain;
        break;
      }
    }
  }

  // Extract Message-ID domain (weight: 3)
  const messageIdDomain = extractMessageIdDomain(messageId);
  if (messageIdDomain) {
    signals.message_id_domain = messageIdDomain;
    const provider = DOMAIN_TO_PROVIDER[messageIdDomain];
    if (provider) {
      providerScores[provider] = (providerScores[provider] || 0) + 3;
      reasons.push(`Message-ID domain ${messageIdDomain}`);
    }
  }

  // Extract Return-Path domain (weight: 2)
  const returnPathHeaders = getAll(
    Object.entries(headersMap).map(([name, values]) => ({ name, value: values.join(' ') })),
    'return-path'
  );
  if (returnPathHeaders.length > 0) {
    const returnPathDomain = extractReturnPathDomain(returnPathHeaders[0]);
    if (returnPathDomain) {
      signals.return_path_domain = returnPathDomain;
      const provider = DOMAIN_TO_PROVIDER[returnPathDomain];
      if (provider) {
        providerScores[provider] = (providerScores[provider] || 0) + 2;
        reasons.push(`Return-Path domain ${returnPathDomain}`);
      }
    }
  }

  // Extract X-* provider headers (weight: 3)
  const xSignals = extractXProviderSignals(headersMap);
  if (xSignals.length > 0) {
    signals.x_headers = xSignals.join(', ');
    // Map X-* signals to providers
    for (const signal of xSignals) {
      if (signal.includes('SG-')) {
        providerScores['SendGrid'] = (providerScores['SendGrid'] || 0) + 3;
        reasons.push(`${signal} present`);
      } else if (signal.includes('Mailgun-')) {
        providerScores['Mailgun'] = (providerScores['Mailgun'] || 0) + 3;
        reasons.push(`${signal} present`);
      } else if (signal.includes('MJ-')) {
        providerScores['Mailjet'] = (providerScores['Mailjet'] || 0) + 3;
        reasons.push(`${signal} present`);
      } else if (signal.includes('SES-')) {
        providerScores['Amazon SES'] = (providerScores['Amazon SES'] || 0) + 3;
        reasons.push(`${signal} present`);
      } else if (signal.includes('MS-Exchange-')) {
        providerScores['Microsoft 365/Outlook'] = (providerScores['Microsoft 365/Outlook'] || 0) + 3;
        reasons.push(`${signal} present`);
      } else if (signal.includes('PM-')) {
        providerScores['Postmark'] = (providerScores['Postmark'] || 0) + 3;
        reasons.push(`${signal} present`);
      }
    }
  }

  // Fallback: Authentication-Results hints (weight: 1-2)
  const authResults = parseAuthenticationResults(
    getAll(
      Object.entries(headersMap).map(([name, values]) => ({ name, value: values.join(' ') })),
      'authentication-results'
    )
  );
  if (authResults.spf?.domain) {
    const provider = DOMAIN_TO_PROVIDER[authResults.spf.domain];
    if (provider) {
      providerScores[provider] = (providerScores[provider] || 0) + 1;
      reasons.push(`SPF domain ${authResults.spf.domain}`);
    }
  }

  // Find highest scoring provider
  let bestProvider = 'Unknown';
  let bestScore = 0;

  for (const [provider, score] of Object.entries(providerScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestProvider = provider;
    }
  }

  // Calculate confidence (cap at 1.0)
  const confidence = Math.min(1, bestScore / 10);

  if (process.env.LOG_LEVEL === 'debug') {
    console.log('ESP detection signals:', signals);
    console.log('ESP detection reasons:', reasons);
    console.log('ESP detection scores:', providerScores);
  }

  return {
    provider: bestProvider,
    confidence,
    reasons,
    signals
  };
}
