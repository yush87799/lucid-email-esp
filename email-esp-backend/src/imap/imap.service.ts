import { Injectable, Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';

export type LocatedMessage = {
  mailbox: string;
  uid: number;
  messageId?: string;
};

@Injectable()
export class ImapService {
  private readonly logger = new Logger(ImapService.name);
  private client: ImapFlow | null = null;
  private isConnected = false;
  private connectionRetryCount = 0;
  private maxRetries = 3;
  private lastConnectionTime = 0;
  private connectionCooldown = 5000; // 5 seconds between connection attempts

  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    // Implement connection cooldown to prevent rapid reconnection attempts
    const now = Date.now();
    if (now - this.lastConnectionTime < this.connectionCooldown) {
      const waitTime = this.connectionCooldown - (now - this.lastConnectionTime);
      this.logger.log(`Connection cooldown: waiting ${waitTime}ms before reconnecting...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Clean up any existing connection
    if (this.client) {
      try {
        await this.client.logout();
      } catch (error) {
        // Ignore logout errors
      }
      this.client = null;
      this.isConnected = false;
    }

    try {
      // Ensure required environment variables are set
      const host = process.env.IMAP_HOST;
      const user = process.env.IMAP_USER;
      const pass = process.env.IMAP_PASS;

      if (!host || !user || !pass) {
        throw new Error('Missing required IMAP environment variables');
      }

      this.client = new ImapFlow({
        host,
        port: parseInt(process.env.IMAP_PORT || '993'),
        secure: process.env.IMAP_SECURE === 'true',
        auth: {
          user,
          pass,
        },
        logger: false, // Disable ImapFlow's internal logging
        // Optimized connection timeout settings
        socketTimeout: 60000, // 60 seconds (increased for stability)
        greetingTimeout: 15000, // 15 seconds (increased for reliability)
        // Faster connection establishment
        tls: {
          rejectUnauthorized: false, // For development/testing
        },
      });

      await this.client.connect();
      this.isConnected = true;
      this.connectionRetryCount = 0; // Reset retry count on successful connection
      this.lastConnectionTime = Date.now();
      this.logger.log('IMAP connection established');

      // Handle connection close events
      this.client.on('close', () => {
        this.isConnected = false;
        this.logger.warn('IMAP connection closed');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        this.logger.error('IMAP connection error:', error);
        // Don't throw here, let the calling code handle reconnection
      });
    } catch (error) {
      this.connectionRetryCount++;
      this.lastConnectionTime = Date.now();
      this.logger.error(`Failed to connect to IMAP (attempt ${this.connectionRetryCount}/${this.maxRetries}):`, error);
      
      if (this.connectionRetryCount >= this.maxRetries) {
        this.logger.error('Maximum connection retries exceeded');
        throw new Error(`Failed to connect to IMAP after ${this.maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retrying with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, this.connectionRetryCount - 1), 10000);
      this.logger.log(`Retrying connection in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Recursive retry
      return this.connect();
    }
  }

  async watchForSubject(
    subjectToken: string,
    maxWaitTime: number = 300000,
  ): Promise<LocatedMessage & { envelope: any }> {
    const startTime = Date.now();
    const pollInterval = 10000; // Check every 10 seconds (balanced for speed and stability)
    let lastConnectionCheck = 0;
    const connectionCheckInterval = 120000; // Check connection every 2 minutes (reduced frequency)

    this.logger.log(
      `Starting to watch for email with subject: ${subjectToken}`,
    );

    // Gmail mailboxes to search in order of preference
    const searchMailboxes = ['INBOX', '[Gmail]/All Mail', '[Gmail]/Sent Mail'];

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Periodically check and refresh connection
        if (Date.now() - lastConnectionCheck > connectionCheckInterval) {
          this.logger.log(`Checking IMAP connection health...`);
          const isHealthy = await this.isConnectionHealthy();
          if (!isHealthy) {
            this.logger.log(`Connection unhealthy, reconnecting...`);
            await this.ensureConnection();
          }
          lastConnectionCheck = Date.now();
        }

        if (!this.client || !this.isConnected) {
          this.logger.log(`IMAP connection lost, reconnecting...`);
          await this.connect();
        }

        if (!this.client) {
          throw new Error('IMAP client not available after reconnection');
        }

        for (const mailbox of searchMailboxes) {
          try {
            this.logger.log(`Searching in mailbox: ${mailbox}`);
            const lock = await this.client.getMailboxLock(mailbox);

            try {
              // Search for messages with subject containing the token
              const searchResults = await this.client.search({
                subject: subjectToken,
              });

              this.logger.log(`Search results in ${mailbox}:`, searchResults);

              if (searchResults && searchResults.length > 0) {
                // Get the newest message (highest UID)
                const newestUid = Math.max(...searchResults);

                // Fetch the envelope for the newest message
                const messages = this.client.fetch(newestUid, {
                  envelope: true,
                  uid: true,
                });
                let envelope: any = null;

                for await (const message of messages) {
                  envelope = message.envelope;
                  break;
                }

                this.logger.log(
                  `Found message with UID ${newestUid} for subject token: ${subjectToken} in ${mailbox}`,
                );
                return {
                  mailbox,
                  uid: newestUid,
                  messageId: envelope?.messageId,
                  envelope,
                };
              }
            } finally {
              lock.release();
            }
          } catch (error) {
            this.logger.log(`Could not search in ${mailbox}:`, error.message);
            // If connection error, try to reconnect
            if (
              error.message.includes('Connection') ||
              error.message.includes('closed')
            ) {
              this.logger.log(
                `Connection error detected, will reconnect on next iteration`,
              );
              this.isConnected = false;
            }
            continue;
          }
        }

        // No message found yet, log and continue polling
        this.logger.log(
          `No message found yet for subject: ${subjectToken}. Continuing to poll... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`,
        );

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        this.logger.error(`Error in watchForSubject loop:`, error);
        this.isConnected = false; // Mark connection as failed
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    // Timeout reached
    throw new Error(
      `Timeout: No message found with subject containing token: ${subjectToken} after ${maxWaitTime / 1000} seconds`,
    );
  }

  async fetchFromMailbox(
    mailbox: string,
    uid: number,
  ): Promise<{ headers: any; body: string }> {
    const maxRetries = 5; // Increased retries for better reliability
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await this.ensureConnection();

        if (!this.client || !this.isConnected) {
          throw new Error('IMAP client not connected');
        }

        if (process.env.LOG_LEVEL === 'debug') {
          this.logger.log(`Fetching UID ${uid} from mailbox ${mailbox}`);
        }

        const lock = await this.client.getMailboxLock(mailbox);

        try {
          // First open the exact mailbox
          await this.client.mailboxOpen(mailbox, { readOnly: true });

          // Use fetch instead of download for better compatibility
          const fetchPromise = this.client.fetch(uid, {
            uid: true,
            source: true,
            headers: true,
            envelope: true,
          });
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error(`Fetch timeout for UID ${uid}`)),
              45000,
            ); // 45 second timeout (increased for stability)
          });

          const messages = await Promise.race([
            fetchPromise,
            timeoutPromise,
          ]) as any;

          if (!messages) {
            throw new Error(`Message with UID ${uid} not found in ${mailbox}`);
          }

          // Get the first (and only) message
          let message: any = null;
          for await (const msg of messages) {
            message = msg;
            break;
          }

          if (!message) {
            throw new Error(`Message with UID ${uid} not found in ${mailbox}`);
          }

          if (process.env.LOG_LEVEL === 'debug') {
            this.logger.log(
              `Retrieved full message for UID ${uid} from ${mailbox}`,
            );
          }

          // Extract headers and body from the message
          const headers = message.headers || {};
          let bodyContent = '';
          
          if (message.source) {
            // Handle both Buffer and Readable stream
            if (Buffer.isBuffer(message.source)) {
              bodyContent = message.source.toString();
            } else {
              // It's a Readable stream, collect the data
              const chunks: Buffer[] = [];
              for await (const chunk of message.source) {
                chunks.push(chunk);
              }
              bodyContent = Buffer.concat(chunks).toString();
            }
          }

          return {
            headers,
            body: bodyContent,
          };
        } finally {
          lock.release();
        }
      } catch (error) {
        retryCount++;
        this.logger.error(
          `Error fetching UID ${uid} from ${mailbox} (attempt ${retryCount}/${maxRetries}):`,
          error,
        );

        if (
          error.message.includes('Connection') ||
          error.message.includes('closed') ||
          error.message.includes('ETIMEOUT') ||
          error.message.includes('timeout')
        ) {
          this.isConnected = false;
          if (retryCount < maxRetries) {
            // Exponential backoff for retries
            const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 8000);
            this.logger.log(`Connection error, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          }
        }

        if (retryCount >= maxRetries) {
          throw error;
        }
      }
    }

    // This should never be reached due to the throw above, but TypeScript needs it
    throw new Error('Maximum retries exceeded');
  }

  async getFullMessage(uid: number): Promise<{ headers: any; body: string }> {
    // Legacy method - try multiple mailboxes for backward compatibility
    const searchMailboxes = ['INBOX', '[Gmail]/All Mail', '[Gmail]/Sent Mail'];

    for (const mailbox of searchMailboxes) {
      try {
        return await this.fetchFromMailbox(mailbox, uid);
      } catch (error) {
        this.logger.log(
          `Could not fetch UID ${uid} from ${mailbox}:`,
          error.message,
        );
        continue; // Try next mailbox
      }
    }

    throw new Error(`Message with UID ${uid} not found in any mailbox`);
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected || !this.client) {
      this.logger.log('Connection not available, reconnecting...');
      await this.connect();
    } else {
      // Test the connection with a simple command
      try {
        // Use a timeout for the connection test
        const testPromise = this.client.status('INBOX', { messages: true });
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection test timeout')), 10000);
        });

        await Promise.race([testPromise, timeoutPromise]);
      } catch (error) {
        this.logger.log(
          'Connection test failed, reconnecting...',
          error.message,
        );
        this.isConnected = false;
        // Clean up the old client
        if (this.client) {
          try {
            await this.client.logout();
          } catch (logoutError) {
            // Ignore logout errors
          }
          this.client = null;
        }
        await this.connect();
      }
    }
  }

  // Add a method to check connection health without reconnecting
  private async isConnectionHealthy(): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const testPromise = this.client.status('INBOX', { messages: true });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), 5000);
      });

      await Promise.race([testPromise, timeoutPromise]);
      return true;
    } catch (error) {
      this.logger.log('Connection health check failed:', error.message);
      return false;
    }
  }

  async listRecentEmails(limit: number = 10): Promise<any[]> {
    await this.ensureConnection();

    if (!this.client) {
      throw new Error('IMAP client not connected');
    }

    try {
      // First, let's list all available mailboxes
      const mailboxes = await this.client.list();
      this.logger.log(
        'Available mailboxes:',
        mailboxes.map((mb) => mb.path),
      );

      // Try Gmail mailboxes in order of preference
      const searchMailboxes = [
        'INBOX',
        '[Gmail]/All Mail',
        '[Gmail]/Sent Mail',
      ];

      for (const mailbox of searchMailboxes) {
        try {
          this.logger.log(`Trying mailbox: ${mailbox}`);
          const lock = await this.client.getMailboxLock(mailbox);

          try {
            // Get mailbox status
            const status = await this.client.status(mailbox, {
              messages: true,
              unseen: true,
            });
            this.logger.log(`Mailbox ${mailbox} status:`, status);

            // Get recent messages
            const searchResults = await this.client.search({
              all: true,
            });

            this.logger.log(`Search results for ${mailbox}:`, searchResults);

            if (searchResults && searchResults.length > 0) {
              // Get the most recent messages (highest UIDs)
              const recentUids = searchResults
                .sort((a, b) => b - a)
                .slice(0, limit);

              const emails: any[] = [];
              for (const uid of recentUids) {
                const messages = this.client.fetch(uid, {
                  envelope: true,
                  uid: true,
                });

                for await (const message of messages) {
                  emails.push({
                    uid: message.uid,
                    subject: message.envelope?.subject || 'No Subject',
                    from: message.envelope?.from?.[0]?.address || 'Unknown',
                    date: message.envelope?.date || 'Unknown',
                    mailbox: mailbox,
                  });
                  break;
                }
              }

              this.logger.log(
                `Retrieved ${emails.length} emails from ${mailbox}`,
              );
              return emails;
            } else {
              this.logger.log(`No messages found in ${mailbox}`);
            }
          } finally {
            lock.release();
          }
        } catch (mailboxError) {
          this.logger.log(
            `Could not access mailbox ${mailbox}:`,
            mailboxError.message,
          );
          continue;
        }
      }

      this.logger.log('No emails found in any mailbox');
      return [];
    } catch (error) {
      this.logger.error('Error listing recent emails:', error);
      throw error;
    }
  }

  async listMailboxes(): Promise<any[]> {
    await this.ensureConnection();

    if (!this.client) {
      throw new Error('IMAP client not connected');
    }

    try {
      const mailboxes = await this.client.list();
      return mailboxes.map((mb) => ({
        path: mb.path,
        name: mb.name,
        delimiter: mb.delimiter,
        flags: mb.flags,
        listed: mb.listed,
        subscribed: mb.subscribed,
      }));
    } catch (error) {
      this.logger.error('Error listing mailboxes:', error);
      throw error;
    }
  }

  // Pre-warm connection for faster subsequent operations
  async preWarmConnection(): Promise<void> {
    try {
      await this.ensureConnection();
      if (this.client && this.isConnected) {
        // Perform a lightweight operation to ensure connection is ready
        await this.client.status('INBOX', { messages: true });
        this.logger.log('IMAP connection pre-warmed successfully');
      }
    } catch (error) {
      this.logger.log('Failed to pre-warm connection:', error.message);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.logout();
      this.isConnected = false;
      this.logger.log('IMAP connection closed');
    }
  }
}
