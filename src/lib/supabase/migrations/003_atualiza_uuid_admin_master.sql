-- ============================================================
-- SalvadoShop — Atualiza UUID do admin Master para o usuário real
-- Migração: 003_atualiza_uuid_admin_master.sql
-- Criado em: 2026-06-25
-- Contexto: substitui o user_id fictício do seed 002 pelo UUID
--           real criado no Supabase Auth Dashboard.
-- Email do usuário: admin@salvadoshop.com.br
-- ============================================================

UPDATE admin_usuarios
SET user_id = '41cb5389-0f36-47e8-9578-11a191b61ef6'
WHERE id = 'a1b2c3d4-0000-4000-8000-000000000001'
  AND user_id = 'a1b2c3d4-0000-4000-8000-000000000099';  -- só executa se ainda for o UUID fictício
