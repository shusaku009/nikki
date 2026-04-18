-- ============================================
-- こころ日記 - Supabase Schema
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================

-- recordsテーブル作成
CREATE TABLE IF NOT EXISTS records (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event      TEXT,
  emotion    TEXT,
  body_state TEXT,
  mood       INT CHECK (mood BETWEEN 1 AND 10) NOT NULL DEFAULT 5,
  tags       JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- インデックス（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS records_user_id_idx ON records(user_id);
CREATE INDEX IF NOT EXISTS records_created_at_idx ON records(created_at DESC);

-- Row Level Security 有効化
ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- 自分のデータのみ全操作可能
CREATE POLICY "自分のデータのみ参照" ON records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "自分のデータのみ挿入" ON records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "自分のデータのみ削除" ON records
  FOR DELETE USING (auth.uid() = user_id);
