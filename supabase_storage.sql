-- =====================================================
-- Supabase Storage Configuration
-- =====================================================

-- 1. Create a public bucket called 'images'
-- Note: You normally do this via the Dashboard, but can do it via SQL if the extension is enabled.
-- If insert into storage.buckets fails, please create the 'images' bucket manually in the dashboard: Storage > New Bucket > Public.

insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- 2. Enable RLS (Row Level Security)
-- Policies for the 'images' bucket

-- Public Read Access
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'images' );

-- Authenticated Insert (Upload)
create policy "Authenticated Upload"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'images' );

-- Authenticated Update
create policy "Authenticated Update"
on storage.objects for update
to authenticated
using ( bucket_id = 'images' );

-- Authenticated Delete
create policy "Authenticated Delete"
on storage.objects for delete
to authenticated
using ( bucket_id = 'images' );
