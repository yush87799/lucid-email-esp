export type ChainHop = {
  by: string;
  from: string;
  with?: string;
  id?: string;
  for?: string;
  timestamp?: string; // ISO string
  ip?: string;
  hopDurationMs?: number; // duration to next hop in milliseconds
};

export type TestStatus = 'waiting' | 'received' | 'parsed' | 'error';

export type TestSessionStatus = {
  token: string;
  subject: string;
  status: TestStatus;
  emailId?: string;
  esp?: string;
  espProvider?: string;
  espConfidence?: number;
  espReasons?: string[];
  receivingChain?: ChainHop[];
  error?: string;
};

export type StartTestResponse = { token: string; subject: string };
