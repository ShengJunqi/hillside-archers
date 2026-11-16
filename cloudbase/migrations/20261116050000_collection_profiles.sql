-- Optional collection profile for personal, non-competitive progress.
-- No row rewrite, new environment, table or ownership policy is introduced.
-- Execute as one transaction after the existing two account-save migrations.
BEGIN;

CREATE OR REPLACE FUNCTION public.archer_collection_valid(profile jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE
  field text;
  limit_value numeric;
  chosen text;
BEGIN
  IF profile IS NULL OR jsonb_typeof(profile) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF octet_length(profile::text) > 4096
     OR profile - ARRAY['version','revision','tokens','stats','claimed','owned','skin','talent'] <> '{}'::jsonb
     OR profile->'version' IS DISTINCT FROM '1'::jsonb THEN RETURN false; END IF;
  FOREACH field IN ARRAY ARRAY['revision','tokens'] LOOP
    IF jsonb_typeof(profile->field) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    IF (profile->>field) !~ '^[0-9]+$' THEN RETURN false; END IF;
    limit_value := CASE field WHEN 'revision' THEN 1000000000 ELSE 9999 END;
    IF (profile->>field)::numeric NOT BETWEEN 0 AND limit_value THEN RETURN false; END IF;
  END LOOP;
  IF jsonb_typeof(profile->'stats') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF (profile->'stats') - ARRAY['wins','heads','casts','covers','bosses'] <> '{}'::jsonb THEN RETURN false; END IF;
  FOREACH field IN ARRAY ARRAY['wins','heads','casts','covers','bosses'] LOOP
    IF jsonb_typeof(profile->'stats'->field) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    IF (profile->'stats'->>field) !~ '^[0-9]+$' THEN RETURN false; END IF;
    IF (profile->'stats'->>field)::numeric NOT BETWEEN 0 AND 999999 THEN RETURN false; END IF;
  END LOOP;
  IF jsonb_typeof(profile->'claimed') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(profile->'claimed') > 6 THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(profile->'claimed') AS item
    WHERE jsonb_typeof(item) IS DISTINCT FROM 'string' OR item #>> '{}' NOT IN
      ('first_win','ten_heads','ten_casts','breaker','expedition6','target500')) THEN RETURN false; END IF;
  IF (SELECT count(DISTINCT item) FROM jsonb_array_elements(profile->'claimed') AS item)
     <> jsonb_array_length(profile->'claimed') THEN RETURN false; END IF;
  IF jsonb_typeof(profile->'owned') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(profile->'owned') > 6 THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(profile->'owned') AS item
    WHERE jsonb_typeof(item) IS DISTINCT FROM 'string' OR item #>> '{}' NOT IN
      ('skin_sunset','skin_night','skin_storm','skin_meteor','talent_quiver','talent_breach')) THEN RETURN false; END IF;
  IF (SELECT count(DISTINCT item) FROM jsonb_array_elements(profile->'owned') AS item)
     <> jsonb_array_length(profile->'owned') THEN RETURN false; END IF;
  IF jsonb_typeof(profile->'skin') IS DISTINCT FROM 'string'
     OR jsonb_typeof(profile->'talent') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
  chosen := profile->>'skin';
  IF chosen NOT IN ('base','skin_sunset','skin_night','skin_storm','skin_meteor') THEN RETURN false; END IF;
  IF chosen <> 'base' AND NOT (profile->'owned' @> jsonb_build_array(chosen)) THEN RETURN false; END IF;
  chosen := profile->>'talent';
  IF chosen NOT IN ('none','talent_quiver','talent_breach') THEN RETURN false; END IF;
  IF chosen <> 'none' AND NOT (profile->'owned' @> jsonb_build_array(chosen)) THEN RETURN false; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.archer_collection_valid(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archer_collection_valid(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.archer_save(expected_revision bigint, new_progress jsonb, request_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  uid text := auth.uid();
  saved public.archer_saves;
  field text;
  bounds integer[];
  payload jsonb;
BEGIN
  IF uid IS NULL OR auth.role() <> 'authenticated'
     OR coalesce((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Login required' USING ERRCODE = '42501';
  END IF;
  IF expected_revision IS NULL OR expected_revision < 0
     OR request_id IS NULL OR length(request_id) NOT BETWEEN 16 AND 100
     OR new_progress IS NULL OR jsonb_typeof(new_progress) <> 'object'
     OR octet_length(new_progress::text) > 8192
     OR new_progress - ARRAY['version','targetBest','unlocked','checkpoint','best','embers','bow','life','names','collection'] <> '{}'::jsonb
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

  IF new_progress ? 'collection' AND NOT public.archer_collection_valid(new_progress->'collection') THEN
    RAISE EXCEPTION 'Invalid collection' USING ERRCODE = '22023';
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
  -- An older client does not know the optional field. Retain its full bundle
  -- rather than letting a legacy v2 write erase purchases or mint a new wallet.
  payload := new_progress;
  IF NOT (payload ? 'collection') AND saved.progress ? 'collection' THEN
    payload := payload || jsonb_build_object('collection', saved.progress->'collection');
  END IF;
  IF octet_length(payload::text) > 8192 THEN
    RAISE EXCEPTION 'Invalid progress size' USING ERRCODE = '22023';
  END IF;
  UPDATE public.archer_saves SET progress = payload, revision = revision + 1,
    last_request_id = request_id, updated_at = now() WHERE owner_id = uid RETURNING * INTO saved;
  RETURN jsonb_build_object('status','saved','revision',saved.revision,'progress',saved.progress,'updated_at',saved.updated_at);
END;
$$;
-- The account wrapper and existing SELECT RLS are retained. Only the guarded
-- wrapper is callable by authenticated players; the validator is admin/internal.
REVOKE ALL ON FUNCTION public.archer_save(bigint,jsonb,text) FROM PUBLIC, anon, authenticated;
COMMIT;
