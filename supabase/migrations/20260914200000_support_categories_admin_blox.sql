ALTER TABLE public.bug_reports DROP CONSTRAINT IF EXISTS bug_reports_category_check;
UPDATE public.bug_reports SET category = CASE category
  WHEN 'report' THEN 'trust_safety'
  WHEN 'bug' THEN 'technical'
  WHEN 'payment' THEN 'billing'
  WHEN 'roblox' THEN 'account'
  WHEN 'sparks' THEN 'general'
  WHEN 'other' THEN 'general'
  ELSE category
END;
ALTER TABLE public.bug_reports
  ADD CONSTRAINT bug_reports_category_check CHECK (category IN (
    'general', 'trust_safety', 'technical', 'billing', 'copyright',
    'account', 'feedback', 'partnerships', 'legal'
  ));

CREATE OR REPLACE FUNCTION public.assign_ticket_priority()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.severity := CASE
    WHEN NEW.category IN ('legal', 'copyright', 'trust_safety') THEN 'high'
    WHEN NEW.category IN ('billing', 'account', 'technical') THEN 'medium'
    ELSE 'low'
  END;
  IF lower(NEW.title || ' ' || NEW.description) ~ '(immediate danger|menace immédiate|suicide|self-harm|fraud|fraude|minor|mineur)' THEN
    NEW.severity := 'critical';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bug_reports_assign_priority ON public.bug_reports;
CREATE TRIGGER bug_reports_assign_priority BEFORE INSERT ON public.bug_reports
FOR EACH ROW EXECUTE FUNCTION public.assign_ticket_priority();

ALTER TABLE public.blox_transactions DROP CONSTRAINT IF EXISTS blox_transactions_kind_check;
ALTER TABLE public.blox_transactions
  ADD CONSTRAINT blox_transactions_kind_check CHECK (kind IN (
    'purchase', 'gift_sent', 'gift_received', 'quest_reward', 'badge_purchase', 'refund', 'admin_grant'
  ));
