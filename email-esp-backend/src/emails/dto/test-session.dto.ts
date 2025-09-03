import { z } from 'zod';

export const TestSessionResponseSchema = z.object({
  status: z.enum(['waiting', 'received', 'parsed', 'error']),
  subject: z.string(),
  emailId: z.string().optional(),
  esp: z.string().optional(),
  receivingChain: z
    .array(
      z.object({
        by: z.string(),
        from: z.string(),
        with: z.string().optional(),
        id: z.string().optional(),
        for: z.string().optional(),
        timestamp: z.date().optional(),
        ip: z.string().optional(),
      }),
    )
    .optional(),
});

export const StartTestResponseSchema = z.object({
  token: z.string(),
  subject: z.string(),
});

export type TestSessionResponse = z.infer<typeof TestSessionResponseSchema>;
export type StartTestResponse = z.infer<typeof StartTestResponseSchema>;
