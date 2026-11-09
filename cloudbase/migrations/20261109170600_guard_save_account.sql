-- Verify the account again inside the transaction, including cross-tab sign-out races.
CREATE FUNCTION public.archer_save_for_account(expected_owner text, expected_revision bigint, new_progress jsonb, request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF expected_owner IS NULL OR expected_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Account changed; sign in again' USING ERRCODE = '42501';
  END IF;
  RETURN public.archer_save(expected_revision, new_progress, request_id);
END;
$$;
REVOKE ALL ON FUNCTION public.archer_save_for_account(text,bigint,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archer_save_for_account(text,bigint,jsonb,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.archer_save(bigint,jsonb,text) FROM authenticated;
