import { Injectable, Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';

@Injectable()
export class ImapService {
  private readonly logger = new Logger(ImapService.name);
  private client: ImapFlow | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
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
      });

      await this.client.connect();
      this.isConnected = true;
      this.logger.log('IMAP connection established');

      // Handle connection close events
      this.client.on('close', () => {
        this.isConnected = false;
        this.logger.warn('IMAP connection closed');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        this.logger.error('IMAP connection error:', error);
      });

    } catch (error) {
      this.logger.error('Failed to connect to IMAP:', error);
      throw error;
    }
  }

  async watchForSubject(subjectToken: string, maxWaitTime: number = 300000): Promise<{ uid: number; envelope: any }> {
    await this.ensureConnection();

    if (!this.client) {
      throw new Error('IMAP client not connected');
    }

    const startTime = Date.now();
    const pollInterval = 10000; // Check every 10 seconds

    this.logger.log(`Starting to watch for email with subject: ${subjectToken}`);

    // Gmail mailboxes to search in order of preference
    const searchMailboxes = ['INBOX', '[Gmail]/All Mail', '[Gmail]/Sent Mail'];

    while (Date.now() - startTime < maxWaitTime) {
      for (const mailbox of searchMailboxes) {
        try {
          this.logger.log(`Searching in mailbox: ${mailbox}`);
          const lock = await this.client.getMailboxLock(mailbox);
          
          try {
            // Search for messages with subject containing the token
            const searchResults = await this.client.search({
              subject: subjectToken
            });

            this.logger.log(`Search results in ${mailbox}:`, searchResults);

            if (searchResults && searchResults.length > 0) {
              // Get the newest message (highest UID)
              const newestUid = Math.max(...searchResults);

              // Fetch the envelope for the newest message
              const messages = this.client.fetch(newestUid, { envelope: true, uid: true });
              let envelope: any = null;

              for await (const message of messages) {
                envelope = message.envelope;
                break;
              }

              this.logger.log(`Found message with UID ${newestUid} for subject token: ${subjectToken} in ${mailbox}`);
              return {
                uid: newestUid,
                envelope
              };
            }

          } finally {
            lock.release();
          }

        } catch (error) {
          this.logger.log(`Could not search in ${mailbox}:`, error.message);
          continue;
        }
      }

      // No message found yet, log and continue polling
      this.logger.log(`No message found yet for subject: ${subjectToken}. Continuing to poll...`);

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout reached
    throw new Error(`Timeout: No message found with subject containing token: ${subjectToken} after ${maxWaitTime/1000} seconds`);
  }

  async getFullMessage(uid: number): Promise<{ headers: any; body: string }> {
    await this.ensureConnection();

    if (!this.client) {
      throw new Error('IMAP client not connected');
    }

    try {
      const lock = await this.client.getMailboxLock('INBOX');
      
      try {
        // Fetch full message with headers and body
        const downloadObject = await this.client.download(uid.toString(), '1:*', { uid: true });
        
        if (!downloadObject) {
          throw new Error(`Message with UID ${uid} not found`);
        }

        this.logger.log(`Retrieved full message for UID ${uid}`);
        this.logger.log(`Download object keys:`, Object.keys(downloadObject));
        this.logger.log(`Meta keys:`, downloadObject.meta ? Object.keys(downloadObject.meta) : 'no meta');
        this.logger.log(`Content type:`, typeof downloadObject.content);
        this.logger.log(`Content available:`, downloadObject.content ? 'yes' : 'no');
        
        return {
          headers: downloadObject.meta || {},
          body: downloadObject.content ? downloadObject.content.toString() : ''
        };

      } finally {
        lock.release();
      }

    } catch (error) {
      this.logger.error(`Error getting full message for UID ${uid}:`, error);
      throw error;
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected || !this.client) {
      await this.connect();
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
      this.logger.log('Available mailboxes:', mailboxes.map(mb => mb.path));

      // Try Gmail mailboxes in order of preference
      const searchMailboxes = ['INBOX', '[Gmail]/All Mail', '[Gmail]/Sent Mail'];
      
      for (const mailbox of searchMailboxes) {
        try {
          this.logger.log(`Trying mailbox: ${mailbox}`);
          const lock = await this.client.getMailboxLock(mailbox);
          
          try {
            // Get mailbox status
            const status = await this.client.status(mailbox, { messages: true, unseen: true });
            this.logger.log(`Mailbox ${mailbox} status:`, status);

            // Get recent messages
            const searchResults = await this.client.search({
              all: true
            });

            this.logger.log(`Search results for ${mailbox}:`, searchResults);

            if (searchResults && searchResults.length > 0) {
              // Get the most recent messages (highest UIDs)
              const recentUids = searchResults
                .sort((a, b) => b - a)
                .slice(0, limit);

              const emails: any[] = [];
              for (const uid of recentUids) {
                const messages = this.client.fetch(uid, { envelope: true, uid: true });
                
                for await (const message of messages) {
                  emails.push({
                    uid: message.uid,
                    subject: message.envelope?.subject || 'No Subject',
                    from: message.envelope?.from?.[0]?.address || 'Unknown',
                    date: message.envelope?.date || 'Unknown',
                    mailbox: mailbox
                  });
                  break;
                }
              }

              this.logger.log(`Retrieved ${emails.length} emails from ${mailbox}`);
              return emails;
            } else {
              this.logger.log(`No messages found in ${mailbox}`);
            }

          } finally {
            lock.release();
          }
        } catch (mailboxError) {
          this.logger.log(`Could not access mailbox ${mailbox}:`, mailboxError.message);
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
      return mailboxes.map(mb => ({
        path: mb.path,
        name: mb.name,
        delimiter: mb.delimiter,
        flags: mb.flags,
        listed: mb.listed,
        subscribed: mb.subscribed
      }));
    } catch (error) {
      this.logger.error('Error listing mailboxes:', error);
      throw error;
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