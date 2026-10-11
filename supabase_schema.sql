-- ========================================================
-- FormGenius AI - Complete Supabase Database Schema
-- Paste this script directly into Supabase SQL Editor and click RUN
-- ========================================================

-- 1. Create feedback_forms Table
CREATE TABLE IF NOT EXISTS public.feedback_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'Active',
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    default_language TEXT NOT NULL DEFAULT 'en',
    translations JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns when upgrading a database created with an earlier schema.
ALTER TABLE public.feedback_forms
    ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS default_language TEXT NOT NULL DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_feedback_forms_owner_id
    ON public.feedback_forms (owner_id);

-- 2. Create feedback_responses Table
CREATE TABLE IF NOT EXISTS public.feedback_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID REFERENCES public.feedback_forms(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    follow_up_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    sentiment TEXT DEFAULT 'Neutral',
    respondent_language TEXT NOT NULL DEFAULT 'en',
    respondent_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feedback_responses
    ADD COLUMN IF NOT EXISTS follow_up_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS respondent_language TEXT NOT NULL DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS respondent_name TEXT;

-- 3. Create voice_feedback Table
CREATE TABLE IF NOT EXISTS public.voice_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID REFERENCES public.feedback_forms(id) ON DELETE CASCADE,
    audio_url TEXT,
    transcript TEXT,
    duration TEXT,
    sentiment TEXT DEFAULT 'Neutral',
    tone TEXT,
    confidence TEXT,
    respondent_language TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.voice_feedback
    ADD COLUMN IF NOT EXISTS respondent_language TEXT NOT NULL DEFAULT 'en';

-- 4. Notifications used by the application header.
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
-- Row Level Security (RLS) & Access Policies
-- ========================================================

-- Enable RLS on all tables
ALTER TABLE public.feedback_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Replace policies from older schema versions.
DROP POLICY IF EXISTS "Allow public read access to feedback_forms" ON public.feedback_forms;
DROP POLICY IF EXISTS "Allow public insert access to feedback_forms" ON public.feedback_forms;
DROP POLICY IF EXISTS "Allow public update access to feedback_forms" ON public.feedback_forms;
DROP POLICY IF EXISTS "Allow public delete access to feedback_forms" ON public.feedback_forms;
DROP POLICY IF EXISTS "Allow public read access to feedback_responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Allow public insert access to feedback_responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Allow public read access to voice_feedback" ON public.voice_feedback;
DROP POLICY IF EXISTS "Allow public insert access to voice_feedback" ON public.voice_feedback;
DROP POLICY IF EXISTS "Public can read feedback forms" ON public.feedback_forms;
DROP POLICY IF EXISTS "Authenticated users create their own forms" ON public.feedback_forms;
DROP POLICY IF EXISTS "Owners update their forms" ON public.feedback_forms;
DROP POLICY IF EXISTS "Owners delete their forms" ON public.feedback_forms;
DROP POLICY IF EXISTS "Public can submit feedback responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Form owners read their responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Public can submit voice feedback" ON public.voice_feedback;
DROP POLICY IF EXISTS "Form owners read their voice feedback" ON public.voice_feedback;
DROP POLICY IF EXISTS "Users read their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users delete their own notifications" ON public.notifications;

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
    ON public.feedback_forms FOR DELETE USING (auth.uid() = owner_id);

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

CREATE POLICY "Users read their own notifications"
    ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update their own notifications"
    ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete their own notifications"
    ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- ========================================================
-- Schema Cache Refresh
-- ========================================================
NOTIFY pgrst, 'reload schema';
