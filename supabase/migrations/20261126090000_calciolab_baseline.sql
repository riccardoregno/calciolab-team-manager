-- CalcioLab canonical bootstrap for a fresh Supabase database.
-- Derived from the reviewed public schema-only snapshot. No application data.
-- Historical migrations are archived separately and must not be replayed after this file.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL standard_conforming_strings = on;

DO $baseline$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  ) THEN
    RAISE EXCEPTION 'CalcioLab baseline requires an empty public schema'
      USING ERRCODE = '55000';
  END IF;
  IF pg_catalog.to_regclass('auth.users') IS NULL
    OR pg_catalog.to_regprocedure('auth.uid()') IS NULL
    OR pg_catalog.to_regprocedure('auth.role()') IS NULL THEN
    RAISE EXCEPTION 'CalcioLab baseline requires the initialized Supabase Auth schema'
      USING ERRCODE = '55000';
  END IF;
END;
$baseline$;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
DO $baseline$
BEGIN
  IF pg_catalog.to_regprocedure('extensions.uuid_generate_v4()') IS NULL THEN
    RAISE EXCEPTION 'CalcioLab requires uuid-ossp installed in the extensions schema'
      USING ERRCODE = '55000';
  END IF;
END;
$baseline$;

CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE TABLE IF NOT EXISTS "public"."player_portal_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "player_id" "text" NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "visit_count" integer DEFAULT 0 NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone,
    "online_until" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "player_portal_activity_visit_count_check" CHECK (("visit_count" >= 0))
);


ALTER TABLE "public"."player_portal_activity" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "title" "text",
    "category" "text",
    "objective" "text",
    "duration" integer,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "data" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "team_id" "uuid",
    "external_id" "text"
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gps_sessions" (
    "id" "text" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gps_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."injury_records" (
    "id" "text" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."injury_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid",
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "season_id" "uuid" GENERATED ALWAYS AS ((NULLIF(("data" ->> 'seasonId'::"text"), ''::"text"))::"uuid") STORED
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."physical_tests" (
    "id" "text" NOT NULL,
    "team_id" "uuid",
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."physical_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "player_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."player_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "player_id" "text" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "reason" "text",
    "date_from" "date" NOT NULL,
    "date_to" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "player_availability_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'unavailable'::"text", 'doubtful'::"text"])))
);


ALTER TABLE "public"."player_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_injuries" (
    "id" "text" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "player_id" "text" NOT NULL,
    "injury_type" "text",
    "status" "text" DEFAULT 'Infortunato'::"text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "expected_return" "date",
    "sessions_missed" integer DEFAULT 0 NOT NULL,
    "matches_missed" integer DEFAULT 0 NOT NULL,
    "days_out" integer GENERATED ALWAYS AS (
CASE
    WHEN (("end_date" IS NOT NULL) AND ("start_date" IS NOT NULL)) THEN ("end_date" - "start_date")
    ELSE NULL::integer
END) STORED,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."player_injuries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid",
    "match_id" "text",
    "minutes" integer,
    "role" "text",
    "rating" numeric,
    "notes" "text",
    "team_id" "uuid",
    "goals" integer DEFAULT 0 NOT NULL,
    "assists" integer DEFAULT 0 NOT NULL,
    "minutes_played" integer,
    "yellow_cards" integer DEFAULT 0 NOT NULL,
    "red_cards" integer DEFAULT 0 NOT NULL,
    "goals_conceded" integer,
    "minutes_cleared" boolean DEFAULT false NOT NULL,
    CONSTRAINT "player_matches_cleared_minutes_are_unknown" CHECK (((NOT "minutes_cleared") OR ("minutes_played" IS NULL))),
    CONSTRAINT "player_matches_goals_conceded_check" CHECK (("goals_conceded" >= 0))
);


ALTER TABLE "public"."player_matches" OWNER TO "postgres";


COMMENT ON COLUMN "public"."player_matches"."goals_conceded" IS 'Individual goals conceded while playing goalkeeper; NULL when unknown, 0 for no goals conceded.';



COMMENT ON COLUMN "public"."player_matches"."minutes_cleared" IS 'An explicit clear prevents fallback to the legacy match attendance minutes.';



CREATE TABLE IF NOT EXISTS "public"."player_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid",
    "team_id" "uuid",
    "matches_played" integer DEFAULT 0,
    "minutes_played" integer DEFAULT 0,
    "goals" integer DEFAULT 0,
    "assists" integer DEFAULT 0,
    "rating" numeric DEFAULT 0,
    "appearances" integer DEFAULT 0,
    "yellow_cards" integer DEFAULT 0 NOT NULL,
    "red_cards" integer DEFAULT 0 NOT NULL,
    "season" "text" DEFAULT '2025/2026'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."player_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_wellness" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "sleep" smallint,
    "fatigue" smallint,
    "mood" smallint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "player_wellness_fatigue_check" CHECK ((("fatigue" >= 1) AND ("fatigue" <= 5))),
    CONSTRAINT "player_wellness_mood_check" CHECK ((("mood" >= 1) AND ("mood" <= 5))),
    CONSTRAINT "player_wellness_sleep_check" CHECK ((("sleep" >= 1) AND ("sleep" <= 5)))
);


ALTER TABLE "public"."player_wellness" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid",
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role" "text",
    "notes" "text",
    "age" integer,
    "status" "text",
    "image" "text",
    "first_name" "text",
    "last_name" "text",
    "name" "text",
    "user_id" "uuid"
);


ALTER TABLE "public"."players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "first_name" "text",
    "last_name" "text",
    "newsletter_opt_in" boolean DEFAULT false NOT NULL,
    "terms_accepted_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promo_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "plan" "text" DEFAULT 'premium'::"text" NOT NULL,
    "permanent" boolean DEFAULT false NOT NULL,
    "max_uses" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "promo_codes_plan_check" CHECK (("plan" = ANY (ARRAY['premium'::"text", 'club'::"text"])))
);


ALTER TABLE "public"."promo_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promo_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "redeemed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."promo_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "platform" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rsvp_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "match_id" "text" NOT NULL,
    "player_id" "text" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "response" "text" DEFAULT 'pending'::"text" NOT NULL,
    "responded_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reminder_sent_at" timestamp with time zone,
    CONSTRAINT "rsvp_tokens_response_check" CHECK (("response" = ANY (ARRAY['pending'::"text", 'yes'::"text", 'no'::"text"])))
);


ALTER TABLE "public"."rsvp_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_rpe" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "player_id" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "rpe_value" integer NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "session_rpe_event_type_check" CHECK (("event_type" = ANY (ARRAY['session'::"text", 'match'::"text"]))),
    CONSTRAINT "session_rpe_rpe_value_check" CHECK ((("rpe_value" >= 1) AND ("rpe_value" <= 10)))
);


ALTER TABLE "public"."session_rpe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid",
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "season_id" "uuid" GENERATED ALWAYS AS ((NULLIF(("data" ->> 'seasonId'::"text"), ''::"text"))::"uuid") STORED
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "author_name" "text" DEFAULT ''::"text" NOT NULL,
    "author_role" "text" DEFAULT 'headCoach'::"text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_messages_content_check" CHECK ((("char_length"("content") > 0) AND ("char_length"("content") <= 2000)))
);


ALTER TABLE "public"."staff_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_tasks" (
    "id" "text" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."staff_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "team_id" "uuid",
    "role" "text" DEFAULT 'owner'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_season_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "data" "jsonb" NOT NULL,
    "season_id" "uuid" GENERATED ALWAYS AS ((("data" ->> 'seasonId'::"text"))::"uuid") STORED NOT NULL,
    "player_id" "uuid" GENERATED ALWAYS AS ((("data" ->> 'playerId'::"text"))::"uuid") STORED NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "team_season_players_data_check" CHECK ((("data" ? 'profile'::"text") AND ("jsonb_typeof"(("data" -> 'profile'::"text")) = 'object'::"text")))
);


ALTER TABLE "public"."team_season_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "source_season_id" "uuid",
    "request_id" "uuid" NOT NULL,
    "request_payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "team_seasons_check" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "team_seasons_name_check" CHECK ((("length"("btrim"("name")) >= 1) AND ("length"("btrim"("name")) <= 60)))
);


ALTER TABLE "public"."team_seasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "season" "text",
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "subscription_plan" "text" DEFAULT 'free'::"text",
    "billing_status" "text" DEFAULT 'free'::"text",
    "trial_plan" "text" DEFAULT ''::"text",
    "trial_started_at" timestamp with time zone,
    "trial_ends_at" timestamp with time zone,
    "trial_used" boolean DEFAULT false,
    "owner_id" "uuid",
    "onboarding_completed" boolean DEFAULT false,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "vip_level" "text" DEFAULT 'bronze'::"text",
    "vip_points" integer DEFAULT 0,
    "vip_updated_at" timestamp without time zone,
    "subscription_status" "text" DEFAULT 'free'::"text",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "set_plays" "jsonb" DEFAULT '{}'::"jsonb",
    "trial_reminder_3d_sent" boolean DEFAULT false NOT NULL,
    "trial_reminder_1d_sent" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


COMMENT ON COLUMN "public"."teams"."trial_reminder_3d_sent" IS 'True dopo aver inviato la email di reminder a 3 giorni dalla scadenza del trial';



COMMENT ON COLUMN "public"."teams"."trial_reminder_1d_sent" IS 'True dopo aver inviato la email di reminder a 1 giorno dalla scadenza del trial';



CREATE TABLE IF NOT EXISTS "public"."training_exercises" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "training_id" "uuid",
    "exercise_id" "uuid",
    "custom_duration" integer,
    "custom_players" integer,
    "variant_notes" "text"
);


ALTER TABLE "public"."training_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trainings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "title" "text",
    "date" "date",
    "theme" "text",
    "objective" "text",
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."trainings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vip_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid",
    "type" "text" NOT NULL,
    "source" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "reward_code" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vip_events" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."can_manage_team_area"("p_team_id" "uuid", "p_area" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role text;
  v_area_access text;
  v_member_id text;
BEGIN
  IF auth.uid() IS NULL OR p_team_id IS NULL OR p_area IS NULL THEN
    RETURN false;
  END IF;

  SELECT tm.role
  INTO v_role
  FROM public.team_members tm
  WHERE tm.team_id = p_team_id
    AND tm.user_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role IN ('owner', 'headCoach') THEN
    RETURN true;
  END IF;

  -- player accounts must never write to staff entity tables
  IF v_role = 'player' THEN
    RETURN false;
  END IF;

  v_member_id := 'member-' || auth.uid()::text;

  SELECT member_item->'customAreas'->>p_area
  INTO v_area_access
  FROM public.teams t
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(t.settings->'members') = 'array'
      THEN t.settings->'members'
      ELSE '[]'::jsonb
    END
  ) AS member_item
  WHERE t.id = p_team_id
    AND member_item->>'id' = v_member_id
  LIMIT 1;

  IF v_area_access IN ('view', 'none') THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."can_manage_team_area"("p_team_id" "uuid", "p_area" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_team_season"("p_team_id" "uuid", "p_request_id" "uuid", "p_name" "text", "p_start_date" "date", "p_end_date" "date", "p_source_season_id" "uuid", "p_player_ids" "uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_id uuid;
  v_payload jsonb;
  v_previous jsonb;
  v_ids uuid[];
  v_name text := btrim(p_name);
  v_all_ids uuid[];
begin
  if not exists(select 1 from public.team_members where team_id=p_team_id and user_id=auth.uid() and role in ('owner','headCoach')) then
    raise exception 'SEASON_FORBIDDEN' using errcode='42501';
  end if;
  -- Serialize creation for this team, including two different browser sessions.
  perform 1 from public.teams where id=p_team_id for update;
  if p_request_id is null or p_start_date is null or p_end_date is null or p_end_date<p_start_date or length(v_name) not between 1 and 60 then
    raise exception 'SEASON_INVALID';
  end if;
  select coalesce(array_agg(distinct x order by x),'{}'::uuid[]) into v_ids from unnest(p_player_ids) x;
  v_payload := jsonb_build_object('name',v_name,'start',p_start_date,'end',p_end_date,'source',p_source_season_id,'players',to_jsonb(v_ids));
  select id,request_payload into v_id,v_previous from public.team_seasons where team_id=p_team_id and request_id=p_request_id;
  if found then
    if v_previous<>v_payload then raise exception 'SEASON_REQUEST_CONFLICT'; end if;
    return v_id;
  end if;
  if exists(select 1 from public.team_seasons where team_id=p_team_id and daterange(start_date,end_date,'[]') && daterange(p_start_date,p_end_date,'[]')) then
    raise exception 'SEASON_OVERLAP';
  end if;
  if p_source_season_id is null then
    if exists(select 1 from public.team_seasons where team_id=p_team_id) then raise exception 'SEASON_SOURCE_REQUIRED'; end if;
    select coalesce(array_agg(id order by id),'{}'::uuid[]) into v_all_ids from public.players where team_id=p_team_id;
    if v_all_ids<>v_ids then raise exception 'SEASON_BOOTSTRAP_ROSTER'; end if;
  else
    if not exists(select 1 from public.team_seasons where team_id=p_team_id and id=p_source_season_id and end_date<p_start_date) then raise exception 'SEASON_SOURCE_INVALID'; end if;
    if exists(select 1 from unnest(v_ids) x where not exists(select 1 from public.team_season_players where team_id=p_team_id and season_id=p_source_season_id and player_id=x)) then raise exception 'SEASON_PLAYER_INVALID'; end if;
  end if;
  insert into public.team_seasons(team_id,name,start_date,end_date,source_season_id,request_id,request_payload)
    values(p_team_id,v_name,p_start_date,p_end_date,p_source_season_id,p_request_id,v_payload) returning id into v_id;
  if p_source_season_id is null then
    insert into public.team_season_players(team_id,data)
      select p_team_id,jsonb_build_object('seasonId',v_id,'playerId',p.id,'profile',p.data)
      from public.players p where p.team_id=p_team_id;
  else
    insert into public.team_season_players(team_id,data)
      select p_team_id,jsonb_build_object('seasonId',v_id,'playerId',s.player_id,'profile',
        (s.data->'profile') || jsonb_build_object('transferDate','','status','Disponibile','ratings','{}'::jsonb))
      from public.team_season_players s where s.team_id=p_team_id and s.season_id=p_source_season_id and s.player_id=any(v_ids);
  end if;
  return v_id;
end;
$$;


ALTER FUNCTION "public"."create_team_season"("p_team_id" "uuid", "p_request_id" "uuid", "p_name" "text", "p_start_date" "date", "p_end_date" "date", "p_source_season_id" "uuid", "p_player_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_team_ids"() RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ARRAY(
    SELECT team_id
    FROM   public.team_members
    WHERE  user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."get_my_team_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_event_season"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare v_season public.team_seasons; v_date date;
begin
  if tg_op='UPDATE' and nullif(old.data->>'seasonId','') is not null and (new.data->>'seasonId' is distinct from old.data->>'seasonId' or new.team_id is distinct from old.team_id) then raise exception 'SEASON_EVENT_ID'; end if;
  if nullif(new.data->>'seasonId','') is null then
    if (tg_op='INSERT' or new.data->>'date' is distinct from old.data->>'date') and exists(select 1 from public.team_seasons where team_id=new.team_id) then raise exception 'SEASON_EVENT_REQUIRED'; end if;
    return new;
  end if;
  select * into v_season from public.team_seasons where team_id=new.team_id and id=(new.data->>'seasonId')::uuid;
  if not found then raise exception 'SEASON_EVENT_ID'; end if;
  if coalesce(new.data->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'SEASON_EVENT_DATE'; end if;
  v_date := (new.data->>'date')::date;
  if v_date<v_season.start_date or v_date>v_season.end_date then raise exception 'SEASON_EVENT_DATE'; end if;
  return new;
end;
$_$;


ALTER FUNCTION "public"."guard_event_season"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_season_player_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.team_id is distinct from old.team_id or new.data->>'seasonId' is distinct from old.data->>'seasonId' or new.data->>'playerId' is distinct from old.data->>'playerId' then
    raise exception 'SEASON_MEMBERSHIP_IDENTITY';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."guard_season_player_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    newsletter_opt_in,
    terms_accepted_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name',  ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'newsletter_opt_in')::boolean, false),
    CASE
      WHEN NEW.raw_user_meta_data->>'terms_accepted_at' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;  -- se esiste già non sovrascrive
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_player_stats"("p_team_id" "uuid", "p_player_id" "text", "p_season" "text", "p_delta_goals" integer DEFAULT 0, "p_delta_assists" integer DEFAULT 0, "p_delta_minutes" integer DEFAULT 0, "p_delta_yellow" integer DEFAULT 0, "p_delta_red" integer DEFAULT 0, "p_new_appearance" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.can_manage_team_area(p_team_id, 'matches') THEN
    RAISE EXCEPTION
      'access_denied: user % cannot manage match stats for team %',
      auth.uid(), p_team_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.player_stats
    (team_id, player_id, season, goals, assists, minutes_played,
     yellow_cards, red_cards, appearances, updated_at)
  VALUES
    (p_team_id, p_player_id, p_season,
     GREATEST(0, p_delta_goals),
     GREATEST(0, p_delta_assists),
     GREATEST(0, p_delta_minutes),
     GREATEST(0, p_delta_yellow),
     GREATEST(0, p_delta_red),
     CASE WHEN p_new_appearance THEN 1 ELSE 0 END,
     now())
  ON CONFLICT (team_id, player_id, season) DO UPDATE SET
    goals          = GREATEST(0, public.player_stats.goals          + p_delta_goals),
    assists        = GREATEST(0, public.player_stats.assists        + p_delta_assists),
    minutes_played = GREATEST(0, public.player_stats.minutes_played + p_delta_minutes),
    yellow_cards   = GREATEST(0, public.player_stats.yellow_cards   + p_delta_yellow),
    red_cards      = GREATEST(0, public.player_stats.red_cards      + p_delta_red),
    appearances    = public.player_stats.appearances + CASE WHEN p_new_appearance THEN 1 ELSE 0 END,
    updated_at     = now();
END;
$$;


ALTER FUNCTION "public"."increment_player_stats"("p_team_id" "uuid", "p_player_id" "text", "p_season" "text", "p_delta_goals" integer, "p_delta_assists" integer, "p_delta_minutes" integer, "p_delta_yellow" integer, "p_delta_red" integer, "p_new_appearance" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_vip_points"("p_team_id" "uuid", "p_delta" integer) RETURNS TABLE("id" "uuid", "vip_points" integer, "previous_level" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- NB: nella clausola RETURNING di un UPDATE, le colonne non presenti nel
  -- SET (qui vip_level) riflettono il valore della riga al momento
  -- dell'aggiornamento — cioè il livello "precedente" a questa scrittura.
  -- Il nuovo livello viene calcolato e scritto separatamente dalla Edge
  -- Function in base al nuovo punteggio restituito qui.
  RETURN QUERY
  UPDATE public.teams AS t
  SET
    vip_points = GREATEST(0, COALESCE(t.vip_points, 0) + p_delta),
    vip_updated_at = now()
  WHERE t.id = p_team_id
  RETURNING t.id, t.vip_points, t.vip_level;
END;
$$;


ALTER FUNCTION "public"."increment_vip_points"("p_team_id" "uuid", "p_delta" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_latest_team_season"("p_team" "uuid", "p_season" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p_season = (select id from public.team_seasons where team_id=p_team order by start_date desc limit 1);
$$;


ALTER FUNCTION "public"."is_latest_team_season"("p_team" "uuid", "p_season" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_client_billing_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if (
    new.subscription_plan is distinct from old.subscription_plan or
    new.subscription_status is distinct from old.subscription_status or
    new.billing_status is distinct from old.billing_status or
    new.trial_plan is distinct from old.trial_plan or
    new.trial_ends_at is distinct from old.trial_ends_at or
    new.trial_used is distinct from old.trial_used or
    new.stripe_customer_id is distinct from old.stripe_customer_id or
    new.stripe_subscription_id is distinct from old.stripe_subscription_id
  ) and auth.uid() is not null then
    raise exception
      'billing_immutable: subscription fields cannot be changed by the client (team: %)',
      old.id
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_client_billing_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_unauthorized_set_plays_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.set_plays IS DISTINCT FROM OLD.set_plays
     AND auth.uid() IS NOT NULL
     AND NOT public.can_manage_team_area(OLD.id, 'setPlays') THEN
    RAISE EXCEPTION
      'set_plays_forbidden: user % cannot manage set plays for team %',
      auth.uid(), OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_unauthorized_set_plays_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_promo_code"("p_team_id" "uuid", "p_code" "text") RETURNS TABLE("status" "text", "plan" "text", "permanent" boolean, "note" "text", "redeemed_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_code     record;
  v_existing record;
BEGIN
  SELECT * INTO v_code FROM public.promo_codes WHERE code = upper(trim(p_code));
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::boolean, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF NOT v_code.permanent AND v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::text, NULL::boolean, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO v_existing
  FROM public.promo_redemptions
  WHERE code_id = v_code.id AND team_id = p_team_id;

  IF FOUND THEN
    RETURN QUERY SELECT 'already_redeemed'::text, v_code.plan, v_code.permanent, v_code.note, v_existing.redeemed_at;
    RETURN;
  END IF;

  IF v_code.max_uses > 0 THEN
    -- UPDATE condizionale: sotto concorrenza, solo chi trova ancora
    -- used_count < max_uses al momento dello UPDATE incrementa con successo
    -- (lock di riga implicito di Postgres serializza i tentativi).
    UPDATE public.promo_codes
       SET used_count = used_count + 1
     WHERE id = v_code.id AND used_count < max_uses;

    IF NOT FOUND THEN
      RETURN QUERY SELECT 'limit_reached'::text, NULL::text, NULL::boolean, NULL::text, NULL::timestamptz;
      RETURN;
    END IF;
  ELSE
    UPDATE public.promo_codes SET used_count = used_count + 1 WHERE id = v_code.id;
  END IF;

  INSERT INTO public.promo_redemptions (code_id, team_id) VALUES (v_code.id, p_team_id);

  UPDATE public.teams
     SET subscription_plan = v_code.plan,
         billing_status    = 'active'
   WHERE id = p_team_id;

  RETURN QUERY SELECT 'redeemed'::text, v_code.plan, v_code.permanent, v_code.note, now();
END;
$$;


ALTER FUNCTION "public"."redeem_promo_code"("p_team_id" "uuid", "p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_trial_reminder_flags"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Se trial_ends_at cambia (nuovo trial), azzera i flag
  if new.trial_ends_at is distinct from old.trial_ends_at
     and new.trial_ends_at is not null then
    new.trial_reminder_3d_sent := false;
    new.trial_reminder_1d_sent := false;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."reset_trial_reminder_flags"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."touch_player_portal_activity"("p_team_id" "uuid", "p_player_id" "text", "p_increment" boolean DEFAULT false) RETURNS "public"."player_portal_activity"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row public.player_portal_activity;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.player_accounts pa
    WHERE pa.auth_user_id = auth.uid()
      AND pa.team_id = p_team_id
      AND pa.player_id = p_player_id
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  INSERT INTO public.player_portal_activity (
    team_id,
    player_id,
    auth_user_id,
    visit_count,
    first_seen_at,
    last_seen_at,
    online_until,
    updated_at
  )
  VALUES (
    p_team_id,
    p_player_id,
    auth.uid(),
    CASE WHEN p_increment THEN 1 ELSE 0 END,
    now(),
    now(),
    now() + interval '2 minutes',
    now()
  )
  ON CONFLICT (team_id, player_id) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    visit_count = public.player_portal_activity.visit_count + CASE WHEN p_increment THEN 1 ELSE 0 END,
    last_seen_at = now(),
    online_until = now() + interval '2 minutes',
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."touch_player_portal_activity"("p_team_id" "uuid", "p_player_id" "text", "p_increment" boolean) OWNER TO "postgres";

ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gps_sessions"
    ADD CONSTRAINT "gps_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."injury_records"
    ADD CONSTRAINT "injury_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."physical_tests"
    ADD CONSTRAINT "physical_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_accounts"
    ADD CONSTRAINT "player_accounts_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."player_accounts"
    ADD CONSTRAINT "player_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_availability"
    ADD CONSTRAINT "player_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_injuries"
    ADD CONSTRAINT "player_injuries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_matches"
    ADD CONSTRAINT "player_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_matches"
    ADD CONSTRAINT "player_matches_team_player_match_unique" UNIQUE ("team_id", "player_id", "match_id");



ALTER TABLE ONLY "public"."player_portal_activity"
    ADD CONSTRAINT "player_portal_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_stats"
    ADD CONSTRAINT "player_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_stats"
    ADD CONSTRAINT "player_stats_team_player_season_unique" UNIQUE ("team_id", "player_id", "season");



ALTER TABLE ONLY "public"."player_wellness"
    ADD CONSTRAINT "player_wellness_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_wellness"
    ADD CONSTRAINT "player_wellness_team_id_player_id_date_key" UNIQUE ("team_id", "player_id", "date");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_redemptions"
    ADD CONSTRAINT "promo_redemptions_code_id_team_id_key" UNIQUE ("code_id", "team_id");



ALTER TABLE ONLY "public"."promo_redemptions"
    ADD CONSTRAINT "promo_redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_team_id_key" UNIQUE ("user_id", "team_id");



ALTER TABLE ONLY "public"."rsvp_tokens"
    ADD CONSTRAINT "rsvp_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rsvp_tokens"
    ADD CONSTRAINT "rsvp_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."session_rpe"
    ADD CONSTRAINT "session_rpe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_rpe"
    ADD CONSTRAINT "session_rpe_team_id_player_id_event_id_key" UNIQUE ("team_id", "player_id", "event_id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_messages"
    ADD CONSTRAINT "staff_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_tasks"
    ADD CONSTRAINT "staff_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_user_unique" UNIQUE ("team_id", "user_id");



ALTER TABLE ONLY "public"."team_season_players"
    ADD CONSTRAINT "team_season_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_season_players"
    ADD CONSTRAINT "team_season_players_team_id_season_id_player_id_key" UNIQUE ("team_id", "season_id", "player_id");



ALTER TABLE ONLY "public"."team_seasons"
    ADD CONSTRAINT "team_seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_seasons"
    ADD CONSTRAINT "team_seasons_team_id_id_key" UNIQUE ("team_id", "id");



ALTER TABLE ONLY "public"."team_seasons"
    ADD CONSTRAINT "team_seasons_team_id_request_id_key" UNIQUE ("team_id", "request_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_exercises"
    ADD CONSTRAINT "training_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainings"
    ADD CONSTRAINT "trainings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vip_events"
    ADD CONSTRAINT "vip_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vip_events"
    ADD CONSTRAINT "vip_events_source_external_id_key" UNIQUE ("source", "external_id");



CREATE INDEX "gps_sessions_team_id_idx" ON "public"."gps_sessions" USING "btree" ("team_id");



CREATE INDEX "injury_records_team_id_idx" ON "public"."injury_records" USING "btree" ("team_id");



CREATE INDEX "matches_team_season_idx" ON "public"."matches" USING "btree" ("team_id", "season_id");



CREATE UNIQUE INDEX "player_accounts_team_player_idx" ON "public"."player_accounts" USING "btree" ("team_id", "player_id");



CREATE INDEX "player_availability_dates_idx" ON "public"."player_availability" USING "btree" ("team_id", "date_from", "date_to");



CREATE INDEX "player_availability_team_player_idx" ON "public"."player_availability" USING "btree" ("team_id", "player_id");



CREATE INDEX "player_injuries_active" ON "public"."player_injuries" USING "btree" ("team_id", "status") WHERE ("end_date" IS NULL);



CREATE INDEX "player_injuries_team_player" ON "public"."player_injuries" USING "btree" ("team_id", "player_id");



CREATE INDEX "player_portal_activity_online_idx" ON "public"."player_portal_activity" USING "btree" ("team_id", "online_until");



CREATE UNIQUE INDEX "player_portal_activity_team_auth_user_idx" ON "public"."player_portal_activity" USING "btree" ("team_id", "auth_user_id");



CREATE UNIQUE INDEX "player_portal_activity_team_player_idx" ON "public"."player_portal_activity" USING "btree" ("team_id", "player_id");



CREATE UNIQUE INDEX "players_team_identity_unique" ON "public"."players" USING "btree" ("team_id", "id");



CREATE INDEX "promo_redemptions_code_id_idx" ON "public"."promo_redemptions" USING "btree" ("code_id");



CREATE INDEX "promo_redemptions_team_id_idx" ON "public"."promo_redemptions" USING "btree" ("team_id");



CREATE INDEX "push_tokens_team_id_idx" ON "public"."push_tokens" USING "btree" ("team_id");



CREATE UNIQUE INDEX "rsvp_tokens_active_player_match_idx" ON "public"."rsvp_tokens" USING "btree" ("team_id", "match_id", "player_id");



CREATE INDEX "rsvp_tokens_match_idx" ON "public"."rsvp_tokens" USING "btree" ("team_id", "match_id");



CREATE INDEX "rsvp_tokens_pending_reminder_idx" ON "public"."rsvp_tokens" USING "btree" ("response", "created_at") WHERE (("response" = 'pending'::"text") AND ("reminder_sent_at" IS NULL));



CREATE INDEX "rsvp_tokens_token_idx" ON "public"."rsvp_tokens" USING "btree" ("token");



CREATE INDEX "sessions_team_season_idx" ON "public"."sessions" USING "btree" ("team_id", "season_id");



CREATE INDEX "staff_messages_team_created" ON "public"."staff_messages" USING "btree" ("team_id", "created_at" DESC);



CREATE INDEX "staff_tasks_team_id_idx" ON "public"."staff_tasks" USING "btree" ("team_id");



CREATE UNIQUE INDEX "team_seasons_name_unique" ON "public"."team_seasons" USING "btree" ("team_id", "lower"("name"));



CREATE UNIQUE INDEX "teams_invite_token_unique" ON "public"."teams" USING "btree" ((("settings" ->> 'inviteToken'::"text"))) WHERE (NULLIF(("settings" ->> 'inviteToken'::"text"), ''::"text") IS NOT NULL);



CREATE INDEX "vip_events_team_id_created_at_idx" ON "public"."vip_events" USING "btree" ("team_id", "created_at" DESC);



CREATE UNIQUE INDEX "vip_events_team_reward_code_key" ON "public"."vip_events" USING "btree" ("team_id", "reward_code") WHERE ("reward_code" IS NOT NULL);



CREATE OR REPLACE TRIGGER "guard_event_season" BEFORE INSERT OR UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."guard_event_season"();



CREATE OR REPLACE TRIGGER "guard_event_season" BEFORE INSERT OR UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."guard_event_season"();



CREATE OR REPLACE TRIGGER "guard_season_player_identity" BEFORE UPDATE ON "public"."team_season_players" FOR EACH ROW EXECUTE FUNCTION "public"."guard_season_player_identity"();



CREATE OR REPLACE TRIGGER "teams_billing_immutable" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_client_billing_update"();



CREATE OR REPLACE TRIGGER "teams_set_plays_write_permission" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_unauthorized_set_plays_update"();



CREATE OR REPLACE TRIGGER "trg_reset_trial_reminder_flags" BEFORE UPDATE OF "trial_ends_at" ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."reset_trial_reminder_flags"();



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_matches"
    ADD CONSTRAINT "fk_player_matches_player" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_stats"
    ADD CONSTRAINT "fk_player_stats_player" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gps_sessions"
    ADD CONSTRAINT "gps_sessions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."injury_records"
    ADD CONSTRAINT "injury_records_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_team_season_fk" FOREIGN KEY ("team_id", "season_id") REFERENCES "public"."team_seasons"("team_id", "id");



ALTER TABLE ONLY "public"."player_accounts"
    ADD CONSTRAINT "player_accounts_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_accounts"
    ADD CONSTRAINT "player_accounts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_availability"
    ADD CONSTRAINT "player_availability_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."player_availability"
    ADD CONSTRAINT "player_availability_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_injuries"
    ADD CONSTRAINT "player_injuries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_portal_activity"
    ADD CONSTRAINT "player_portal_activity_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_portal_activity"
    ADD CONSTRAINT "player_portal_activity_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_wellness"
    ADD CONSTRAINT "player_wellness_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_wellness"
    ADD CONSTRAINT "player_wellness_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promo_redemptions"
    ADD CONSTRAINT "promo_redemptions_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "public"."promo_codes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promo_redemptions"
    ADD CONSTRAINT "promo_redemptions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rsvp_tokens"
    ADD CONSTRAINT "rsvp_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."rsvp_tokens"
    ADD CONSTRAINT "rsvp_tokens_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_rpe"
    ADD CONSTRAINT "session_rpe_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_team_season_fk" FOREIGN KEY ("team_id", "season_id") REFERENCES "public"."team_seasons"("team_id", "id");



ALTER TABLE ONLY "public"."staff_messages"
    ADD CONSTRAINT "staff_messages_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_messages"
    ADD CONSTRAINT "staff_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_tasks"
    ADD CONSTRAINT "staff_tasks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_season_players"
    ADD CONSTRAINT "team_season_players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_season_players"
    ADD CONSTRAINT "team_season_players_team_id_player_id_fkey" FOREIGN KEY ("team_id", "player_id") REFERENCES "public"."players"("team_id", "id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."team_season_players"
    ADD CONSTRAINT "team_season_players_team_id_season_id_fkey" FOREIGN KEY ("team_id", "season_id") REFERENCES "public"."team_seasons"("team_id", "id");



ALTER TABLE ONLY "public"."team_seasons"
    ADD CONSTRAINT "team_seasons_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_seasons"
    ADD CONSTRAINT "team_seasons_team_id_source_season_id_fkey" FOREIGN KEY ("team_id", "source_season_id") REFERENCES "public"."team_seasons"("team_id", "id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_exercises"
    ADD CONSTRAINT "training_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."training_exercises"
    ADD CONSTRAINT "training_exercises_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "public"."trainings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainings"
    ADD CONSTRAINT "trainings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vip_events"
    ADD CONSTRAINT "vip_events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



CREATE POLICY "Team members can read vip events" ON "public"."vip_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."team_members" "tm"
  WHERE (("tm"."team_id" = "vip_events"."team_id") AND ("tm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Team members manage exercises" ON "public"."exercises" USING (("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Team members manage matches" ON "public"."matches" USING (("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Team members manage physical_tests" ON "public"."physical_tests" USING (("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Team members manage sessions" ON "public"."sessions" USING (("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their team" ON "public"."teams" FOR SELECT USING (("id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "authenticated_can_insert_team" ON "public"."teams" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gps_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."injury_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pa_delete" ON "public"."player_availability" FOR DELETE USING ((("player_id" = COALESCE(( SELECT "pa"."player_id"
   FROM "public"."player_accounts" "pa"
  WHERE (("pa"."auth_user_id" = "auth"."uid"()) AND ("pa"."team_id" = "player_availability"."team_id"))
 LIMIT 1), ''::"text")) OR "public"."can_manage_team_area"("team_id", 'availability'::"text")));



CREATE POLICY "pa_insert" ON "public"."player_availability" FOR INSERT WITH CHECK ((("player_id" = COALESCE(( SELECT "pa"."player_id"
   FROM "public"."player_accounts" "pa"
  WHERE (("pa"."auth_user_id" = "auth"."uid"()) AND ("pa"."team_id" = "player_availability"."team_id"))
 LIMIT 1), ''::"text")) OR "public"."can_manage_team_area"("team_id", 'availability'::"text")));



CREATE POLICY "pa_select_team_members" ON "public"."player_availability" FOR SELECT USING (("team_id" = ANY ("public"."get_my_team_ids"())));



CREATE POLICY "pa_update" ON "public"."player_availability" FOR UPDATE USING ((("player_id" = COALESCE(( SELECT "pa"."player_id"
   FROM "public"."player_accounts" "pa"
  WHERE (("pa"."auth_user_id" = "auth"."uid"()) AND ("pa"."team_id" = "player_availability"."team_id"))
 LIMIT 1), ''::"text")) OR "public"."can_manage_team_area"("team_id", 'availability'::"text"))) WITH CHECK ((("player_id" = COALESCE(( SELECT "pa"."player_id"
   FROM "public"."player_accounts" "pa"
  WHERE (("pa"."auth_user_id" = "auth"."uid"()) AND ("pa"."team_id" = "player_availability"."team_id"))
 LIMIT 1), ''::"text")) OR "public"."can_manage_team_area"("team_id", 'availability'::"text")));



ALTER TABLE "public"."physical_tests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "player_accounts_delete_team_staff" ON "public"."player_accounts" FOR DELETE USING ("public"."can_manage_team_area"("team_id", 'players'::"text"));



CREATE POLICY "player_accounts_select_own" ON "public"."player_accounts" FOR SELECT USING ((("auth_user_id" = "auth"."uid"()) OR ("team_id" = ANY ("public"."get_my_team_ids"()))));



ALTER TABLE "public"."player_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_injuries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "player_insert_own_wellness" ON "public"."player_wellness" FOR INSERT WITH CHECK ((("team_id" = ANY ("public"."get_my_team_ids"())) AND (("player_id")::"text" IN ( SELECT "player_accounts"."player_id"
   FROM "public"."player_accounts"
  WHERE ("player_accounts"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "player_manage_own_rpe" ON "public"."session_rpe" USING (("auth"."uid"() IN ( SELECT "player_accounts"."auth_user_id"
   FROM "public"."player_accounts"
  WHERE (("player_accounts"."team_id" = "session_rpe"."team_id") AND ("player_accounts"."player_id" = "session_rpe"."player_id"))))) WITH CHECK (("auth"."uid"() IN ( SELECT "player_accounts"."auth_user_id"
   FROM "public"."player_accounts"
  WHERE (("player_accounts"."team_id" = "session_rpe"."team_id") AND ("player_accounts"."player_id" = "session_rpe"."player_id")))));



ALTER TABLE "public"."player_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_portal_activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "player_read_own_wellness" ON "public"."player_wellness" FOR SELECT USING ((("player_id")::"text" IN ( SELECT "pa"."player_id"
   FROM "public"."player_accounts" "pa"
  WHERE (("pa"."auth_user_id" = "auth"."uid"()) AND ("pa"."team_id" = "player_wellness"."team_id")))));



ALTER TABLE "public"."player_stats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "player_update_own_wellness" ON "public"."player_wellness" FOR UPDATE USING ((("team_id" = ANY ("public"."get_my_team_ids"())) AND (("player_id")::"text" IN ( SELECT "player_accounts"."player_id"
   FROM "public"."player_accounts"
  WHERE ("player_accounts"."auth_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."player_wellness" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ppa_select_team_or_own_player" ON "public"."player_portal_activity" FOR SELECT USING ((("team_id" = ANY ("public"."get_my_team_ids"())) OR ("auth_user_id" = "auth"."uid"())));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promo_redemptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_tokens_delete_own" ON "public"."push_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "push_tokens_insert_own" ON "public"."push_tokens" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."team_members" "tm"
  WHERE (("tm"."team_id" = "push_tokens"."team_id") AND ("tm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "push_tokens_select_own" ON "public"."push_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "push_tokens_service_role" ON "public"."push_tokens" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "push_tokens_update_own" ON "public"."push_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."team_members" "tm"
  WHERE (("tm"."team_id" = "push_tokens"."team_id") AND ("tm"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."rsvp_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rsvp_tokens_insert_own_player" ON "public"."rsvp_tokens" FOR INSERT WITH CHECK ((("player_id" = ( SELECT "pa"."player_id"
   FROM "public"."player_accounts" "pa"
  WHERE (("pa"."auth_user_id" = "auth"."uid"()) AND ("pa"."team_id" = "rsvp_tokens"."team_id"))
 LIMIT 1)) AND ("response" = ANY (ARRAY['yes'::"text", 'no'::"text"]))));



CREATE POLICY "rsvp_tokens_select_team_members" ON "public"."rsvp_tokens" FOR SELECT USING (("team_id" = ANY ("public"."get_my_team_ids"())));



CREATE POLICY "rsvp_tokens_update_own_player" ON "public"."rsvp_tokens" FOR UPDATE USING (("player_id" = ( SELECT "pa"."player_id"
   FROM "public"."player_accounts" "pa"
  WHERE (("pa"."auth_user_id" = "auth"."uid"()) AND ("pa"."team_id" = "rsvp_tokens"."team_id"))
 LIMIT 1))) WITH CHECK (("player_id" = ( SELECT "pa"."player_id"
   FROM "public"."player_accounts" "pa"
  WHERE (("pa"."auth_user_id" = "auth"."uid"()) AND ("pa"."team_id" = "rsvp_tokens"."team_id"))
 LIMIT 1)));



ALTER TABLE "public"."session_rpe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_messages_delete_own" ON "public"."staff_messages" FOR DELETE USING ((("user_id" = "auth"."uid"()) AND "public"."can_manage_team_area"("team_id", 'staffChat'::"text")));



CREATE POLICY "staff_messages_insert" ON "public"."staff_messages" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."can_manage_team_area"("team_id", 'staffChat'::"text")));



CREATE POLICY "staff_messages_select" ON "public"."staff_messages" FOR SELECT USING (("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "staff_read_rpe" ON "public"."session_rpe" FOR SELECT USING (("auth"."uid"() IN ( SELECT "team_members"."user_id"
   FROM "public"."team_members"
  WHERE ("team_members"."team_id" = "session_rpe"."team_id"))));



CREATE POLICY "staff_read_wellness" ON "public"."player_wellness" FOR SELECT USING ((("team_id" = ANY ("public"."get_my_team_ids"())) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."player_accounts" "pa"
  WHERE (("pa"."auth_user_id" = "auth"."uid"()) AND ("pa"."team_id" = "player_wellness"."team_id")))))));



ALTER TABLE "public"."staff_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_area_delete_exercises" ON "public"."exercises" FOR DELETE USING ("public"."can_manage_team_area"("team_id", 'exercises'::"text"));



CREATE POLICY "team_area_delete_gps_sessions" ON "public"."gps_sessions" FOR DELETE USING ("public"."can_manage_team_area"("team_id", 'physical'::"text"));



CREATE POLICY "team_area_delete_injury_records" ON "public"."injury_records" FOR DELETE USING ("public"."can_manage_team_area"("team_id", 'availability'::"text"));



CREATE POLICY "team_area_delete_matches" ON "public"."matches" FOR DELETE USING ("public"."can_manage_team_area"("team_id", 'matches'::"text"));



CREATE POLICY "team_area_delete_physical_tests" ON "public"."physical_tests" FOR DELETE USING ("public"."can_manage_team_area"("team_id", 'physical'::"text"));



CREATE POLICY "team_area_delete_player_injuries" ON "public"."player_injuries" FOR DELETE USING ("public"."can_manage_team_area"("team_id", 'availability'::"text"));



CREATE POLICY "team_area_delete_player_matches" ON "public"."player_matches" FOR DELETE USING ("public"."can_manage_team_area"("team_id", 'matches'::"text"));



CREATE POLICY "team_area_delete_player_stats" ON "public"."player_stats" FOR DELETE USING ("public"."can_manage_team_area"("team_id", 'matches'::"text"));



CREATE POLICY "team_area_delete_players" ON "public"."players" FOR DELETE USING ("public"."can_manage_team_area"("team_id", 'players'::"text"));



CREATE POLICY "team_area_delete_sessions" ON "public"."sessions" FOR DELETE USING ("public"."can_manage_team_area"("team_id", 'sessions'::"text"));



CREATE POLICY "team_area_delete_staff_tasks" ON "public"."staff_tasks" FOR DELETE USING ("public"."can_manage_team_area"("team_id", 'staffTasks'::"text"));



CREATE POLICY "team_area_insert_exercises" ON "public"."exercises" FOR INSERT WITH CHECK ("public"."can_manage_team_area"("team_id", 'exercises'::"text"));



CREATE POLICY "team_area_insert_gps_sessions" ON "public"."gps_sessions" FOR INSERT WITH CHECK ("public"."can_manage_team_area"("team_id", 'physical'::"text"));



CREATE POLICY "team_area_insert_injury_records" ON "public"."injury_records" FOR INSERT WITH CHECK ("public"."can_manage_team_area"("team_id", 'availability'::"text"));



CREATE POLICY "team_area_insert_matches" ON "public"."matches" FOR INSERT WITH CHECK ("public"."can_manage_team_area"("team_id", 'matches'::"text"));



CREATE POLICY "team_area_insert_physical_tests" ON "public"."physical_tests" FOR INSERT WITH CHECK ("public"."can_manage_team_area"("team_id", 'physical'::"text"));



CREATE POLICY "team_area_insert_player_injuries" ON "public"."player_injuries" FOR INSERT WITH CHECK ("public"."can_manage_team_area"("team_id", 'availability'::"text"));



CREATE POLICY "team_area_insert_player_matches" ON "public"."player_matches" FOR INSERT WITH CHECK ("public"."can_manage_team_area"("team_id", 'matches'::"text"));



CREATE POLICY "team_area_insert_player_stats" ON "public"."player_stats" FOR INSERT WITH CHECK ("public"."can_manage_team_area"("team_id", 'matches'::"text"));



CREATE POLICY "team_area_insert_players" ON "public"."players" FOR INSERT WITH CHECK ("public"."can_manage_team_area"("team_id", 'players'::"text"));



CREATE POLICY "team_area_insert_sessions" ON "public"."sessions" FOR INSERT WITH CHECK ("public"."can_manage_team_area"("team_id", 'sessions'::"text"));



CREATE POLICY "team_area_insert_staff_tasks" ON "public"."staff_tasks" FOR INSERT WITH CHECK ("public"."can_manage_team_area"("team_id", 'staffTasks'::"text"));



CREATE POLICY "team_area_update_exercises" ON "public"."exercises" FOR UPDATE USING ("public"."can_manage_team_area"("team_id", 'exercises'::"text")) WITH CHECK ("public"."can_manage_team_area"("team_id", 'exercises'::"text"));



CREATE POLICY "team_area_update_gps_sessions" ON "public"."gps_sessions" FOR UPDATE USING ("public"."can_manage_team_area"("team_id", 'physical'::"text")) WITH CHECK ("public"."can_manage_team_area"("team_id", 'physical'::"text"));



CREATE POLICY "team_area_update_injury_records" ON "public"."injury_records" FOR UPDATE USING ("public"."can_manage_team_area"("team_id", 'availability'::"text")) WITH CHECK ("public"."can_manage_team_area"("team_id", 'availability'::"text"));



CREATE POLICY "team_area_update_matches" ON "public"."matches" FOR UPDATE USING ("public"."can_manage_team_area"("team_id", 'matches'::"text")) WITH CHECK ("public"."can_manage_team_area"("team_id", 'matches'::"text"));



CREATE POLICY "team_area_update_physical_tests" ON "public"."physical_tests" FOR UPDATE USING ("public"."can_manage_team_area"("team_id", 'physical'::"text")) WITH CHECK ("public"."can_manage_team_area"("team_id", 'physical'::"text"));



CREATE POLICY "team_area_update_player_injuries" ON "public"."player_injuries" FOR UPDATE USING ("public"."can_manage_team_area"("team_id", 'availability'::"text")) WITH CHECK ("public"."can_manage_team_area"("team_id", 'availability'::"text"));



CREATE POLICY "team_area_update_player_matches" ON "public"."player_matches" FOR UPDATE USING ("public"."can_manage_team_area"("team_id", 'matches'::"text")) WITH CHECK ("public"."can_manage_team_area"("team_id", 'matches'::"text"));



CREATE POLICY "team_area_update_player_stats" ON "public"."player_stats" FOR UPDATE USING ("public"."can_manage_team_area"("team_id", 'matches'::"text")) WITH CHECK ("public"."can_manage_team_area"("team_id", 'matches'::"text"));



CREATE POLICY "team_area_update_players" ON "public"."players" FOR UPDATE USING ("public"."can_manage_team_area"("team_id", 'players'::"text")) WITH CHECK ("public"."can_manage_team_area"("team_id", 'players'::"text"));



CREATE POLICY "team_area_update_sessions" ON "public"."sessions" FOR UPDATE USING ("public"."can_manage_team_area"("team_id", 'sessions'::"text")) WITH CHECK ("public"."can_manage_team_area"("team_id", 'sessions'::"text"));



CREATE POLICY "team_area_update_staff_tasks" ON "public"."staff_tasks" FOR UPDATE USING ("public"."can_manage_team_area"("team_id", 'staffTasks'::"text")) WITH CHECK ("public"."can_manage_team_area"("team_id", 'staffTasks'::"text"));



CREATE POLICY "team_iso_select_exercises" ON "public"."exercises" FOR SELECT USING (("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "team_iso_select_gps_sessions" ON "public"."gps_sessions" FOR SELECT USING (("team_id" = ANY ("public"."get_my_team_ids"())));



CREATE POLICY "team_iso_select_injury_records" ON "public"."injury_records" FOR SELECT USING (("team_id" = ANY ("public"."get_my_team_ids"())));



CREATE POLICY "team_iso_select_matches" ON "public"."matches" FOR SELECT USING (("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "team_iso_select_physical_tests" ON "public"."physical_tests" FOR SELECT USING (("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "team_iso_select_player_injuries" ON "public"."player_injuries" FOR SELECT USING (("team_id" = ANY ("public"."get_my_team_ids"())));



CREATE POLICY "team_iso_select_player_matches" ON "public"."player_matches" FOR SELECT USING (("team_id" = ANY ("public"."get_my_team_ids"())));



CREATE POLICY "team_iso_select_player_stats" ON "public"."player_stats" FOR SELECT USING (("team_id" = ANY ("public"."get_my_team_ids"())));



CREATE POLICY "team_iso_select_players" ON "public"."players" FOR SELECT USING (("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "team_iso_select_sessions" ON "public"."sessions" FOR SELECT USING (("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "team_iso_select_staff_tasks" ON "public"."staff_tasks" FOR SELECT USING (("team_id" = ANY ("public"."get_my_team_ids"())));



ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members_can_read_own_team" ON "public"."teams" FOR SELECT USING ((("id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))) OR ("owner_id" = "auth"."uid"())));



CREATE POLICY "team_members_can_update_non_billing_fields" ON "public"."teams" FOR UPDATE USING (("id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE (("team_members"."user_id" = "auth"."uid"()) AND ("team_members"."role" = ANY (ARRAY['owner'::"text", 'headCoach'::"text"]))))));



CREATE POLICY "team_members_delete_managers_or_self" ON "public"."team_members" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."team_members" "caller"
  WHERE (("caller"."user_id" = "auth"."uid"()) AND ("caller"."team_id" = "team_members"."team_id") AND ("caller"."role" = ANY (ARRAY['owner'::"text", 'headCoach'::"text"])))))));



CREATE POLICY "team_members_insert_owned_team_only" ON "public"."team_members" AS RESTRICTIVE FOR INSERT WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("role" = 'owner'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."teams" "owned_team"
  WHERE (("owned_team"."id" = "team_members"."team_id") AND ("owned_team"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "team_members_insert_self_only" ON "public"."team_members" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "team_members_select_own_teams" ON "public"."team_members" FOR SELECT USING (("team_id" = ANY ("public"."get_my_team_ids"())));



CREATE POLICY "team_members_update_managers_only" ON "public"."team_members" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."team_members" "caller"
  WHERE (("caller"."user_id" = "auth"."uid"()) AND ("caller"."team_id" = "team_members"."team_id") AND ("caller"."role" = ANY (ARRAY['owner'::"text", 'headCoach'::"text"])))))) WITH CHECK (("team_id" = ANY ("public"."get_my_team_ids"())));



ALTER TABLE "public"."team_season_players" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_season_players_delete" ON "public"."team_season_players" FOR DELETE TO "authenticated" USING (("public"."can_manage_team_area"("team_id", 'players'::"text") AND "public"."is_latest_team_season"("team_id", "season_id")));



CREATE POLICY "team_season_players_insert" ON "public"."team_season_players" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_manage_team_area"("team_id", 'players'::"text") AND "public"."is_latest_team_season"("team_id", "season_id")));



CREATE POLICY "team_season_players_read" ON "public"."team_season_players" FOR SELECT TO "authenticated" USING ((("team_id" = ANY ("public"."get_my_team_ids"())) AND ((EXISTS ( SELECT 1
   FROM "public"."team_members" "m"
  WHERE (("m"."team_id" = "team_season_players"."team_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("m"."role" <> 'player'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."player_accounts" "a"
  WHERE (("a"."team_id" = "team_season_players"."team_id") AND ("a"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("a"."player_id" = ("team_season_players"."player_id")::"text")))))));



CREATE POLICY "team_season_players_update" ON "public"."team_season_players" FOR UPDATE TO "authenticated" USING (("public"."can_manage_team_area"("team_id", 'players'::"text") AND "public"."is_latest_team_season"("team_id", "season_id"))) WITH CHECK (("public"."can_manage_team_area"("team_id", 'players'::"text") AND "public"."is_latest_team_season"("team_id", "season_id")));



ALTER TABLE "public"."team_seasons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_seasons_read" ON "public"."team_seasons" FOR SELECT TO "authenticated" USING (("team_id" = ANY ("public"."get_my_team_ids"())));



ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vip_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vip_events_no_client_delete" ON "public"."vip_events" AS RESTRICTIVE FOR DELETE USING (false);



CREATE POLICY "vip_events_no_client_insert" ON "public"."vip_events" AS RESTRICTIVE FOR INSERT WITH CHECK (false);



CREATE POLICY "vip_events_no_client_update" ON "public"."vip_events" AS RESTRICTIVE FOR UPDATE USING (false);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



-- Supabase can grant anon and authenticated privileges when objects are created.
-- Revoke the inherited defaults on the specific objects restricted in the snapshot.
REVOKE ALL ON FUNCTION "public"."can_manage_team_area"("p_team_id" "uuid", "p_area" "text") FROM PUBLIC, "anon";
GRANT ALL ON FUNCTION "public"."can_manage_team_area"("p_team_id" "uuid", "p_area" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_team_area"("p_team_id" "uuid", "p_area" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_team_season"("p_team_id" "uuid", "p_request_id" "uuid", "p_name" "text", "p_start_date" "date", "p_end_date" "date", "p_source_season_id" "uuid", "p_player_ids" "uuid"[]) FROM PUBLIC, "anon";
GRANT ALL ON FUNCTION "public"."create_team_season"("p_team_id" "uuid", "p_request_id" "uuid", "p_name" "text", "p_start_date" "date", "p_end_date" "date", "p_source_season_id" "uuid", "p_player_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_team_season"("p_team_id" "uuid", "p_request_id" "uuid", "p_name" "text", "p_start_date" "date", "p_end_date" "date", "p_source_season_id" "uuid", "p_player_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_team_ids"() FROM PUBLIC, "anon";
GRANT ALL ON FUNCTION "public"."get_my_team_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_team_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_event_season"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_event_season"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_event_season"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_season_player_identity"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_season_player_identity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_season_player_identity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_player_stats"("p_team_id" "uuid", "p_player_id" "text", "p_season" "text", "p_delta_goals" integer, "p_delta_assists" integer, "p_delta_minutes" integer, "p_delta_yellow" integer, "p_delta_red" integer, "p_new_appearance" boolean) FROM PUBLIC, "anon";
GRANT ALL ON FUNCTION "public"."increment_player_stats"("p_team_id" "uuid", "p_player_id" "text", "p_season" "text", "p_delta_goals" integer, "p_delta_assists" integer, "p_delta_minutes" integer, "p_delta_yellow" integer, "p_delta_red" integer, "p_new_appearance" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_player_stats"("p_team_id" "uuid", "p_player_id" "text", "p_season" "text", "p_delta_goals" integer, "p_delta_assists" integer, "p_delta_minutes" integer, "p_delta_yellow" integer, "p_delta_red" integer, "p_new_appearance" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_vip_points"("p_team_id" "uuid", "p_delta" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_vip_points"("p_team_id" "uuid", "p_delta" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_vip_points"("p_team_id" "uuid", "p_delta" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_vip_points"("p_team_id" "uuid", "p_delta" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_latest_team_season"("p_team" "uuid", "p_season" "uuid") FROM PUBLIC, "anon";
GRANT ALL ON FUNCTION "public"."is_latest_team_season"("p_team" "uuid", "p_season" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_latest_team_season"("p_team" "uuid", "p_season" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_client_billing_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_client_billing_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_client_billing_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_unauthorized_set_plays_update"() FROM PUBLIC, "anon";
GRANT ALL ON FUNCTION "public"."prevent_unauthorized_set_plays_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_unauthorized_set_plays_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."redeem_promo_code"("p_team_id" "uuid", "p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."redeem_promo_code"("p_team_id" "uuid", "p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_promo_code"("p_team_id" "uuid", "p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_promo_code"("p_team_id" "uuid", "p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_trial_reminder_flags"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_trial_reminder_flags"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_trial_reminder_flags"() TO "service_role";



GRANT ALL ON TABLE "public"."player_portal_activity" TO "anon";
GRANT ALL ON TABLE "public"."player_portal_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."player_portal_activity" TO "service_role";



REVOKE ALL ON FUNCTION "public"."touch_player_portal_activity"("p_team_id" "uuid", "p_player_id" "text", "p_increment" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."touch_player_portal_activity"("p_team_id" "uuid", "p_player_id" "text", "p_increment" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."touch_player_portal_activity"("p_team_id" "uuid", "p_player_id" "text", "p_increment" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_player_portal_activity"("p_team_id" "uuid", "p_player_id" "text", "p_increment" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."gps_sessions" TO "anon";
GRANT ALL ON TABLE "public"."gps_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."gps_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."injury_records" TO "anon";
GRANT ALL ON TABLE "public"."injury_records" TO "authenticated";
GRANT ALL ON TABLE "public"."injury_records" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."physical_tests" TO "anon";
GRANT ALL ON TABLE "public"."physical_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."physical_tests" TO "service_role";



GRANT ALL ON TABLE "public"."player_accounts" TO "anon";
GRANT ALL ON TABLE "public"."player_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."player_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."player_availability" TO "anon";
GRANT ALL ON TABLE "public"."player_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."player_availability" TO "service_role";



GRANT ALL ON TABLE "public"."player_injuries" TO "anon";
GRANT ALL ON TABLE "public"."player_injuries" TO "authenticated";
GRANT ALL ON TABLE "public"."player_injuries" TO "service_role";



GRANT ALL ON TABLE "public"."player_matches" TO "anon";
GRANT ALL ON TABLE "public"."player_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."player_matches" TO "service_role";



GRANT ALL ON TABLE "public"."player_stats" TO "anon";
GRANT ALL ON TABLE "public"."player_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."player_stats" TO "service_role";



GRANT ALL ON TABLE "public"."player_wellness" TO "anon";
GRANT ALL ON TABLE "public"."player_wellness" TO "authenticated";
GRANT ALL ON TABLE "public"."player_wellness" TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promo_codes" TO "anon";
GRANT ALL ON TABLE "public"."promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_codes" TO "service_role";



GRANT ALL ON TABLE "public"."promo_redemptions" TO "anon";
GRANT ALL ON TABLE "public"."promo_redemptions" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_redemptions" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."rsvp_tokens" TO "anon";
GRANT ALL ON TABLE "public"."rsvp_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."rsvp_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."session_rpe" TO "anon";
GRANT ALL ON TABLE "public"."session_rpe" TO "authenticated";
GRANT ALL ON TABLE "public"."session_rpe" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."staff_messages" TO "anon";
GRANT ALL ON TABLE "public"."staff_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_messages" TO "service_role";



GRANT ALL ON TABLE "public"."staff_tasks" TO "anon";
GRANT ALL ON TABLE "public"."staff_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



REVOKE ALL ON TABLE "public"."team_season_players" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."team_season_players" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."team_season_players" TO "authenticated";



REVOKE ALL ON TABLE "public"."team_seasons" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."team_seasons" TO "service_role";
GRANT SELECT ON TABLE "public"."team_seasons" TO "authenticated";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."training_exercises" TO "anon";
GRANT ALL ON TABLE "public"."training_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."training_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."trainings" TO "anon";
GRANT ALL ON TABLE "public"."trainings" TO "authenticated";
GRANT ALL ON TABLE "public"."trainings" TO "service_role";



GRANT ALL ON TABLE "public"."vip_events" TO "anon";
GRANT ALL ON TABLE "public"."vip_events" TO "authenticated";
GRANT ALL ON TABLE "public"."vip_events" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

COMMIT;
