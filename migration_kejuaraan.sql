-- Jalankan sekali di Supabase SQL Editor untuk fitur flyer, juknis, dan kategori kejuaraan.
alter table public.championships
  add column if not exists flyer_path text,
  add column if not exists technical_guide_path text,
  add column if not exists competition_config jsonb not null default '{}'::jsonb;

alter table public.registrations
  add column if not exists competition_category text,
  add column if not exists age_group text,
  add column if not exists weight_class text,
  add column if not exists group_code uuid,
  add column if not exists group_size integer not null default 1;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('championship-assets','championship-assets',true,12582912,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=true,file_size_limit=12582912,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "public read championship assets" on storage.objects;
create policy "public read championship assets" on storage.objects for select to anon,authenticated
using(bucket_id='championship-assets');
drop policy if exists "admins upload championship assets" on storage.objects;
create policy "admins upload championship assets" on storage.objects for insert to authenticated
with check(bucket_id='championship-assets' and public.is_admin());
drop policy if exists "admins update championship assets" on storage.objects;
create policy "admins update championship assets" on storage.objects for update to authenticated
using(bucket_id='championship-assets' and public.is_admin()) with check(bucket_id='championship-assets' and public.is_admin());
drop policy if exists "admins delete championship assets" on storage.objects;
create policy "admins delete championship assets" on storage.objects for delete to authenticated
using(bucket_id='championship-assets' and public.is_admin());
