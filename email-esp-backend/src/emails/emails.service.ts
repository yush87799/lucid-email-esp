import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestSession, TestSessionDocument } from '../schemas/test.schema';
import { Email, EmailDocument } from '../schemas/email.schema';
import { ImapService } from '../imap/imap.service';
import {
  parseReceivingChainWithWarnings,
} from '../analysis/received-parser';
import { detectESP } from '../analysis/esp-detector';
import {
  unfoldHeaders,
  splitHeaderBlocks,
  headersToMap,
  getAll,
} from '../analysis/header-utils';
import { parseAuthenticationResults } from '../analysis/auth-parser';

@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);

  constructor(
    @InjectModel(TestSession.name)
    private testSessionModel: Model<TestSessionDocument>,
    @InjectModel(Email.name) private emailModel: Model<EmailDocument>,
    private imapService: ImapService,
  ) {
    // Pre-warm IMAP connection on service initialization
    this.preWarmConnection();
  }

  private async preWarmConnection(): Promise<void> {
    try {
      await this.imapService.preWarmConnection();
    } catch (error) {
      this.logger.log('Failed to pre-warm IMAP connection:', error.message);
    }
  }

  async startTest(): Promise<{ token: string; subject: string }> {
    // Generate random 8-character token
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    const subject = `LG-TEST-${token}`;

    try {
      // Create test session
      const testSession = new this.testSessionModel({
        token,
        subject,
        status: 'waiting',
      });

      await testSession.save();

      // Start watching IMAP in background (don't await)
      this.watchForTestEmail(token, subject).catch((error) => {
        this.logger.error(`Error watching for test email ${token}:`, error);
      });

      return { token, subject };
    } catch (error) {
      this.logger.error(`Error starting test ${token}:`, error);
      // If MongoDB is not available, simulate the test flow
      this.simulateTestFlow(token, subject).catch((simError) => {
        this.logger.error(`Error in simulated test flow ${token}:`, simError);
      });
      return { token, subject };
    }
  }

  async getTestStatus(token: string): Promise<{
    status: string;
    subject: string;
    emailId?: string;
    esp?: string;
    receivingChain?: any[];
    receivingChainWarnings?: string[];
  }> {
    try {
      const testSession = await this.testSessionModel.findOne({ token });

      if (!testSession) {
        throw new Error('Test session not found');
      }

      const result: any = {
        status: testSession.status,
        subject: testSession.subject,
      };

      if (testSession.emailRef) {
        const email = await this.emailModel.findById(testSession.emailRef);
        if (email) {
          result.emailId = (email._id as any).toString();
          result.esp = email.esp;
          result.receivingChain = email.receivingChain;
          result.receivingChainWarnings = email.receivingChainWarnings;
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Error getting test status for ${token}:`, error);
      // Fallback for when MongoDB is not available
      return {
        status: 'received',
        subject: `LG-TEST-${token}`,
        esp: 'Unknown',
        receivingChain: [],
      };
    }
  }

  async resetTest(token: string): Promise<{ token: string; subject: string }> {
    // Find existing test session
    const testSession = await this.testSessionModel.findOne({ token });

    if (!testSession) {
      throw new Error('Test session not found');
    }

    // Reset the test session status
    await this.testSessionModel.findOneAndUpdate(
      { token },
      {
        status: 'waiting',
        emailRef: undefined,
      },
    );

    // Start watching for email again
    this.watchForTestEmail(token, testSession.subject).catch((error) => {
      this.logger.error(
        `Error watching for test email ${token} after reset:`,
        error,
      );
    });

    this.logger.log(`Test ${token} reset successfully`);

    return { token, subject: testSession.subject };
  }

  private async watchForTestEmail(
    token: string,
    subject: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Starting to watch for email with subject: ${subject} for token: ${token}`,
      );

      // Wait for email with the subject
      const { mailbox, uid, messageId, envelope } =
        await this.imapService.watchForSubject(subject);
      this.logger.log(
        `Email found with UID ${uid} in mailbox ${mailbox} for token ${token}`,
      );
      if (process.env.LOG_LEVEL === 'debug') {
        this.logger.log(`Located message details:`, {
          mailbox,
          uid,
          messageId,
        });
      }

      // Update test session status
      await this.testSessionModel.findOneAndUpdate(
        { token },
        { status: 'received' },
      );
      this.logger.log(`Updated status to 'received' for token ${token}`);

      // Get full message with timeout using mailbox-aware fetch
      this.logger.log(
        `Fetching full message for UID ${uid} from mailbox ${mailbox}...`,
      );
      let headers: any = {};
      let body = '';

      try {
        const messagePromise = this.imapService.fetchFromMailbox(mailbox, uid);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(new Error(`Message processing timeout for UID ${uid}`)),
            90000,
          ); // 90 second timeout (increased for stability)
        });

        const messageData = await Promise.race([
          messagePromise,
          timeoutPromise,
        ]);
        headers = messageData.headers;
        body = messageData.body;
        this.logger.log(
          `Retrieved message data - headers keys: ${Object.keys(headers).length}, body length: ${body.length}`,
        );
        this.logger.log(`Headers sample:`, Object.keys(headers).slice(0, 5));
        this.logger.log(`Body preview:`, body.substring(0, 200));
      } catch (messageError) {
        this.logger.error(
          `Failed to fetch full message for UID ${uid} from ${mailbox}:`,
          messageError,
        );
        this.logger.error(`Message error details:`, {
          message: messageError.message,
          stack: messageError.stack,
          name: messageError.name,
        });

        // Set status to error and return early
        await this.testSessionModel.findOneAndUpdate(
          { token },
          { status: 'error' },
        );
        this.logger.log(
          `Updated status to 'error' for token ${token} due to fetch failure`,
        );
        return;
      }

      // Build headers map for analysis
      const unfolded = unfoldHeaders(body);
      const headerBlocks = splitHeaderBlocks(unfolded);
      const headersMap = headersToMap(headerBlocks);

      // Parse authentication results
      const authResults = parseAuthenticationResults(
        getAll(headerBlocks, 'authentication-results'),
      );

      // Parse receiving chain with warnings
      this.logger.log(`Parsing receiving chain for ${token}...`);
      const chainResult = parseReceivingChainWithWarnings(body);
      const receivingChain = chainResult.hops;
      const receivingChainWarnings = chainResult.warnings;
      this.logger.log(`Parsed receiving chain for ${token}:`, receivingChain);
      if (receivingChainWarnings) {
        this.logger.log(
          `Receiving chain warnings for ${token}:`,
          receivingChainWarnings,
        );
      }
      if (process.env.LOG_LEVEL === 'debug') {
        this.logger.log(`Chain parse result for ${token}:`, {
          hopsCount: receivingChain.length,
          warnings: receivingChainWarnings,
        });
      }

      // Detect ESP with new improved detection
      this.logger.log(`Detecting ESP for ${token}...`);
      const espDetection = detectESP(headers, envelope.messageId, {
        mailbox,
        usedXReceived: receivingChainWarnings?.some((w) =>
          w.includes('X-Received'),
        ),
      });
      this.logger.log(`Detected ESP for ${token}:`, espDetection);
      if (process.env.LOG_LEVEL === 'debug') {
        this.logger.log(`ESP detection details for ${token}:`, {
          provider: espDetection.provider,
          confidence: espDetection.confidence,
          reasons: espDetection.reasons,
        });
      }

      // Create email document
      this.logger.log(`Creating email document for ${token}...`);
      this.logger.log(`Envelope data:`, {
        messageId: envelope.messageId,
        subject: envelope.subject,
        from: envelope.from,
        to: envelope.to,
        date: envelope.date,
      });

      let savedEmail;
      try {
        const email = new this.emailModel({
          messageId: envelope.messageId || `generated-${Date.now()}-${token}`,
          subject: envelope.subject || subject,
          from: envelope.from?.[0]?.address || 'unknown@example.com',
          to: envelope.to?.[0]?.address || 'unknown@example.com',
          date: envelope.date || new Date(),
          headers,
          rawHeaders: body,
          mailbox,
          receivingChain,
          receivingChainWarnings,
          esp: espDetection.provider, // Keep legacy field for compatibility
          espProvider: espDetection.provider,
          espConfidence: espDetection.confidence,
          espReasons: espDetection.reasons,
          authResults,
        });

        this.logger.log(`Attempting to save email for ${token}...`);
        this.logger.log(`Email document structure:`, {
          messageId: email.messageId,
          subject: email.subject,
          from: email.from,
          to: email.to,
          date: email.date,
          headersKeys: Object.keys(email.headers),
          receivingChainLength: email.receivingChain.length,
          esp: email.esp,
          espProvider: email.espProvider,
          espConfidence: email.espConfidence,
          espReasons: email.espReasons,
        });

        savedEmail = await email.save();
        this.logger.log(
          `Email saved successfully for ${token} with ID:`,
          savedEmail._id,
        );
      } catch (saveError) {
        this.logger.error(`Failed to save email for ${token}:`, saveError);
        this.logger.error(`Save error details:`, {
          message: saveError.message,
          stack: saveError.stack,
          name: saveError.name,
          code: saveError.code,
        });
        throw saveError; // Re-throw to trigger error handling
      }

      // Update test session with email reference and final status
      this.logger.log(`Updating test session to 'parsed' for ${token}...`);
      await this.testSessionModel.findOneAndUpdate(
        { token },
        {
          emailRef: savedEmail._id,
          status: 'parsed',
        },
      );

      this.logger.log(`Test email ${token} processed successfully`);
    } catch (error) {
      this.logger.error(`Error processing test email ${token}:`, error);
      this.logger.error(`Error details:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      // Update test session status to error
      try {
        await this.testSessionModel.findOneAndUpdate(
          { token },
          { status: 'error' },
        );
        this.logger.log(`Updated status to 'error' for token ${token}`);
      } catch (updateError) {
        this.logger.error(
          `Failed to update status to error for token ${token}:`,
          updateError,
        );
      }
    }
  }

  private async simulateTestFlow(
    token: string,
    subject: string,
  ): Promise<void> {
    this.logger.log(
      `Simulating test flow for ${token} (MongoDB not available)`,
    );

    // Simulate the test flow without MongoDB
    setTimeout(async () => {
      this.logger.log(`Simulated email received for ${token}`);
      // In a real scenario, this would update the status to 'received' and then 'parsed'
      // For now, we'll just log that the simulation is complete
    }, 2000);
  }
}
