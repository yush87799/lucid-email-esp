# Email ESP Backend

NestJS backend for email delivery testing and ESP analysis.

## Environment Setup

Create a `.env` file in the root directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/email-esp

# IMAP Configuration
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password

# CORS
ALLOWED_ORIGIN=http://localhost:3001

# Server
PORT=3000
```

## Local Development

1. Install dependencies:
```bash
pnpm install
```

2. Start development server:
```bash
pnpm start:dev
```

The API will be available at `http://localhost:3000`

## Production Deployment (Render)

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set environment variables in Render dashboard:
   - `MONGODB_URI` (use MongoDB Atlas)
   - `IMAP_HOST`, `IMAP_PORT`, `IMAP_SECURE`, `IMAP_USER`, `IMAP_PASS`
   - `ALLOWED_ORIGIN` (your frontend URL)
   - `PORT` (Render will set this automatically)

4. Build command: `pnpm build`
5. Start command: `pnpm start:prod`

## API Endpoints

- `POST /tests/start` - Start a new email test
- `GET /tests/:token/status` - Get test status and results
- `GET /` - Health check