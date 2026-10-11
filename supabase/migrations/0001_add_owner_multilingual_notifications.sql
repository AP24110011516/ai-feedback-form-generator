-- ========================================================
-- FormGenius AI - Migration 0001
-- Adds ownership, multilingual support, follow-up answers,
-- notifications, and secure Row Level Security policies.
-- Run this in the Supabase SQL Editor.
-- ========================================================

-- 1. Add ownership & multilingual columns to feedback_forms
ALTER TABLE public.feedback_forms
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS default_language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_feedback_forms_owner_id
  ON public.feedback_forms (owner_id);

-- 2. Add follow-up answers + respondent language to feedback_responses
ALTER TABLE public.feedback_responses
  ADD COLUMN IF NOT EXISTS follow_up_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS respondent_language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS respondent_name TEXT;

-- 3. Add respondent language to voice_feedback
ALTER TABLE public.voice_feedback
  ADD COLUMN IF NOT EXISTS respondent_language TEXT NOT NULL DEFAULT 'en';

-- 4. Notifications table for real-time alerts
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('new_response', 'serious_issue', 'high_volume')),
    message TEXT NOT NULL,
    form_id UUID REFERENCES public.feedback_forms(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_feedback_form_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    form_owner UUID;
    form_title TEXT;
BEGIN
    SELECT owner_id, title
    INTO form_owner, form_title
    FROM public.feedback_forms
    WHERE id = NEW.form_id;

    IF form_owner IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, message, form_id)
        VALUES (
            form_owner,
            'new_response',
            format('New feedback received for "%s"', form_title),
            NEW.form_id
        );
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_feedback_form_owner() FROM PUBLIC;
DROP TRIGGER IF EXISTS feedback_response_notification ON public.feedback_responses;
CREATE TRIGGER feedback_response_notification
  AFTER INSERT ON public.feedback_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_feedback_form_owner();

-- ========================================================
-- Row Level Security (RLS)
-- ========================================================

-- Re-enable RLS (already enabled, but safe to repeat)
ALTER TABLE public.feedback_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing public policies to replace with secure ones
DROP POLICY IF EXISTS "Allow public read access to feedback_forms" ON public.feedback_forms;
DROP POLICY IF EXISTS "Allow public insert access to feedback_forms" ON public.feedback_forms;
DROP POLICY IF EXISTS "Allow public update access to feedback_forms" ON public.feedback_forms;
DROP POLICY IF EXISTS "Allow public delete access to feedback_forms" ON public.feedback_forms;
DROP POLICY IF EXISTS "Allow public read access to feedback_responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Allow public insert access to feedback_responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Allow public read access to voice_feedback" ON public.voice_feedback;
DROP POLICY IF EXISTS "Allow public insert access to voice_feedback" ON public.voice_feedback;

-- feedback_forms:
--   - Public SELECT (so anyone can load a shared form to submit feedback)
--   - Authenticated users INSERT their own forms (owner_id = auth.uid())
--   - Owners UPDATE/DELETE their own forms
CREATE POLICY "Public can read feedback forms"
  ON public.feedback_forms FOR SELECT USING (true);

CREATE POLICY "Authenticated users create their own forms"
  ON public.feedback_forms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (owner_id IS NULL OR owner_id = auth.uid()));

CREATE POLICY "Owners update their forms"
  ON public.feedback_forms FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners delete their forms"
  ON public.feedback_forms FOR DELETE
  USING (auth.uid() = owner_id);

-- feedback_responses:
--   - Public INSERT (anyone can submit feedback to a form)
--   - Only the form owner can SELECT responses
CREATE POLICY "Public can submit feedback responses"
  ON public.feedback_responses FOR INSERT WITH CHECK (true);

CREATE POLICY "Form owners read their responses"
  ON public.feedback_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.feedback_forms f
      WHERE f.id = feedback_responses.form_id AND f.owner_id = auth.uid()
    )
  );

-- voice_feedback:
--   - Public INSERT
--   - Only form owner can SELECT
CREATE POLICY "Public can submit voice feedback"
  ON public.voice_feedback FOR INSERT WITH CHECK (true);

CREATE POLICY "Form owners read their voice feedback"
  ON public.voice_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.feedback_forms f
      WHERE f.id = voice_feedback.form_id AND f.owner_id = auth.uid()
    )
  );

-- notifications: only the owning user can access
CREATE POLICY "Users read their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ========================================================
-- Backfill owner_id for any existing rows (set to null = public)
-- Existing forms remain publicly viewable but cannot be edited
-- until an owner claims them.
-- ========================================================

NOTIFY pgrst, 'reload schema';
