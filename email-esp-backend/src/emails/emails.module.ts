import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailsService } from './emails.service';
import { EmailsController } from './emails.controller';
import { TestSession, TestSessionSchema } from '../schemas/test.schema';
import { Email, EmailSchema } from '../schemas/email.schema';
import { ImapModule } from '../imap/imap.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestSession.name, schema: TestSessionSchema },
      { name: Email.name, schema: EmailSchema },
    ]),
    ImapModule,
  ],
  controllers: [EmailsController],
  providers: [EmailsService],
})
export class EmailsModule {}
