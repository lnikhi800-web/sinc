-- ======================================
-- SINC Database Schema
-- Run this in Supabase SQL Editor
-- ======================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'elite')),
  prompt_count INTEGER DEFAULT 0,
  prompt_limit INTEGER DEFAULT 10,
  razorpay_customer_id TEXT,
  plan_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own profile
CREATE POLICY "profiles_own_read" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role can do everything (for webhook)
CREATE POLICY "profiles_service_all" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Increment prompt count function (atomic)
CREATE OR REPLACE FUNCTION increment_prompt_count(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET prompt_count = prompt_count + 1,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================
-- Projects table
-- ======================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  description TEXT,
  framework TEXT DEFAULT 'react-vite',
  preview_url TEXT,
  status TEXT DEFAULT 'ready' CHECK (status IN ('building', 'ready', 'error')),
  file_tree JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_own_all" ON projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "projects_service_all" ON projects
  FOR ALL USING (auth.role() = 'service_role');

-- ======================================
-- Transactions table (payment history)
-- ======================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_order_id TEXT,
  amount INTEGER,
  currency TEXT DEFAULT 'INR',
  plan TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_own_read" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "transactions_service_all" ON transactions
  FOR ALL USING (auth.role() = 'service_role');

-- ======================================
-- Supabase Storage: sinc-previews bucket
-- Run via Supabase Dashboard → Storage → New Bucket
-- OR via SQL:
-- ======================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sinc-previews',
  'sinc-previews',
  true,
  52428800, -- 50MB limit per upload
  ARRAY['text/html', 'text/css', 'application/javascript', 'application/json', 'image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'font/woff', 'font/woff2', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Public read, authenticated write via service role
CREATE POLICY "sinc_previews_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'sinc-previews');

CREATE POLICY "sinc_previews_service_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'sinc-previews' AND auth.role() = 'service_role');

CREATE POLICY "sinc_previews_service_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'sinc-previews' AND auth.role() = 'service_role');
