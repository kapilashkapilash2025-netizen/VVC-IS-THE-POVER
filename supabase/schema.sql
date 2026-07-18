-- VVC shared realtime backend. Run once in the Supabase SQL editor.
create table if not exists public.vvc_content (
  content_type text not null check (content_type in ('updates','gallery','notices','achievements')),
  record_id text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (content_type, record_id)
);

create table if not exists public.vvc_reactions (
  post_id text not null,
  browser_id text not null,
  reaction text not null check (reaction in ('like','congratulations','proud','excellent','champion')),
  updated_at timestamptz not null default now(),
  primary key (post_id, browser_id)
);

create table if not exists public.vvc_messages (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  display_name text not null check (char_length(display_name) between 2 and 60),
  message text not null check (char_length(message) between 3 and 180),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

alter table public.vvc_content enable row level security;
alter table public.vvc_reactions enable row level security;
alter table public.vvc_messages enable row level security;

drop policy if exists "Public reads VVC content" on public.vvc_content;
create policy "Public reads VVC content" on public.vvc_content for select using (true);
drop policy if exists "VVC admin writes content" on public.vvc_content;
create policy "VVC admin writes content" on public.vvc_content for all to authenticated
  using ((auth.jwt() ->> 'email') = 'kapilashkapilash2025@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'kapilashkapilash2025@gmail.com');

drop policy if exists "Public reads reactions" on public.vvc_reactions;
create policy "Public reads reactions" on public.vvc_reactions for select using (true);
drop policy if exists "Visitors add reactions" on public.vvc_reactions;
create policy "Visitors add reactions" on public.vvc_reactions for insert to anon, authenticated with check (true);
drop policy if exists "Visitors change reactions" on public.vvc_reactions;
create policy "Visitors change reactions" on public.vvc_reactions for update to anon, authenticated using (true) with check (true);
drop policy if exists "Visitors remove reactions" on public.vvc_reactions;
create policy "Visitors remove reactions" on public.vvc_reactions for delete to anon, authenticated using (true);

drop policy if exists "Public reads approved messages" on public.vvc_messages;
create policy "Public reads approved messages" on public.vvc_messages for select
  using (status = 'approved' or (auth.jwt() ->> 'email') = 'kapilashkapilash2025@gmail.com');
drop policy if exists "Visitors submit pending messages" on public.vvc_messages;
create policy "Visitors submit pending messages" on public.vvc_messages for insert to anon, authenticated
  with check (status = 'pending');
drop policy if exists "VVC admin moderates messages" on public.vvc_messages;
create policy "VVC admin moderates messages" on public.vvc_messages for update to authenticated
  using ((auth.jwt() ->> 'email') = 'kapilashkapilash2025@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'kapilashkapilash2025@gmail.com');
drop policy if exists "VVC admin deletes messages" on public.vvc_messages;
create policy "VVC admin deletes messages" on public.vvc_messages for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'kapilashkapilash2025@gmail.com');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vvc-media','vvc-media',true,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=true, file_size_limit=10485760,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists "Public reads VVC media" on storage.objects;
create policy "Public reads VVC media" on storage.objects for select using (bucket_id = 'vvc-media');
drop policy if exists "VVC admin uploads media" on storage.objects;
create policy "VVC admin uploads media" on storage.objects for insert to authenticated
  with check (bucket_id = 'vvc-media' and (auth.jwt() ->> 'email') = 'kapilashkapilash2025@gmail.com');
drop policy if exists "VVC admin updates media" on storage.objects;
create policy "VVC admin updates media" on storage.objects for update to authenticated
  using (bucket_id = 'vvc-media' and (auth.jwt() ->> 'email') = 'kapilashkapilash2025@gmail.com');
drop policy if exists "VVC admin deletes media" on storage.objects;
create policy "VVC admin deletes media" on storage.objects for delete to authenticated
  using (bucket_id = 'vvc-media' and (auth.jwt() ->> 'email') = 'kapilashkapilash2025@gmail.com');

do $$ begin
  alter publication supabase_realtime add table public.vvc_content;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.vvc_reactions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.vvc_messages;
exception when duplicate_object then null; end $$;

create index if not exists vvc_content_updated_idx on public.vvc_content(content_type, updated_at desc);
create index if not exists vvc_messages_post_idx on public.vvc_messages(post_id, status, created_at);
create index if not exists vvc_reactions_post_idx on public.vvc_reactions(post_id);
