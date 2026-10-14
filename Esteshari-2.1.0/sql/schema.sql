-- Esteshari Cloud – Multi-project schema
-- © All rights reserved. Nexus Solutions
-- Run once in Supabase SQL Editor (no demo data)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('consultant', 'contractor')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Users can read all profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can read all profiles" on public.profiles for select to authenticated using (true);
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  client text default '',
  location text default '',
  description text default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null check (member_role in ('admin', 'consultant', 'contractor')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index if not exists project_members_user_idx on public.project_members(user_id);
alter table public.project_members enable row level security;

create or replace function public.is_project_member(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = p_id and user_id = auth.uid());
$$;

create or replace function public.is_project_admin(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = p_id and user_id = auth.uid() and member_role = 'admin');
$$;

drop policy if exists "Members read projects" on public.projects;
drop policy if exists "Authenticated create projects" on public.projects;
drop policy if exists "Admins update projects" on public.projects;
create policy "Members read projects" on public.projects for select to authenticated using (public.is_project_member(id));
create policy "Authenticated create projects" on public.projects for insert to authenticated with check (created_by = auth.uid());
create policy "Admins update projects" on public.projects for update to authenticated using (public.is_project_admin(id));

drop policy if exists "Members read memberships" on public.project_members;
drop policy if exists "Admins manage memberships" on public.project_members;
drop policy if exists "User add self as member" on public.project_members;
create policy "Members read memberships" on public.project_members for select to authenticated using (public.is_project_member(project_id));
create policy "Admins manage memberships" on public.project_members for all to authenticated using (public.is_project_admin(project_id)) with check (public.is_project_admin(project_id));
create policy "User add self as member" on public.project_members for insert to authenticated with check (user_id = auth.uid());

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_number text not null,
  title text not null,
  revision text not null default 'A',
  discipline text not null,
  category text not null,
  description text default '',
  notes text default '',
  file_name text default '',
  status text not null default 'submitted',
  submitted_by uuid not null references public.profiles(id),
  submitted_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, document_number)
);
create index if not exists submissions_project_idx on public.submissions(project_id);
alter table public.submissions enable row level security;

drop policy if exists "Members read submissions" on public.submissions;
drop policy if exists "Contractors insert submissions" on public.submissions;
drop policy if exists "Members update submissions" on public.submissions;
create policy "Members read submissions" on public.submissions for select to authenticated using (public.is_project_member(project_id));
create policy "Contractors insert submissions" on public.submissions for insert to authenticated with check (submitted_by = auth.uid() and public.is_project_member(project_id));
create policy "Members update submissions" on public.submissions for update to authenticated using (public.is_project_member(project_id));

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  code text not null,
  label text not null,
  comments text default '',
  reasons text default '',
  report_ref text not null,
  reviewed_by uuid not null references public.profiles(id),
  reviewed_by_name text not null,
  created_at timestamptz not null default now()
);
alter table public.decisions enable row level security;
drop policy if exists "Members read decisions" on public.decisions;
drop policy if exists "Consultants insert decisions" on public.decisions;
create policy "Members read decisions" on public.decisions for select to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_id and public.is_project_member(s.project_id)));
create policy "Consultants insert decisions" on public.decisions for insert to authenticated with check (
  exists (select 1 from public.submissions s join public.project_members m on m.project_id = s.project_id
    where s.id = submission_id and m.user_id = auth.uid() and m.member_role in ('admin','consultant')));

create table if not exists public.revision_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  revision text not null,
  status text not null,
  by_user uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.revision_history enable row level security;
drop policy if exists "Members read history" on public.revision_history;
drop policy if exists "Members insert history" on public.revision_history;
create policy "Members read history" on public.revision_history for select to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_id and public.is_project_member(s.project_id)));
create policy "Members insert history" on public.revision_history for insert to authenticated with check (
  exists (select 1 from public.submissions s where s.id = submission_id and public.is_project_member(s.project_id)));

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id);
alter table public.notifications enable row level security;
drop policy if exists "Users read own notifications" on public.notifications;
drop policy if exists "Authenticated insert notifications" on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Authenticated insert notifications" on public.notifications for insert to authenticated with check (true);
create policy "Users update own notifications" on public.notifications for update to authenticated using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name','User'), coalesce(new.raw_user_meta_data->>'role','contractor'))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
--  v2.1 additions — document types, PDF storage, delete rights
--  (safe to re-run; every statement is idempotent)
-- ============================================================

-- 1) Document type (IR / MIR / QSS / Submittal) + attached PDF file
alter table public.submissions add column if not exists doc_type text not null default 'Submittal';
alter table public.submissions add column if not exists file_path text default '';
alter table public.submissions add column if not exists file_size bigint default 0;
alter table public.submissions add column if not exists ref_no text default '';
alter table public.submissions add column if not exists requested_by text default '';
alter table public.submissions add column if not exists priority text default 'Normal';
create index if not exists submissions_type_idx on public.submissions(project_id, doc_type);

-- 2) Project admins may delete projects
drop policy if exists "Admins delete projects" on public.projects;
create policy "Admins delete projects" on public.projects
  for delete to authenticated using (public.is_project_admin(id));

-- 3) Submissions: authors (or project admin) may delete a document
drop policy if exists "Authors delete submissions" on public.submissions;
create policy "Authors delete submissions" on public.submissions
  for delete to authenticated using (
    submitted_by = auth.uid() or public.is_project_admin(project_id));

-- 4) Private storage bucket for uploaded PDFs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

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

-- 5) Keep profile name in sync with the account metadata
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
