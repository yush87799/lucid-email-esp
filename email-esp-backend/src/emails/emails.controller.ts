import { Controller, Post, Get, Param } from '@nestjs/common';
import { EmailsService } from './emails.service';
import { ImapService } from '../imap/imap.service';

@Controller()
export class EmailsController {
  constructor(
    private readonly emailsService: EmailsService,
    private readonly imapService: ImapService,
  ) {}

  @Post('tests/start')
  async startTest() {
    return await this.emailsService.startTest();
  }

  @Get('tests/:token/status')
  async getTestStatus(@Param('token') token: string) {
    return await this.emailsService.getTestStatus(token);
  }

  @Post('tests/:token/reset')
  async resetTest(@Param('token') token: string) {
    return await this.emailsService.resetTest(token);
  }

  @Get('debug/recent-emails')
  async getRecentEmails() {
    try {
      const emails = await this.imapService.listRecentEmails(10);
      return {
        success: true,
        count: emails.length,
        emails: emails
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  @Get('debug/mailboxes')
  async getMailboxes() {
    try {
      const mailboxes = await this.imapService.listMailboxes();
      return {
        success: true,
        mailboxes: mailboxes
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  @Get('debug/test-connection')
  async testConnection() {
    try {
      await this.imapService.connect();
      const mailboxes = await this.imapService.listMailboxes();
      return {
        success: true,
        connected: true,
        mailboxes: mailboxes
      };
    } catch (error) {
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  }
}
