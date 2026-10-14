Esteshari Cloud – MEP Document Portal  (v2.1)
© All rights reserved. Nexus Solutions

Cloud backend: Supabase (free tier)
- Auth + PostgreSQL + RLS + private Storage for PDFs
- Same account on every device

Setup: see SETUP-AR.txt (Arabic) or:
  1) Create free project at https://supabase.com
  2) Run sql/schema.sql (new install) or sql/migrations_v2.sql (upgrade from v2.0)
  3) Put URL + anon key in public/config.js
  4) Open public/index.html

v2.1 features:
  1) Auto-update – desktop app notifies / downloads / installs new versions
     (Help > Check for Updates, or My Profile > Check for updates)
  2) My Profile page – edit full name, e-mail, password, account type
  3) Projects – edit and delete (admin only, delete asks for the project code)
  4) Document types IR / MIR / QSS added to Submit Document
  5) PDF upload – technical sheets & drawings, stored in Supabase Storage
  6) PDF export – approval sheet per document + approvals register per project

Disable "Confirm email" in Auth settings for instant login during testing.