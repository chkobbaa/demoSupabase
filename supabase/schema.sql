-- ============================================
-- HabitFlow Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- Habits table
CREATE TABLE habits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '✅',
  color TEXT DEFAULT '#6C63FF',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habit completion logs
CREATE TABLE habit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  completed_at DATE DEFAULT CURRENT_DATE NOT NULL,
  UNIQUE(habit_id, completed_at)
);

-- Row Level Security: users can only access their own data
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own habits"
  ON habits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own logs"
  ON habit_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
