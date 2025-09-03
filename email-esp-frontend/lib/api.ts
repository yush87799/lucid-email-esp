import { StartTestResponse, TestSessionStatus } from '../types/email';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE environment variable is required');
}

// Helper function to build API URLs without double slashes
function buildApiUrl(endpoint: string): string {
  if (!API_BASE) {
    throw new Error('NEXT_PUBLIC_API_BASE environment variable is required');
  }
  const baseUrl = API_BASE.replace(/\/$/, ''); // Remove trailing slash
  const cleanEndpoint = endpoint.replace(/^\//, ''); // Remove leading slash
  return `${baseUrl}/${cleanEndpoint}`;
}

export async function startTest(): Promise<StartTestResponse> {
  console.log('Starting test with API_BASE:', API_BASE);
  const url = buildApiUrl('/tests/start');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  console.log('Start test response:', response.status, response.statusText);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Start test error response:', errorText);
    throw new Error(`Failed to start test: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const result = await response.json();
  console.log('Start test result:', result);
  return result;
}

export async function getTestStatus(token: string): Promise<TestSessionStatus> {
  console.log('Getting test status for token:', token, 'API_BASE:', API_BASE);
  const url = buildApiUrl(`/tests/${token}/status`);
  const response = await fetch(url);
  
  console.log('Get test status response:', response.status, response.statusText);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Get test status error response:', errorText);
    throw new Error(`Failed to get test status: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const result = await response.json();
  console.log('Get test status result:', result);
  return result;
}

export async function resetTest(token: string): Promise<StartTestResponse> {
  console.log('Resetting test for token:', token, 'API_BASE:', API_BASE);
  const url = buildApiUrl(`/tests/${token}/reset`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  console.log('Reset test response:', response.status, response.statusText);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Reset test error response:', errorText);
    throw new Error(`Failed to reset test: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const result = await response.json();
  console.log('Reset test result:', result);
  return result;
}
