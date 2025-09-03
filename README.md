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

- **Frontend**: Deploy to Vercel
- **Backend**: Deploy to Render

## Environment Variables

### Backend (.env)
```
MONGODB_URI=your_mongodb_connection_string
IMAP_HOST=your_imap_host
IMAP_PORT=993
IMAP_USER=your_email@example.com
IMAP_PASS=your_email_password
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=your_backend_api_url
```

## API Endpoints

- `POST /emails/start-test` - Start a new email test
- `GET /emails/status/:token` - Get test status
- `POST /emails/reset/:token` - Reset a test

## License

MIT
