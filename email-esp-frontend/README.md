# Email ESP Frontend

Next.js frontend for email delivery testing and ESP analysis.

## Environment Setup

Create a `.env.local` file in the root directory:

```env
# API Configuration
NEXT_PUBLIC_API_BASE=http://localhost:3000

# IMAP User (for display purposes)
NEXT_PUBLIC_IMAP_USER=your-email@gmail.com
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3001`

## Production Deployment (Vercel)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_API_BASE` (your backend URL)
   - `NEXT_PUBLIC_IMAP_USER` (email address for display)

3. Deploy automatically on push to main branch

## Features

- Start email delivery tests
- Real-time status polling
- ESP detection and analysis
- Email journey visualization
- Responsive design with Tailwind CSS