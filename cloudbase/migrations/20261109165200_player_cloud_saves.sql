-- Personal progress only. Live runs and competitive results are not uploaded.
-- Rollback (only after exporting saves): DROP FUNCTION public.archer_save(bigint,jsonb,text);
-- DROP TABLE public.archer_saves;
CREATE TABLE public.archer_saves (
  owner_id text PRIMARY KEY DEFAULT auth.uid(),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  progress jsonb NOT NULL CHECK (jsonb_typeof(progress) = 'object' AND octet_length(progress::text) <= 8192),
  last_request_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.archer_saves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archer_saves FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.archer_saves TO authenticated;
GRANT ALL ON public.archer_saves TO service_role;
CREATE POLICY archer_read_own ON public.archer_saves FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND NOT coalesce((auth.jwt()->>'is_anonymous')::boolean, false));

-- A single compare-and-swap protects the whole wallet/training snapshot.
-- Callers cannot choose an owner, bypass revisions, or retry a debit twice.
CREATE FUNCTION public.archer_save(expected_revision bigint, new_progress jsonb, request_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  uid text := auth.uid();
  saved public.archer_saves;
  field text;
  bounds integer[];
BEGIN
  IF uid IS NULL OR auth.role() <> 'authenticated'
     OR coalesce((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Login required' USING ERRCODE = '42501';
  END IF;
  IF expected_revision IS NULL OR expected_revision < 0
     OR request_id IS NULL OR length(request_id) NOT BETWEEN 16 AND 100
     OR new_progress IS NULL OR jsonb_typeof(new_progress) <> 'object'
     OR octet_length(new_progress::text) > 8192
     OR new_progress - ARRAY['version','targetBest','unlocked','checkpoint','best','embers','bow','life','names'] <> '{}'::jsonb
     OR new_progress->'version' IS DISTINCT FROM '2'::jsonb
     OR jsonb_typeof(new_progress->'unlocked') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'Invalid progress' USING ERRCODE = '22023';
  END IF;
  FOREACH field IN ARRAY ARRAY['targetBest','checkpoint','best','embers','bow','life'] LOOP
    bounds := CASE field WHEN 'checkpoint' THEN ARRAY[1,3] WHEN 'best' THEN ARRAY[0,9999]
      WHEN 'embers' THEN ARRAY[0,99999] WHEN 'bow' THEN ARRAY[0,5] WHEN 'life' THEN ARRAY[0,5]
      ELSE ARRAY[0,999999] END;
    IF jsonb_typeof(new_progress->field) IS DISTINCT FROM 'number'
       OR (new_progress->>field) !~ '^[0-9]+$'
       OR (new_progress->>field)::numeric NOT BETWEEN bounds[1] AND bounds[2] THEN
      RAISE EXCEPTION 'Invalid progress field' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF new_progress ? 'names' THEN
    IF jsonb_typeof(new_progress->'names') <> 'array' OR jsonb_array_length(new_progress->'names') <> 2 THEN
      RAISE EXCEPTION 'Invalid names' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(new_progress->'names') n
      WHERE jsonb_typeof(n) <> 'string' OR length(n #>> '{}') NOT BETWEEN 1 AND 8) THEN
      RAISE EXCEPTION 'Invalid names' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF expected_revision = 0 THEN
    INSERT INTO public.archer_saves(owner_id, progress, last_request_id)
      VALUES(uid, new_progress, request_id) ON CONFLICT DO NOTHING RETURNING * INTO saved;
    IF FOUND THEN
      RETURN jsonb_build_object('status','saved','revision',saved.revision,'progress',saved.progress,'updated_at',saved.updated_at);
    END IF;
  END IF;
  SELECT * INTO saved FROM public.archer_saves WHERE owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','conflict','revision',0,'progress',NULL);
  END IF;
  IF saved.last_request_id = request_id THEN
    RETURN jsonb_build_object('status','saved','revision',saved.revision,'progress',saved.progress,'updated_at',saved.updated_at);
  END IF;
  IF saved.revision <> expected_revision THEN
    RETURN jsonb_build_object('status','conflict','revision',saved.revision,'progress',saved.progress,'updated_at',saved.updated_at);
  END IF;
  UPDATE public.archer_saves SET progress = new_progress, revision = revision + 1,
    last_request_id = request_id, updated_at = now() WHERE owner_id = uid RETURNING * INTO saved;
  RETURN jsonb_build_object('status','saved','revision',saved.revision,'progress',saved.progress,'updated_at',saved.updated_at);
END;
$$;
REVOKE ALL ON FUNCTION public.archer_save(bigint,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archer_save(bigint,jsonb,text) TO authenticated;
