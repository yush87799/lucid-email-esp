import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailDocument = Email & Document;

@Schema({ timestamps: true })
export class Email {
  @Prop({ required: true, unique: true })
  messageId: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  to: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ type: Object, required: true })
  headers: Record<string, string | string[]>;

  @Prop({ required: true })
  rawHeaders: string;

  @Prop({ required: false })
  mailbox?: string;

  @Prop({ type: [String], required: false })
  receivingChainWarnings?: string[];

  @Prop({
    type: [
      {
        by: { type: String, required: true },
        from: { type: String, required: true },
        with: { type: String, required: false },
        id: { type: String, required: false },
        for: { type: String, required: false },
        timestamp: { type: Date, required: false },
        ip: { type: String, required: false },
        hopDurationMs: { type: Number, required: false },
      },
    ],
    required: true,
  })
  receivingChain: Array<{
    by: string;
    from: string;
    with?: string;
    id?: string;
    for?: string;
    timestamp?: Date;
    ip?: string;
    hopDurationMs?: number;
  }>;

  @Prop({ required: true })
  esp: string;

  @Prop({ required: true })
  espProvider: string;

  @Prop({ required: true })
  espConfidence: number;

  @Prop({ type: [String], required: true })
  espReasons: string[];

  @Prop({
    type: {
      spf: {
        result: { type: String, required: false },
        domain: { type: String, required: false },
      },
      dkim: {
        result: { type: String, required: false },
        d: { type: String, required: false },
      },
      dmarc: {
        result: { type: String, required: false },
        policy: { type: String, required: false },
      },
    },
    required: false,
  })
  authResults?: {
    spf?: { result: string; domain?: string };
    dkim?: { result: string; d?: string };
    dmarc?: { result: string; policy?: string };
  };

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const EmailSchema = SchemaFactory.createForClass(Email);
