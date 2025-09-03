import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Email, EmailSchema } from '../schemas/email.schema';
import { TestSession, TestSessionSchema } from '../schemas/test.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Email.name, schema: EmailSchema },
      { name: TestSession.name, schema: TestSessionSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
