# Email ESP Detection Solution

A comprehensive solution for detecting Email Service Providers (ESP) by analyzing email receiving chains and headers.

## Project Structure

This repository contains two main applications:

- **Backend** (`email-esp-backend/`): NestJS application that monitors IMAP emails and performs ESP detection
- **Frontend** (`email-esp-frontend/`): Next.js application providing a user interface for email testing

## Features

- 🔍 **Real-time Email Monitoring**: IMAP integration for live email tracking
- 📧 **ESP Detection**: Advanced analysis of email headers and receiving chains
- 🎯 **Test Email Generation**: Unique test emails with tracking tokens
- 📊 **Receiving Chain Analysis**: Detailed parsing of email routing information
- 🚀 **Modern Tech Stack**: NestJS, Next.js, TypeScript, MongoDB

## Quick Start

### Backend Setup

```bash
cd email-esp-backend
pnpm install
pnpm run start:dev
```

### Frontend Setup

```bash
cd email-esp-frontend
pnpm install
pnpm run dev
```

## Deployment

- **Frontend**: Deploy to Vercel https://lucid-email-esp.vercel.app/
- **Backend**: Deploy to Render https://lucid-email-esp.onrender.com

## Environment Variables

### Backend (.env)
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/email-esp
IMAP_HOST=your_imap_host
IMAP_PORT=993
IMAP_USER=your_email@example.com
IMAP_PASS=your_email_password
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://your-render-app.onrender.com
```

## Database Setup

### Local Development
- The app works without MongoDB locally (uses simulation mode)
- For full functionality, install MongoDB locally or use MongoDB Atlas

### Production Deployment
1. **Create MongoDB Atlas cluster** (free tier available)
2. **Get connection string** from Atlas dashboard
3. **Set MONGODB_URI** in Render environment variables
4. **Set NEXT_PUBLIC_API_URL** in Vercel environment variables

## API Endpoints

- `POST /emails/start-test` - Start a new email test
- `GET /emails/status/:token` - Get test status
- `POST /emails/reset/:token` - Reset a test

## License

MIT
