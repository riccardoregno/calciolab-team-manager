-- Application-owned objects outside public, recovered from the Git history.
-- Auth and Storage relations and the Realtime publication are provided by Supabase.
BEGIN;

DO $platform$
BEGIN
  IF pg_catalog.to_regclass('storage.buckets') IS NULL
    OR pg_catalog.to_regclass('storage.objects') IS NULL
    OR pg_catalog.to_regprocedure('storage.foldername(text)') IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
    RAISE EXCEPTION 'CalcioLab requires initialized Supabase Storage and Realtime'
      USING ERRCODE = '55000';
  END IF;
END;
$platform$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-attachments',
  'team-attachments',
  true,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Team members can upload attachments" on storage.objects;
create policy "Team members can upload attachments"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'team-attachments'
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id::text = (storage.foldername(name))[1]
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists "Team members can update attachments" on storage.objects;
create policy "Team members can update attachments"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'team-attachments'
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id::text = (storage.foldername(name))[1]
        and tm.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'team-attachments'
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id::text = (storage.foldername(name))[1]
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists "Team members can delete attachments" on storage.objects;
create policy "Team members can delete attachments"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'team-attachments'
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id::text = (storage.foldername(name))[1]
        and tm.user_id = auth.uid()
    )
  );

-- Add only the tables registered for Realtime by the historical migrations.
DO $platform$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['staff_messages', 'player_portal_activity']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = relation_name
    ) THEN
      EXECUTE pg_catalog.format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', relation_name);
    END IF;
  END LOOP;
END;
$platform$;

COMMIT;
