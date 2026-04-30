# RentTok Marketplace

NYC-only TikTok rental marketplace for agents and creators.

## Features

- Supabase email/password auth.
- Marketplace for NYC TikTok rental pages.
- Save pages per user account.
- Whop checkout for campaign payments.
- Video upload to Supabase Storage.
- Agent dashboard + creator queue.
- TikTok OAuth connect and creator metrics import (including `@xeinstrentalsnyc`).

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
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
SUPABASE_LISTING_VIDEO_BUCKET=listing-videos
NEXT_PUBLIC_APP_URL=http://localhost:3000

WHOP_API_KEY=
WHOP_COMPANY_ID=
WHOP_WEBHOOK_SECRET=
NEXT_PUBLIC_WHOP_APP_ID=
NEXT_PUBLIC_WHOP_ENVIRONMENT=sandbox

TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=http://localhost:3000/api/tiktok/connect/callback
TIKTOK_LIVE_POSTING=false
```

## Web Analytics

`@vercel/analytics` is already enabled in the app. Keep Web Analytics enabled in your Vercel project settings.

## First TikTok connect (`@xeinstrentalsnyc`)

1. Sign in to the app.
2. In the left sidebar, set handle to `@xeinstrentalsnyc`.
3. Click **Connect TikTok** and approve permissions.
4. Click **Pull Metrics** to import live profile/video stats into the marketplace.
