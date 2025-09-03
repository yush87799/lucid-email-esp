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

  @Prop({
    type: [{
      by: { type: String, required: true },
      from: { type: String, required: true },
      with: { type: String, required: false },
      id: { type: String, required: false },
      for: { type: String, required: false },
      timestamp: { type: Date, required: false },
      ip: { type: String, required: false }
    }],
    required: true
  })
  receivingChain: Array<{
    by: string;
    from: string;
    with?: string;
    id?: string;
    for?: string;
    timestamp?: Date;
    ip?: string;
  }>;

  @Prop({ required: true })
  esp: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const EmailSchema = SchemaFactory.createForClass(Email);
