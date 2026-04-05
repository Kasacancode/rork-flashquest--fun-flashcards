CREATE OR REPLACE FUNCTION public.auto_hide_reported_deck()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_count INTEGER;
  updated_rows INTEGER;
  deck_owner UUID;
  deck_name_text TEXT;
BEGIN
  SELECT COUNT(DISTINCT reporter_id)
  INTO report_count
  FROM public.reports
  WHERE deck_id = NEW.deck_id;

  IF report_count >= 3 THEN
    UPDATE public.public_decks
    SET status = 'hidden',
        updated_at = NOW()
    WHERE id = NEW.deck_id
      AND status = 'active';

    GET DIAGNOSTICS updated_rows = ROW_COUNT;

    IF updated_rows > 0 THEN
      SELECT user_id, name
      INTO deck_owner, deck_name_text
      FROM public.public_decks
      WHERE id = NEW.deck_id
      LIMIT 1;

      IF deck_owner IS NOT NULL AND to_regprocedure('public.send_push_notification(uuid,text,text,jsonb)') IS NOT NULL THEN
        EXECUTE 'SELECT public.send_push_notification($1, $2, $3, $4)'
        USING
          deck_owner,
          'Deck removed from community',
          '"' || COALESCE(deck_name_text, 'Your deck') || '" was hidden after multiple reports. Contact support if you believe this was a mistake.',
          jsonb_build_object('type', 'deck_hidden', 'deck_id', NEW.deck_id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_deck_reported ON public.reports;

CREATE TRIGGER on_deck_reported
AFTER INSERT ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.auto_hide_reported_deck();
