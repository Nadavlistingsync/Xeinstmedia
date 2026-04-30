create extension if not exists "pgcrypto";

create table if not exists public.tiktok_pages (
  id text primary key,
  handle text not null unique,
  display_name text not null,
  avatar_label text,
  market text not null default 'New York, NY',
  niche text not null default 'Rental Listings',
  followers bigint not null default 0,
  avg_views bigint not null default 0,
  engagement_rate numeric(7,2) not null default 0,
  avg_likes bigint not null default 0,
  avg_comments bigint not null default 0,
  price numeric(10,2) not null default 0,
  delivery_days int not null default 3,
  audience text not null default '',
  verified boolean not null default false,
  top_performer boolean not null default false,
  saved boolean not null default false,
  tags text[] not null default '{}',
  content_notes text[] not null default '{}',
  weekly_views bigint[] not null default '{}',
  whop_plan_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  page_id text not null references public.tiktok_pages(id) on delete cascade,
  agent_user_id uuid not null references auth.users(id) on delete cascade,
  agent_email text,
  creator_handle text not null,
  creator_name text not null,
  status text not null check (status in ('Video Upload', 'Creator Approval', 'Posted', 'Completed')),
  payment_status text not null check (payment_status in ('Pending', 'Paid', 'Released')),
  paid_amount numeric(10,2) not null default 0,
  video_name text,
  video_storage_path text,
  video_duration text,
  posted_on text,
  views bigint,
  likes bigint,
  comments bigint,
  engagement_rate numeric(7,2),
  receipt_id text,
  tiktok_post_id text,
  publish_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_saved_pages (
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id text not null references public.tiktok_pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, page_id)
);

create table if not exists public.creator_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  open_id text,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz,
  refresh_expires_at timestamptz,
  scopes text[] not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, handle)
);

create index if not exists tiktok_pages_market_idx on public.tiktok_pages (market);
create index if not exists tiktok_pages_engagement_idx on public.tiktok_pages (engagement_rate desc);
create index if not exists campaigns_agent_user_idx on public.campaigns (agent_user_id, created_at desc);
create index if not exists campaigns_receipt_idx on public.campaigns (receipt_id);
create index if not exists campaigns_page_idx on public.campaigns (page_id);
create index if not exists creator_tokens_user_idx on public.creator_tokens (user_id);
create index if not exists creator_tokens_open_id_idx on public.creator_tokens (open_id);

alter table public.tiktok_pages enable row level security;
alter table public.campaigns enable row level security;
alter table public.agent_saved_pages enable row level security;
alter table public.creator_tokens enable row level security;

drop policy if exists "Authenticated users can read pages" on public.tiktok_pages;
create policy "Authenticated users can read pages"
  on public.tiktok_pages
  for select
  to authenticated
  using (true);

drop policy if exists "Campaigns owner full access" on public.campaigns;
create policy "Campaigns owner full access"
  on public.campaigns
  for all
  to authenticated
  using (auth.uid() = agent_user_id)
  with check (auth.uid() = agent_user_id);

drop policy if exists "Saved pages owner full access" on public.agent_saved_pages;
create policy "Saved pages owner full access"
  on public.agent_saved_pages
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Creator tokens owner full access" on public.creator_tokens;
create policy "Creator tokens owner full access"
  on public.creator_tokens
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('listing-videos', 'listing-videos', false)
on conflict (id) do nothing;

drop policy if exists "Users upload their own listing videos" on storage.objects;
create policy "Users upload their own listing videos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'listing-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users read their own listing videos" on storage.objects;
create policy "Users read their own listing videos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'listing-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users delete their own listing videos" on storage.objects;
create policy "Users delete their own listing videos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'listing-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
