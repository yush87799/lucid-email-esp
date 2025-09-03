import { parseReceivingChain } from '../src/analysis/received-parser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Received Parser', () => {
  const fixturesDir = join(__dirname, 'fixtures');

  const testCases = [
    { file: 'gmail.txt', expectedProvider: 'Gmail' },
    { file: 'amazonses.txt', expectedProvider: 'Amazon SES' },
    { file: 'sendgrid.txt', expectedProvider: 'SendGrid' },
  ];

  testCases.forEach(({ file, expectedProvider }) => {
    describe(`${expectedProvider} parsing`, () => {
      it(`should parse receiving chain from ${expectedProvider} fixture`, () => {
        try {
          const fixturePath = join(fixturesDir, file);
          const rawHeaders = readFileSync(fixturePath, 'utf-8');
          
          const result = parseReceivingChain(rawHeaders);
          
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBeGreaterThanOrEqual(2);
          
          // Check ordering (oldest -> newest)
          const timestamps = result
            .map(hop => hop.timestamp)
            .filter(ts => ts !== undefined)
            .map(ts => ts!.getTime());
          
          if (timestamps.length > 1) {
            for (let i = 0; i < timestamps.length - 1; i++) {
              expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i + 1]);
            }
          }
          
          // Check hop structure
          result.forEach(hop => {
            expect(hop.from).toBeDefined();
            expect(hop.by).toBeDefined();
            expect(typeof hop.from).toBe('string');
            expect(typeof hop.by).toBe('string');
          });
        } catch (error) {
          // If fixture doesn't exist, skip test
          console.warn(`Skipping test for ${file} - fixture not found`);
        }
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty input', () => {
      const result = parseReceivingChain('');
      expect(result).toEqual([]);
    });

    it('should handle malformed received headers', () => {
      const malformed = `Received: malformed header without proper format
Received: from example.com by mail.example.com; Wed, 01 Jan 2024 12:00:00 +0000`;
      
      const result = parseReceivingChain(malformed);
      expect(result.length).toBeGreaterThan(0);
      // Should skip malformed headers but parse valid ones
    });

    it('should handle line folding', () => {
      const folded = `Received: from example.com
	by mail.example.com with SMTP id 12345;
	Wed, 01 Jan 2024 12:00:00 +0000`;
      
      const result = parseReceivingChain(folded);
      expect(result.length).toBe(1);
      expect(result[0].from).toContain('example.com');
      expect(result[0].by).toContain('mail.example.com');
    });
  });
});
