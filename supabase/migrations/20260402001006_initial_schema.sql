create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default 'Usuario interno',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_profile_upsert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, created_at, updated_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(initcap(replace(split_part(new.email, '@', 1), '.', ' ')), 'Usuario interno'),
    now(),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_profile_upsert();

insert into public.profiles (id, email, display_name, created_at, updated_at)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(initcap(replace(split_part(users.email, '@', 1), '.', ' ')), 'Usuario interno'),
  now(),
  now()
from auth.users as users
on conflict (id) do update
  set email = excluded.email,
      display_name = excluded.display_name,
      updated_at = now();

create table if not exists public.app_state (
  scope text primary key,
  incidents jsonb not null default '[]'::jsonb,
  requests jsonb not null default '[]'::jsonb,
  inventory_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_email text not null default ''
);

insert into public.app_state (scope)
values ('primary')
on conflict (scope) do nothing;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  summary text not null,
  payload jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_email text not null default '',
  changed_at timestamptz not null default now()
);

create index if not exists audit_log_changed_at_idx on public.audit_log (changed_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (module, entity_type, entity_id);

create table if not exists public.invoice_settings (
  scope text primary key,
  storage_folder text not null default 'facturas',
  crop_x integer not null default 58,
  crop_y integer not null default 7,
  crop_width integer not null default 30,
  crop_height integer not null default 12,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_email text not null default ''
);

insert into public.invoice_settings (scope)
values ('primary')
on conflict (scope) do nothing;

create table if not exists public.invoice_entries (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  invoice_number text,
  person_name text not null,
  hours_amount numeric(12, 2) not null default 0,
  status text not null default 'pendiente' check (status in ('pendiente', 'listo')),
  comment text not null default '',
  photo_path text,
  photo_file_name text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_email text not null default '',
  constraint invoice_entries_ready_requires_number
    check (status <> 'listo' or coalesce(invoice_number, '') <> '')
);

create index if not exists invoice_entries_service_date_idx on public.invoice_entries (service_date desc);
create index if not exists invoice_entries_status_idx on public.invoice_entries (status);
create index if not exists invoice_entries_invoice_number_idx on public.invoice_entries (invoice_number);

alter table public.profiles enable row level security;
alter table public.app_state enable row level security;
alter table public.audit_log enable row level security;
alter table public.invoice_settings enable row level security;
alter table public.invoice_entries enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_upsert_self" on public.profiles;
create policy "profiles_upsert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "app_state_select_authenticated" on public.app_state;
create policy "app_state_select_authenticated"
on public.app_state
for select
to authenticated
using (true);

drop policy if exists "app_state_insert_authenticated" on public.app_state;
create policy "app_state_insert_authenticated"
on public.app_state
for insert
to authenticated
with check (true);

drop policy if exists "app_state_update_authenticated" on public.app_state;
create policy "app_state_update_authenticated"
on public.app_state
for update
to authenticated
using (true)
with check (true);

drop policy if exists "audit_log_select_authenticated" on public.audit_log;
create policy "audit_log_select_authenticated"
on public.audit_log
for select
to authenticated
using (true);

drop policy if exists "audit_log_insert_authenticated" on public.audit_log;
create policy "audit_log_insert_authenticated"
on public.audit_log
for insert
to authenticated
with check (true);

drop policy if exists "invoice_settings_select_authenticated" on public.invoice_settings;
create policy "invoice_settings_select_authenticated"
on public.invoice_settings
for select
to authenticated
using (true);

drop policy if exists "invoice_settings_insert_authenticated" on public.invoice_settings;
create policy "invoice_settings_insert_authenticated"
on public.invoice_settings
for insert
to authenticated
with check (true);

drop policy if exists "invoice_settings_update_authenticated" on public.invoice_settings;
create policy "invoice_settings_update_authenticated"
on public.invoice_settings
for update
to authenticated
using (true)
with check (true);

drop policy if exists "invoice_entries_select_authenticated" on public.invoice_entries;
create policy "invoice_entries_select_authenticated"
on public.invoice_entries
for select
to authenticated
using (true);

drop policy if exists "invoice_entries_insert_authenticated" on public.invoice_entries;
create policy "invoice_entries_insert_authenticated"
on public.invoice_entries
for insert
to authenticated
with check (true);

drop policy if exists "invoice_entries_update_authenticated" on public.invoice_entries;
create policy "invoice_entries_update_authenticated"
on public.invoice_entries
for update
to authenticated
using (true)
with check (true);

drop policy if exists "invoice_entries_delete_authenticated" on public.invoice_entries;
create policy "invoice_entries_delete_authenticated"
on public.invoice_entries
for delete
to authenticated
using (true);

insert into storage.buckets (id, name, public)
values ('invoice-photos', 'invoice-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('frontend', 'frontend', true)
on conflict (id) do nothing;

drop policy if exists "invoice_photos_select_authenticated" on storage.objects;
create policy "invoice_photos_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'invoice-photos');

drop policy if exists "invoice_photos_insert_authenticated" on storage.objects;
create policy "invoice_photos_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'invoice-photos');

drop policy if exists "invoice_photos_update_authenticated" on storage.objects;
create policy "invoice_photos_update_authenticated"
on storage.objects
for update
to authenticated
using (bucket_id = 'invoice-photos')
with check (bucket_id = 'invoice-photos');

drop policy if exists "invoice_photos_delete_authenticated" on storage.objects;
create policy "invoice_photos_delete_authenticated"
on storage.objects
for delete
to authenticated
using (bucket_id = 'invoice-photos');

drop policy if exists "frontend_bucket_select_public" on storage.objects;
create policy "frontend_bucket_select_public"
on storage.objects
for select
to public
using (bucket_id = 'frontend');

drop policy if exists "frontend_bucket_insert_authenticated" on storage.objects;
create policy "frontend_bucket_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'frontend');

drop policy if exists "frontend_bucket_update_authenticated" on storage.objects;
create policy "frontend_bucket_update_authenticated"
on storage.objects
for update
to authenticated
using (bucket_id = 'frontend')
with check (bucket_id = 'frontend');

drop policy if exists "frontend_bucket_delete_authenticated" on storage.objects;
create policy "frontend_bucket_delete_authenticated"
on storage.objects
for delete
to authenticated
using (bucket_id = 'frontend');
