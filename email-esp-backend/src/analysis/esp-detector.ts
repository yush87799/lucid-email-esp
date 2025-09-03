export function detectESP(headers: Record<string, string | string[]>, messageId?: string): string {
  console.log('detectESP headers keys:', Object.keys(headers));
  console.log('detectESP messageId:', messageId);
  
  const headerStr = Object.entries(headers)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(' ') : value}`)
    .join(' ')
    .toLowerCase();
    
  console.log('detectESP header string length:', headerStr.length);

  // Amazon SES detection
  if (
    headerStr.includes('amazonses.com') ||
    headerStr.includes('ses') ||
    headerStr.includes('dkim-signature d=amazonses.com')
  ) {
    return 'Amazon SES';
  }

  // SendGrid detection
  if (headerStr.includes('sendgrid.net')) {
    return 'SendGrid';
  }

  // Mailgun detection
  if (headerStr.includes('mailgun.org')) {
    return 'Mailgun';
  }

  // SparkPost detection
  if (headerStr.includes('sparkpostmail.com')) {
    return 'SparkPost';
  }

  // Mailjet detection
  if (headerStr.includes('mailjet.com')) {
    return 'Mailjet';
  }

  // Postmark detection
  if (headerStr.includes('postmarkapp.com')) {
    return 'Postmark';
  }

  // Yahoo detection
  if (
    headerStr.includes('smtp.mail.yahoo.com') ||
    headerStr.includes('yahoo-inc.com')
  ) {
    return 'Yahoo';
  }

  // Microsoft 365/Outlook detection
  if (
    headerStr.includes('outlook.com') ||
    headerStr.includes('protection.outlook.com') ||
    headerStr.includes('smtp.office365.com')
  ) {
    return 'Microsoft 365/Outlook';
  }

  // Zoho detection
  if (
    headerStr.includes('zoho.com') ||
    headerStr.includes('zohomail.com')
  ) {
    return 'Zoho';
  }

  // Gmail detection - improved
  if (
    headerStr.includes('gmail.com') || 
    headerStr.includes('google.com') ||
    headerStr.includes('x-google-dkim-signature') ||
    headerStr.includes('mail-oi1-f180.google.com') ||
    headerStr.includes('by mail-oi1-f180.google.com')
  ) {
    return 'Gmail';
  }

  // Special Gmail message ID detection
  if (messageId && messageId.includes('@mail.gmail.com')) {
    return 'Gmail';
  }

  // Fallback: Check message-id domain
  if (messageId) {
    const messageIdMatch = messageId.match(/<.*?@([^>]+)>/);
    if (messageIdMatch) {
      const domain = messageIdMatch[1].toLowerCase();
      
      // Common domain mappings
      const domainMap: Record<string, string> = {
        'amazonses.com': 'Amazon SES',
        'sendgrid.net': 'SendGrid',
        'mailgun.org': 'Mailgun',
        'sparkpostmail.com': 'SparkPost',
        'mailjet.com': 'Mailjet',
        'postmarkapp.com': 'Postmark',
        'yahoo.com': 'Yahoo',
        'outlook.com': 'Microsoft 365/Outlook',
        'zoho.com': 'Zoho',
        'gmail.com': 'Gmail',
        'google.com': 'Gmail',
        'mail.gmail.com': 'Gmail',
      };

      if (domainMap[domain]) {
        return domainMap[domain];
      }
    }
  }

  return 'Unknown';
}
