-- Applied via Supabase MCP on 2026-04-30
-- Adds nome_traduzido + categoria to produtos_dealspro
-- Creates dealspro_profiles table with auto-create trigger

alter table public.produtos_dealspro
  add column if not exists nome_traduzido text,
  add column if not exists categoria text;

create table if not exists public.dealspro_profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users(id) on delete cascade,
  plan       text not null default 'free' check (plan in ('free', 'premium')),
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.dealspro_profiles enable row level security;

create policy "own profile read"   on public.dealspro_profiles for select using (auth.uid() = user_id);
create policy "own profile update" on public.dealspro_profiles for update using (auth.uid() = user_id);
create policy "service role all"   on public.dealspro_profiles for all using (true);

create or replace function public.handle_dealspro_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.dealspro_profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_dealspro_auth_user_created on auth.users;
create trigger on_dealspro_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_dealspro_new_user();
