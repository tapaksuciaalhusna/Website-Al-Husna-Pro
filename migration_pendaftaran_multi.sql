-- Jalankan SATU KALI di Supabase > SQL Editor (setelah schema.sql dan migration_kejuaraan.sql).
-- Mengizinkan atlet yang sama didaftarkan pada beberapa nomor pertandingan di kejuaraan yang sama
-- (misalnya Tanding dan Seni), tetapi tetap tidak boleh dobel pada nomor yang sama.
alter table public.registrations drop constraint if exists registrations_championship_id_athlete_id_key;
create unique index if not exists registrations_unique_athlete_category
  on public.registrations (championship_id, athlete_id, coalesce(competition_category,''));
