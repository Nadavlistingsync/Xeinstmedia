# RentTok Marketplace

NYC-only TikTok rental marketplace for agents and creators.

## Features

- Supabase email/password auth.
- NYC creator listings that agents can book.
- Save pages per user account.
- No in-app payments for now. Agents send campaigns directly; Whop can be added later.
- Video upload to Supabase Storage.
- Agent dashboard + creator queue.
- Manual creator workflow: agents upload the video, creators download it and post manually.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Required setup

1. Copy `.env.example` to `.env.local`.
2. Fill all required variables.
3. Run the SQL schema at [`/Users/nbmacmin/Documents/Listing Pro/Xeinst Rental /supabase/schema.sql`](/Users/nbmacmin/Documents/Listing%20Pro/Xeinst%20Rental%20/supabase/schema.sql) in Supabase SQL editor.

## Environment variables

```bash
# Preferred app-managed Supabase vars
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Compatible Vercel/Supabase integration vars (optional alternative)
# STORAGE_SUPABASE_URL=
# STORAGE_SUPABASE_SERVICE_ROLE_KEY=
# STORAGE_SUPABASE_SECRET_KEY=
# NEXT_PUBLIC_STORAGE_SUPABASE_ANON_KEY=
# NEXT_PUBLIC_STORAGE_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_LISTING_VIDEO_BUCKET=listing-videos
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional later: Whop payments
WHOP_API_KEY=
WHOP_COMPANY_ID=
WHOP_WEBHOOK_SECRET=
NEXT_PUBLIC_WHOP_APP_ID=
NEXT_PUBLIC_WHOP_ENVIRONMENT=sandbox

# Optional future TikTok API setup
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=http://localhost:3000/api/tiktok/connect/callback
TIKTOK_LIVE_POSTING=false
```

## Web Analytics

`@vercel/analytics` is already enabled in the app. Keep Web Analytics enabled in your Vercel project settings.

## Manual creator setup (`@xeinstrentalsnyc`)

1. Sign in to the app.
2. Choose **Creator** when creating the account.
3. In the left sidebar, list handle `@xeinstrentalsnyc`.
4. Set any reported stats you want agents to see.
5. When an agent books a campaign, download the uploaded video from the creator queue and post it manually.
