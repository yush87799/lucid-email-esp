export type ChainHop = {
  by: string;
  from: string;
  with?: string;
  id?: string;
  for?: string;
  timestamp?: string; // ISO string
  ip?: string;
};

export type TestStatus = 'waiting' | 'received' | 'parsed' | 'error';

export type TestSessionStatus = {
  token: string;
  subject: string;
  status: TestStatus;
  emailId?: string;
  esp?: string;
  receivingChain?: ChainHop[];
  error?: string;
};

export type StartTestResponse = { token: string; subject: string };
