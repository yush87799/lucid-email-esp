export function parseReceivingChain(rawHeaders: string | Buffer): Array<{
  by: string;
  from: string;
  with?: string;
  id?: string;
  for?: string;
  timestamp?: Date;
  ip?: string;
}> {
  const headersStr = Buffer.isBuffer(rawHeaders) ? rawHeaders.toString() : rawHeaders;
  
  console.log('parseReceivingChain input length:', headersStr.length);
  console.log('parseReceivingChain input preview:', headersStr.substring(0, 500));
  
  // Extract all Received headers in order
  const receivedRegex = /^Received:\s*(.*?)(?=^[A-Za-z-]+:|$)/gms;
  const receivedHeaders: string[] = [];
  let match;
  
  while ((match = receivedRegex.exec(headersStr)) !== null) {
    receivedHeaders.push(match[1].trim());
  }
  
  console.log('Found received headers:', receivedHeaders.length);
  
  const parsedChain = receivedHeaders.map(header => {
    // Clean up multiline headers by removing line breaks and extra whitespace
    const cleanHeader = header.replace(/\s+/g, ' ').trim();
    
    // Parse individual components
    const byMatch = cleanHeader.match(/by\s+([^\s;]+)/i);
    const fromMatch = cleanHeader.match(/from\s+([^\s;]+)/i);
    const withMatch = cleanHeader.match(/with\s+([^\s;]+)/i);
    const idMatch = cleanHeader.match(/id\s+([^\s;]+)/i);
    const forMatch = cleanHeader.match(/for\s+([^\s;]+)/i);
    
    // Extract IP address from brackets (IPv4 or IPv6)
    const ipMatch = cleanHeader.match(/\[([0-9a-fA-F:.]+)\]/);
    
    // Extract timestamp (usually at the end of the header)
    const timestampMatch = cleanHeader.match(/([A-Za-z]{3},\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4})/);
    
    const result: {
      by: string;
      from: string;
      with?: string;
      id?: string;
      for?: string;
      timestamp?: Date;
      ip?: string;
    } = {
      by: byMatch ? byMatch[1] : '',
      from: fromMatch ? fromMatch[1] : '',
    };
    
    if (withMatch) result.with = withMatch[1];
    if (idMatch) result.id = idMatch[1];
    if (forMatch) result.for = forMatch[1];
    if (ipMatch) result.ip = ipMatch[1];
    
    if (timestampMatch) {
      try {
        result.timestamp = new Date(timestampMatch[1]);
      } catch (error) {
        // If date parsing fails, leave timestamp undefined
      }
    }
    
    return result;
  });
  
  // Return in order oldest->newest (Received headers are typically newest first)
  return parsedChain.reverse();
}
