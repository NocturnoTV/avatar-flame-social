ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.bug_reports(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  is_staff BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_ticket_messages_timeline_idx
  ON public.support_ticket_messages(ticket_id, created_at);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;

DROP POLICY IF EXISTS "ticket participants read messages" ON public.support_ticket_messages;
CREATE POLICY "ticket participants read messages" ON public.support_ticket_messages
FOR SELECT TO authenticated USING (
  public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.bug_reports ticket
    WHERE ticket.id = ticket_id AND ticket.reporter_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "members reply to own tickets" ON public.support_ticket_messages;
CREATE POLICY "members reply to own tickets" ON public.support_ticket_messages
FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND is_staff = false AND EXISTS (
    SELECT 1 FROM public.bug_reports ticket
    WHERE ticket.id = ticket_id AND ticket.reporter_id = auth.uid()
      AND ticket.status NOT IN ('resolved', 'wont_fix')
  )
);

CREATE OR REPLACE FUNCTION public.touch_support_ticket_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.bug_reports
  SET last_activity_at = NEW.created_at,
      status = CASE WHEN NEW.is_staff THEN status ELSE 'pending' END
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_ticket_message_touch ON public.support_ticket_messages;
CREATE TRIGGER support_ticket_message_touch
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_support_ticket_activity();
