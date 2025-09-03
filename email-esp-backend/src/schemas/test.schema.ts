import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TestSessionDocument = TestSession & Document;

@Schema({ timestamps: true })
export class TestSession {
  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ 
    required: true, 
    enum: ['waiting', 'received', 'parsed', 'error'],
    default: 'waiting'
  })
  status: 'waiting' | 'received' | 'parsed' | 'error';

  @Prop({ type: Types.ObjectId, ref: 'Email' })
  emailRef: Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const TestSessionSchema = SchemaFactory.createForClass(TestSession);
