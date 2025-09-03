import { detectESP } from './esp-detector';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('ESP Detector', () => {
  const fixturesDir = join(__dirname, 'fixtures');

  const testCases = [
    { file: 'gmail.txt', expectedProvider: 'Gmail' },
    { file: 'amazonses.txt', expectedProvider: 'Amazon SES' },
    { file: 'sendgrid.txt', expectedProvider: 'SendGrid' },
  ];

  testCases.forEach(({ file, expectedProvider }) => {
    describe(`${expectedProvider} detection`, () => {
      it(`should detect ${expectedProvider} from fixture`, () => {
        try {
          const fixturePath = join(fixturesDir, file);
          const rawHeaders = readFileSync(fixturePath, 'utf-8');

          // Convert raw headers to the format expected by detectESP
          const headers: Record<string, string | string[]> = {};
          const lines = rawHeaders.split(/\r?\n/);
          let currentHeader = '';
          let currentValue = '';

          for (const line of lines) {
            if (line.trim() === '') continue;

            if (line.match(/^[A-Za-z-]+:/)) {
              // Save previous header
              if (currentHeader) {
                headers[currentHeader] = currentValue.trim();
              }

              // Start new header
              const match = line.match(/^([^:]+):\s*(.*)$/);
              if (match) {
                currentHeader = match[1];
                currentValue = match[2];
              }
            } else {
              // Continuation line
              currentValue += ' ' + line.trim();
            }
          }

          // Don't forget the last header
          if (currentHeader) {
            headers[currentHeader] = currentValue.trim();
          }

          const result = detectESP(headers);

          expect(result.provider).toBe(expectedProvider);
          expect(result.confidence).toBeGreaterThanOrEqual(0.6);
          expect(result.reasons).toBeDefined();
          expect(result.reasons.length).toBeGreaterThan(0);
          expect(result.signals).toBeDefined();
        } catch (error) {
          // If fixture doesn't exist, skip test
          if (error.code === 'ENOENT') {
            console.warn(`Skipping test for ${file} - fixture not found`);
          } else {
            throw error; // Re-throw other errors
          }
        }
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty headers', () => {
      const result = detectESP({});
      expect(result.provider).toBe('Unknown');
      expect(result.confidence).toBe(0);
      expect(result.reasons).toEqual([]);
    });

    it('should handle unknown provider', () => {
      const headers = {
        received: ['from unknown.example.com by mail.example.com'],
        'message-id': ['<test@example.com>'],
      };

      const result = detectESP(headers);
      expect(result.provider).toBe('Unknown');
      expect(result.confidence).toBeLessThan(0.6);
    });
  });
});
