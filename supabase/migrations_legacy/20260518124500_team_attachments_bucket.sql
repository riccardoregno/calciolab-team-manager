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
