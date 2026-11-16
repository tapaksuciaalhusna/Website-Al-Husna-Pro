-- AL HUSNA PRO · Supabase schema
-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'kontingen' check (role in ('kontingen','admin','super_admin')),
  kontingen_name text not null default '', manager_name text not null default '',
  phone text, city text, province text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, role, kontingen_name, manager_name, phone)
  values(new.id,'kontingen',coalesce(new.raw_user_meta_data->>'kontingen_name',''),coalesce(new.raw_user_meta_data->>'manager_name',''),nullif(new.raw_user_meta_data->>'phone',''))
  on conflict(id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','super_admin'));
$$;
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='super_admin');
$$;

create table if not exists public.championships (
  id uuid primary key default gen_random_uuid(), name text not null,
  description text, start_date date not null, end_date date,
  registration_deadline date, location text,
  status text not null default 'upcoming' check(status in ('upcoming','open','closed')),
  created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(), kontingen_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null, birth_date date not null,
  gender text not null check(gender in ('Putra','Putri')),
  weight_kg numeric(5,2) not null check(weight_kg between 10 and 150),
  category text not null check(category in ('Tanding','Tunggal','Ganda','Regu')),
  coach_name text, phone text, photo_path text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  kontingen_id uuid not null references public.profiles(id) on delete cascade,
  championship_id uuid not null references public.championships(id) on delete restrict,
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  status text not null default 'pending' check(status in ('pending','verified','rejected')),
  payment_path text, admin_note text,
  created_at timestamptz not null default now(),
  unique(championship_id,athlete_id)
);

-- Kontingen tidak boleh mengubah status verifikasi pembayaran/pendaftaran sendiri.
create or replace function public.protect_registration_status() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and not public.is_admin() then
    raise exception 'Only administrator may change registration status';
  end if;
  return new;
end; $$;
drop trigger if exists protect_registration_status_trigger on public.registrations;
create trigger protect_registration_status_trigger before update on public.registrations for each row execute function public.protect_registration_status();

create table if not exists public.registration_documents (
  id uuid primary key default gen_random_uuid(), registration_id uuid not null references public.registrations(id) on delete cascade,
  file_path text not null, file_name text not null, document_type text not null default 'other',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.championships enable row level security;
alter table public.athletes enable row level security;
alter table public.registrations enable row level security;
alter table public.registration_documents enable row level security;

drop policy if exists "profiles read own or admins" on public.profiles;
create policy "profiles read own or admins" on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
drop policy if exists "profiles update own or admins" on public.profiles;
create policy "profiles update own or admins" on public.profiles for update to authenticated using(id=auth.uid() or public.is_super_admin()) with check(id=auth.uid() or public.is_super_admin());
-- Role is immutable for normal users: trigger below prevents privilege escalation.
create or replace function public.protect_profile_role() returns trigger language plpgsql as $$
begin if new.role is distinct from old.role and not public.is_super_admin() and coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' and current_user not in ('postgres','supabase_admin') then raise exception 'Only super administrator may change roles'; end if; return new; end; $$;
drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger before update on public.profiles for each row execute function public.protect_profile_role();

drop policy if exists "public read championships" on public.championships;
create policy "public read championships" on public.championships for select to anon,authenticated using(true);
drop policy if exists "admins manage championships" on public.championships;
create policy "admins manage championships" on public.championships for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "athletes owner or admin read" on public.athletes;
create policy "athletes owner or admin read" on public.athletes for select to authenticated using(kontingen_id=auth.uid() or public.is_admin());
drop policy if exists "athletes owner insert" on public.athletes;
create policy "athletes owner insert" on public.athletes for insert to authenticated with check(kontingen_id=auth.uid());
drop policy if exists "athletes owner update" on public.athletes;
create policy "athletes owner update" on public.athletes for update to authenticated using(kontingen_id=auth.uid() or public.is_admin()) with check(kontingen_id=auth.uid() or public.is_admin());
drop policy if exists "athletes owner delete" on public.athletes;
create policy "athletes owner delete" on public.athletes for delete to authenticated using(kontingen_id=auth.uid() or public.is_admin());

drop policy if exists "registrations owner or admin read" on public.registrations;
create policy "registrations owner or admin read" on public.registrations for select to authenticated using(kontingen_id=auth.uid() or public.is_admin());
drop policy if exists "registrations owner insert" on public.registrations;
create policy "registrations owner insert" on public.registrations for insert to authenticated with check(kontingen_id=auth.uid() and exists(select 1 from public.athletes a where a.id=athlete_id and a.kontingen_id=auth.uid()) and exists(select 1 from public.championships c where c.id=championship_id and c.status='open'));
drop policy if exists "registrations owner or admin update" on public.registrations;
create policy "registrations owner or admin update" on public.registrations for update to authenticated using(kontingen_id=auth.uid() or public.is_admin()) with check(public.is_admin() or (kontingen_id=auth.uid() and exists(select 1 from public.athletes a where a.id=athlete_id and a.kontingen_id=auth.uid())));
drop policy if exists "registrations owner or admin delete" on public.registrations;
create policy "registrations owner or admin delete" on public.registrations for delete to authenticated using(kontingen_id=auth.uid() or public.is_admin());

drop policy if exists "documents owner or admin access" on public.registration_documents;
create policy "documents owner or admin access" on public.registration_documents for all to authenticated
using(exists(select 1 from public.registrations r where r.id=registration_id and (r.kontingen_id=auth.uid() or public.is_admin())))
with check(exists(select 1 from public.registrations r where r.id=registration_id and (r.kontingen_id=auth.uid() or public.is_admin())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('private-files','private-files',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "private files own folder" on storage.objects;
create policy "private files own folder" on storage.objects for all to authenticated
using(bucket_id='private-files' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='private-files' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "admins read private files" on storage.objects;
create policy "admins read private files" on storage.objects for select to authenticated using(bucket_id='private-files' and public.is_admin());

-- Setelah akun pemilik dibuat melalui halaman Daftar, jalankan satu kali:
-- update public.profiles set role='super_admin' where id=(select id from auth.users where email='EMAIL_PEMILIK_ANDA');
