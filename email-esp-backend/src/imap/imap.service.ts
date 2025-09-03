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
        // Connection timeout settings
        socketTimeout: 30000, // 30 seconds
        greetingTimeout: 10000, // 10 seconds
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
        // Don't throw here, let the calling code handle reconnection
      });

    } catch (error) {
      this.logger.error('Failed to connect to IMAP:', error);
      throw error;
    }
  }

  async watchForSubject(subjectToken: string, maxWaitTime: number = 300000): Promise<{ uid: number; envelope: any }> {
    const startTime = Date.now();
    const pollInterval = 15000; // Check every 15 seconds (increased from 10)
    let lastConnectionCheck = 0;
    const connectionCheckInterval = 60000; // Check connection every 60 seconds

    this.logger.log(`Starting to watch for email with subject: ${subjectToken}`);

    // Gmail mailboxes to search in order of preference
    const searchMailboxes = ['INBOX', '[Gmail]/All Mail', '[Gmail]/Sent Mail'];

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Periodically check and refresh connection
        if (Date.now() - lastConnectionCheck > connectionCheckInterval) {
          this.logger.log(`Checking IMAP connection health...`);
          await this.ensureConnection();
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
            // If connection error, try to reconnect
            if (error.message.includes('Connection') || error.message.includes('closed')) {
              this.logger.log(`Connection error detected, will reconnect on next iteration`);
              this.isConnected = false;
            }
            continue;
          }
        }

        // No message found yet, log and continue polling
        this.logger.log(`No message found yet for subject: ${subjectToken}. Continuing to poll... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));

      } catch (error) {
        this.logger.error(`Error in watchForSubject loop:`, error);
        this.isConnected = false; // Mark connection as failed
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Timeout reached
    throw new Error(`Timeout: No message found with subject containing token: ${subjectToken} after ${maxWaitTime/1000} seconds`);
  }

  async getFullMessage(uid: number): Promise<{ headers: any; body: string }> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await this.ensureConnection();

        if (!this.client || !this.isConnected) {
          throw new Error('IMAP client not connected');
        }

        // Try multiple mailboxes to find the message
        const searchMailboxes = ['INBOX', '[Gmail]/All Mail', '[Gmail]/Sent Mail'];
        
        for (const mailbox of searchMailboxes) {
          try {
            this.logger.log(`Attempting to download UID ${uid} from ${mailbox}...`);
            const lock = await this.client.getMailboxLock(mailbox);
            
            try {
              // Add timeout to prevent hanging
              const downloadPromise = this.client.download(uid.toString(), '1:*', { uid: true });
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Download timeout for UID ${uid}`)), 30000); // 30 second timeout
              });
              
              const downloadObject = await Promise.race([downloadPromise, timeoutPromise]) as any;
              
              if (!downloadObject) {
                this.logger.log(`Message with UID ${uid} not found in ${mailbox}`);
                continue; // Try next mailbox
              }

              this.logger.log(`Retrieved full message for UID ${uid} from ${mailbox}`);
              this.logger.log(`Download object keys:`, Object.keys(downloadObject));
              this.logger.log(`Meta keys:`, downloadObject.meta ? Object.keys(downloadObject.meta) : 'no meta');
              this.logger.log(`Content type:`, typeof downloadObject.content);
              this.logger.log(`Content available:`, downloadObject.content ? 'yes' : 'no');
              
              // Convert stream to string properly
              let bodyContent = '';
              if (downloadObject.content) {
                // Handle both Buffer and Readable stream
                if (Buffer.isBuffer(downloadObject.content)) {
                  bodyContent = downloadObject.content.toString();
                } else {
                  // It's a Readable stream, collect the data
                  const chunks: Buffer[] = [];
                  for await (const chunk of downloadObject.content) {
                    chunks.push(chunk);
                  }
                  bodyContent = Buffer.concat(chunks).toString();
                }
              }
              
              this.logger.log(`Body content length: ${bodyContent.length}`);
              
              return {
                headers: downloadObject.meta || {},
                body: bodyContent
              };

            } finally {
              lock.release();
            }
          } catch (mailboxError) {
            this.logger.log(`Could not download from ${mailbox}:`, mailboxError.message);
            if (mailboxError.message.includes('Connection') || mailboxError.message.includes('closed')) {
              this.isConnected = false;
              throw mailboxError; // Re-throw connection errors to trigger retry
            }
            continue; // Try next mailbox
          }
        }
        
        throw new Error(`Message with UID ${uid} not found in any mailbox`);

      } catch (error) {
        retryCount++;
        this.logger.error(`Error getting full message for UID ${uid} (attempt ${retryCount}/${maxRetries}):`, error);
        
        if (error.message.includes('Connection') || error.message.includes('closed')) {
          this.isConnected = false;
          if (retryCount < maxRetries) {
            this.logger.log(`Connection error, retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
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
          setTimeout(() => reject(new Error('Connection test timeout')), 5000);
        });
        
        await Promise.race([testPromise, timeoutPromise]);
      } catch (error) {
        this.logger.log('Connection test failed, reconnecting...', error.message);
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