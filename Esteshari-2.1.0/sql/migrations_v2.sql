-- ============================================================
--  Esteshari v2.1 Migration
--  © All rights reserved. Nexus Solutions
--  New features: project edit/delete, document types (IR/MIR/QSS),
--  PDF uploads (storage), profile edit, PDF export.
--  Run this file ONCE in Supabase SQL Editor if you already use v2.0.
--  (If this is a brand-new project, just run schema.sql — it already contains v2.1)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Document type  (IR / MIR / QSS / Submittal)
-- ------------------------------------------------------------
alter table public.submissions add column if not exists doc_type text not null default 'Submittal';
alter table public.submissions add column if not exists file_path text default '';
alter table public.submissions add column if not exists file_size bigint default 0;
alter table public.submissions add column if not exists ref_no text default '';
alter table public.submissions add column if not exists requested_by text default '';
alter table public.submissions add column if not exists priority text default 'Normal';

create index if not exists submissions_type_idx on public.submissions(project_id, doc_type);

-- ------------------------------------------------------------
-- 2) Projects: allow admin to DELETE the project
-- ------------------------------------------------------------
drop policy if exists "Admins delete projects" on public.projects;
create policy "Admins delete projects" on public.projects
  for delete to authenticated using (public.is_project_admin(id));

-- ------------------------------------------------------------
-- 3) Submissions: members may delete own documents (admin/contractor)
-- ------------------------------------------------------------
drop policy if exists "Authors delete submissions" on public.submissions;
create policy "Authors delete submissions" on public.submissions
  for delete to authenticated using (
    submitted_by = auth.uid() or public.is_project_admin(project_id));

-- ------------------------------------------------------------
-- 4) Storage bucket for PDF files
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- helper: does the object live under a project the user belongs to?
create or replace function public.can_access_file(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_members m
    where m.user_id = auth.uid()
      and m.project_id::text = (storage.foldername(p_path))[1]
  );
$$;

drop policy if exists "Members read documents files" on storage.objects;
drop policy if exists "Members upload documents files" on storage.objects;
drop policy if exists "Authors delete documents files" on storage.objects;

create policy "Members read documents files" on storage.objects
  for select to authenticated using (bucket_id = 'documents' and public.can_access_file(name));

create policy "Members upload documents files" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents' and public.can_access_file(name));

create policy "Authors delete documents files" on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and public.can_access_file(name));

-- ------------------------------------------------------------
-- 5) Keep profile.full_name in sync when the user renames themselves
-- ------------------------------------------------------------
create or replace function public.sync_profile_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set full_name = coalesce(new.raw_user_meta_data->>'full_name', full_name)
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update on auth.users
  for each row execute procedure public.sync_profile_name();

-- ============================================================
-- Done. Sign out / sign in again after running this migration.
-- ============================================================