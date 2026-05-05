-- ==========================================
-- Migration: 030_companion_conversations
-- Goal: Persist Life Companion conversations without prompts, secrets,
-- provider raw output, reflection answers, or journal text.
-- ==========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.companion_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  last_message_preview TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companion_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.companion_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  mode TEXT,
  suggested_action_json JSONB,
  tone TEXT,
  risk_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companion_conversations_user_updated_at
  ON public.companion_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_companion_messages_conversation_created_at
  ON public.companion_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_companion_messages_user_conversation
  ON public.companion_messages(user_id, conversation_id);

ALTER TABLE public.companion_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companion_conversations'
      AND policyname = 'companion_conversations_select_own'
  ) THEN
    CREATE POLICY "companion_conversations_select_own"
      ON public.companion_conversations
      FOR SELECT
      TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companion_conversations'
      AND policyname = 'companion_conversations_insert_own'
  ) THEN
    CREATE POLICY "companion_conversations_insert_own"
      ON public.companion_conversations
      FOR INSERT
      TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companion_conversations'
      AND policyname = 'companion_conversations_update_own'
  ) THEN
    CREATE POLICY "companion_conversations_update_own"
      ON public.companion_conversations
      FOR UPDATE
      TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companion_conversations'
      AND policyname = 'companion_conversations_delete_own'
  ) THEN
    CREATE POLICY "companion_conversations_delete_own"
      ON public.companion_conversations
      FOR DELETE
      TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companion_messages'
      AND policyname = 'companion_messages_select_own'
  ) THEN
    CREATE POLICY "companion_messages_select_own"
      ON public.companion_messages
      FOR SELECT
      TO authenticated
      USING (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
          SELECT 1
          FROM public.companion_conversations conversation
          WHERE conversation.id = companion_messages.conversation_id
            AND conversation.user_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companion_messages'
      AND policyname = 'companion_messages_insert_own'
  ) THEN
    CREATE POLICY "companion_messages_insert_own"
      ON public.companion_messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
          SELECT 1
          FROM public.companion_conversations conversation
          WHERE conversation.id = companion_messages.conversation_id
            AND conversation.user_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companion_messages'
      AND policyname = 'companion_messages_delete_own'
  ) THEN
    CREATE POLICY "companion_messages_delete_own"
      ON public.companion_messages
      FOR DELETE
      TO authenticated
      USING (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
          SELECT 1
          FROM public.companion_conversations conversation
          WHERE conversation.id = companion_messages.conversation_id
            AND conversation.user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;
