-- 012_triagem_storage_bucket.sql
-- Bucket privado para as fotos capturadas na triagem.
-- As fotos servem apenas como insumo para a extracao de dados pela IA;
-- nao sao imagens de catalogo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'triagem',
  'triagem',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic']
);

create policy "autenticados leem fotos triagem"
  on storage.objects for select to authenticated
  using (bucket_id = 'triagem');

create policy "autenticados enviam fotos triagem"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'triagem');

create policy "autenticados atualizam fotos triagem"
  on storage.objects for update to authenticated
  using (bucket_id = 'triagem');

create policy "autenticados apagam fotos triagem"
  on storage.objects for delete to authenticated
  using (bucket_id = 'triagem');
