-- ============================================================================
-- MG HOME CMS — Production Database Migration (v2.3.0 Hardened)
-- File: supabase/migrations/20261119000001_initial_schema_v2_3_0.sql
-- ============================================================================

-- Step 1: Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 2: Global Privilege Hardening
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- Step 3: Admin Profiles Table (Strict Single Admin Identity Enforced at DB Level)
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'super_admin' CHECK (role = 'super_admin'),
    is_singleton BOOLEAN NOT NULL DEFAULT true CHECK (is_singleton = true),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_admin_profiles_singleton UNIQUE (is_singleton)
);

-- Trigger to guarantee single admin constraint on INSERT
CREATE OR REPLACE FUNCTION public.fn_enforce_single_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.admin_profiles) >= 1 THEN
        RAISE EXCEPTION 'SINGLE ADMIN VIOLATION: The system permits exactly one administrator profile.'
            USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_admin ON public.admin_profiles;
CREATE TRIGGER trg_enforce_single_admin
    BEFORE INSERT ON public.admin_profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_single_admin();

-- Step 3.1: Official Supabase Auth Bootstrap Trigger for Initial Admin Profile
-- Seamlessly provisions the admin_profiles record when the super admin signs up
CREATE OR REPLACE FUNCTION public.fn_handle_new_admin_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.admin_profiles) = 0 THEN
        INSERT INTO public.admin_profiles (
            id,
            full_name,
            email,
            role,
            is_singleton
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'System Administrator'),
            NEW.email,
            'super_admin',
            true
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_admin_user();

-- Step 4: Draft Site Settings (Singleton row: id = 1)
CREATE TABLE IF NOT EXISTS public.draft_site_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    business_name_ar VARCHAR(100) NOT NULL DEFAULT 'إم جي هوم',
    business_name_en VARCHAR(100) NOT NULL DEFAULT 'MG HOME',
    local_phone VARCHAR(20) NOT NULL DEFAULT '0538061531',
    country_code VARCHAR(10) NOT NULL DEFAULT '966',
    is_country_code_confirmed BOOLEAN NOT NULL DEFAULT true,
    instagram_url VARCHAR(255) NOT NULL DEFAULT 'https://www.instagram.com/mg_home_air_conditioning/',
    instagram_handle VARCHAR(100) NOT NULL DEFAULT '@mg_home_air_conditioning',
    facebook_url VARCHAR(255) NOT NULL DEFAULT 'https://www.facebook.com/share/1533Pkhifuh/',
    service_messages_ar JSONB NOT NULL DEFAULT '{}'::jsonb,
    service_messages_en JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Step 5: Draft Page Metadata (Singleton row: id = 1)
CREATE TABLE IF NOT EXISTS public.draft_page_metadata (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    slug VARCHAR(50) NOT NULL DEFAULT 'home' CHECK (slug = 'home'),
    title_ar VARCHAR(255) NOT NULL DEFAULT 'MG HOME — لجميع خدمات التكييف والصيانة',
    title_en VARCHAR(255) NOT NULL DEFAULT 'MG HOME — AC & Maintenance Services',
    meta_description_ar TEXT NOT NULL DEFAULT 'خدمات تركيب وصيانة التكييف المركزي وسبليت وتمديد النحاس.',
    meta_description_en TEXT NOT NULL DEFAULT 'Professional Split, Central AC, Copper Piping and Appliance Maintenance.',
    og_image_url VARCHAR(500) DEFAULT 'assets/logo/mg-home-logo.jpeg',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Step 6: Draft Page Sections (With Deferrable Unique Ordering)
CREATE TABLE IF NOT EXISTS public.draft_page_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_type VARCHAR(50) NOT NULL CHECK (
        section_type IN (
            'hero', 
            'services', 
            'copper', 
            'gallery', 
            'contact', 
            'cta-banner', 
            'faq', 
            'testimonials', 
            'text-image'
        )
    ),
    section_label VARCHAR(100) NOT NULL,
    display_order INTEGER NOT NULL CHECK (display_order >= 0),
    is_visible BOOLEAN NOT NULL DEFAULT true,
    anchor_id VARCHAR(50) NOT NULL CHECK (anchor_id ~ '^[a-z0-9-]+$'),
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    settings JSONB NOT NULL DEFAULT '{"backgroundVariant": "default", "paddingTop": "medium", "paddingBottom": "medium"}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_draft_section_anchor UNIQUE (anchor_id),
    CONSTRAINT uq_draft_section_order UNIQUE (display_order) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_draft_sections_display_order ON public.draft_page_sections(display_order ASC);

-- Step 7: Page Revisions (With Unique Revision Number and Strict Non-Empty Snapshot Check)
CREATE TABLE IF NOT EXISTS public.page_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    revision_number SERIAL UNIQUE,
    snapshot_data JSONB NOT NULL CHECK (
        snapshot_data ? 'version' AND
        snapshot_data ? 'published_at' AND
        jsonb_typeof(snapshot_data->'site_settings') = 'object' AND
        jsonb_typeof(snapshot_data->'page_metadata') = 'object' AND
        jsonb_typeof(snapshot_data->'sections') = 'array' AND
        jsonb_array_length(snapshot_data->'sections') > 0
    ),
    published_by UUID REFERENCES public.admin_profiles(id),
    published_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    notes TEXT DEFAULT 'Published via Visual Page Builder',
    is_active BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_published_revision ON public.page_revisions (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_page_revisions_chronological ON public.page_revisions (published_at DESC);

-- Step 8: Media Assets (Canonical Bucket Relative Path)
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL UNIQUE CHECK (
        storage_path ~ '^uploads/[a-zA-Z0-9_\-\.]+\.(webp|jpe?g|png)$'
    ),
    public_url VARCHAR(500) NOT NULL,
    mime_type VARCHAR(50) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880),
    width INTEGER NOT NULL CHECK (width > 0 AND width <= 8192),
    height INTEGER NOT NULL CHECK (height > 0 AND height <= 8192),
    alt_ar VARCHAR(255) DEFAULT '',
    alt_en VARCHAR(255) DEFAULT '',
    category VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_media_assets_created ON public.media_assets(created_at DESC);

-- Step 9: Automatic Timestamp Triggers
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_timestamp_admin_profiles ON public.admin_profiles;
CREATE TRIGGER trg_timestamp_admin_profiles
    BEFORE UPDATE ON public.admin_profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_timestamp_draft_settings ON public.draft_site_settings;
CREATE TRIGGER trg_timestamp_draft_settings
    BEFORE UPDATE ON public.draft_site_settings
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_timestamp_draft_metadata ON public.draft_page_metadata;
CREATE TRIGGER trg_timestamp_draft_metadata
    BEFORE UPDATE ON public.draft_page_metadata
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_timestamp_draft_sections ON public.draft_page_sections;
CREATE TRIGGER trg_timestamp_draft_sections
    BEFORE UPDATE ON public.draft_page_sections
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Step 10: Prevention of Singleton Deletion Triggers
CREATE OR REPLACE FUNCTION public.fn_prevent_singleton_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'DATABASE INTEGRITY ERROR: Singleton row (id = 1) cannot be deleted.'
        USING ERRCODE = '23505';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_draft_settings ON public.draft_site_settings;
CREATE TRIGGER trg_prevent_delete_draft_settings
    BEFORE DELETE ON public.draft_site_settings
    FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_singleton_deletion();

DROP TRIGGER IF EXISTS trg_prevent_delete_draft_metadata ON public.draft_page_metadata;
CREATE TRIGGER trg_prevent_delete_draft_metadata
    BEFORE DELETE ON public.draft_page_metadata
    FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_singleton_deletion();

-- Step 11: Unified Concurrency Lock Trigger for Direct Draft Mutations
-- Ensures direct DML statements on draft tables cannot bypass the advisory lock
CREATE OR REPLACE FUNCTION public.fn_acquire_workspace_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('mg_home_cms_workspace_lock'));
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_draft_settings ON public.draft_site_settings;
CREATE TRIGGER trg_lock_draft_settings
    BEFORE INSERT OR UPDATE OR DELETE ON public.draft_site_settings
    FOR EACH STATEMENT EXECUTE FUNCTION public.fn_acquire_workspace_lock();

DROP TRIGGER IF EXISTS trg_lock_draft_metadata ON public.draft_page_metadata;
CREATE TRIGGER trg_lock_draft_metadata
    BEFORE INSERT OR UPDATE OR DELETE ON public.draft_page_metadata
    FOR EACH STATEMENT EXECUTE FUNCTION public.fn_acquire_workspace_lock();

DROP TRIGGER IF EXISTS trg_lock_draft_sections ON public.draft_page_sections;
CREATE TRIGGER trg_lock_draft_sections
    BEFORE INSERT OR UPDATE OR DELETE ON public.draft_page_sections
    FOR EACH STATEMENT EXECUTE FUNCTION public.fn_acquire_workspace_lock();

-- Step 12: Seed Singleton Rows
INSERT INTO public.draft_site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.draft_page_metadata (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Step 13: Helper Security Function for Admin AAL2 & Verified TOTP Factor
CREATE OR REPLACE FUNCTION public.is_admin_aal2()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
    v_is_super_admin BOOLEAN := false;
    v_has_aal2 BOOLEAN := false;
    v_has_totp BOOLEAN := false;
BEGIN
    -- 1. Check super admin identity
    SELECT EXISTS (
        SELECT 1 
        FROM public.admin_profiles 
        WHERE id = auth.uid() 
          AND role = 'super_admin'
    ) INTO v_is_super_admin;

    IF NOT v_is_super_admin THEN
        RETURN false;
    END IF;

    -- 2. Check JWT AAL2 level
    v_has_aal2 := (auth.jwt() ->> 'aal' = 'aal2');
    IF NOT v_has_aal2 THEN
        RETURN false;
    END IF;

    -- 3. Check enrolled & verified TOTP factor
    IF to_regclass('auth.mfa_factors') IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 
            FROM auth.mfa_factors 
            WHERE user_id = auth.uid() 
              AND factor_type = 'totp' 
              AND status = 'verified'
        ) INTO v_has_totp;
    ELSE
        -- Fallback to JWT AMR check if auth schema table is mocked or in transition
        v_has_totp := (auth.jwt() -> 'amr' @> '[{"method": "totp"}]'::jsonb OR auth.jwt()::text ~ '"totp"');
    END IF;

    RETURN v_has_aal2 AND v_has_totp;
END;
$$;

-- Step 14: Revoke & Grant SQL Table Privileges
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Public Anon Role
GRANT SELECT ON public.page_revisions TO anon;
GRANT SELECT ON public.media_assets TO anon;

-- Authenticated Role (Admin Studio)
GRANT SELECT ON public.admin_profiles TO authenticated;
GRANT SELECT, UPDATE ON public.draft_site_settings TO authenticated;
GRANT SELECT, UPDATE ON public.draft_page_metadata TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.draft_page_sections TO authenticated;
GRANT SELECT ON public.page_revisions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.page_revisions_revision_number_seq TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.media_assets TO authenticated;

-- Step 15: Enable Row Level Security (RLS)
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_page_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- 1. Admin Profiles
DROP POLICY IF EXISTS "admin_profiles_view_own" ON public.admin_profiles;
CREATE POLICY "admin_profiles_view_own" 
ON public.admin_profiles FOR SELECT 
TO authenticated 
USING (id = auth.uid());

-- 2. Draft Settings (Admin AAL2 Only)
DROP POLICY IF EXISTS "draft_settings_admin_select" ON public.draft_site_settings;
CREATE POLICY "draft_settings_admin_select" 
ON public.draft_site_settings FOR SELECT 
TO authenticated 
USING (public.is_admin_aal2());

DROP POLICY IF EXISTS "draft_settings_admin_update" ON public.draft_site_settings;
CREATE POLICY "draft_settings_admin_update" 
ON public.draft_site_settings FOR UPDATE 
TO authenticated 
USING (public.is_admin_aal2())
WITH CHECK (public.is_admin_aal2());

-- 3. Draft Metadata (Admin AAL2 Only)
DROP POLICY IF EXISTS "draft_metadata_admin_select" ON public.draft_page_metadata;
CREATE POLICY "draft_metadata_admin_select" 
ON public.draft_page_metadata FOR SELECT 
TO authenticated 
USING (public.is_admin_aal2());

DROP POLICY IF EXISTS "draft_metadata_admin_update" ON public.draft_page_metadata;
CREATE POLICY "draft_metadata_admin_update" 
ON public.draft_page_metadata FOR UPDATE 
TO authenticated 
USING (public.is_admin_aal2())
WITH CHECK (public.is_admin_aal2());

-- 4. Draft Sections (Admin AAL2 Only)
DROP POLICY IF EXISTS "draft_sections_admin_select" ON public.draft_page_sections;
CREATE POLICY "draft_sections_admin_select" 
ON public.draft_page_sections FOR SELECT 
TO authenticated 
USING (public.is_admin_aal2());

DROP POLICY IF EXISTS "draft_sections_admin_insert" ON public.draft_page_sections;
CREATE POLICY "draft_sections_admin_insert" 
ON public.draft_page_sections FOR INSERT 
TO authenticated 
WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "draft_sections_admin_update" ON public.draft_page_sections;
CREATE POLICY "draft_sections_admin_update" 
ON public.draft_page_sections FOR UPDATE 
TO authenticated 
USING (public.is_admin_aal2())
WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "draft_sections_admin_delete" ON public.draft_page_sections;
CREATE POLICY "draft_sections_admin_delete" 
ON public.draft_page_sections FOR DELETE 
TO authenticated 
USING (public.is_admin_aal2());

-- 5. Page Revisions (Public reads active; Admin reads all; direct DML prohibited)
DROP POLICY IF EXISTS "revisions_public_read_active" ON public.page_revisions;
CREATE POLICY "revisions_public_read_active" 
ON public.page_revisions FOR SELECT 
TO anon 
USING (is_active = true);

DROP POLICY IF EXISTS "revisions_admin_read_all" ON public.page_revisions;
CREATE POLICY "revisions_admin_read_all" 
ON public.page_revisions FOR SELECT 
TO authenticated 
USING (public.is_admin_aal2());

DROP POLICY IF EXISTS "revisions_prohibit_direct_insert" ON public.page_revisions;
CREATE POLICY "revisions_prohibit_direct_insert" 
ON public.page_revisions FOR INSERT 
TO authenticated 
WITH CHECK (false);

DROP POLICY IF EXISTS "revisions_prohibit_direct_update" ON public.page_revisions;
CREATE POLICY "revisions_prohibit_direct_update" 
ON public.page_revisions FOR UPDATE 
TO authenticated 
USING (false);

DROP POLICY IF EXISTS "revisions_prohibit_direct_delete" ON public.page_revisions;
CREATE POLICY "revisions_prohibit_direct_delete" 
ON public.page_revisions FOR DELETE 
TO authenticated 
USING (false);

-- 6. Media Assets
DROP POLICY IF EXISTS "media_assets_public_read" ON public.media_assets;
CREATE POLICY "media_assets_public_read" 
ON public.media_assets FOR SELECT 
TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "media_assets_admin_insert" ON public.media_assets;
CREATE POLICY "media_assets_admin_insert" 
ON public.media_assets FOR INSERT 
TO authenticated 
WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "media_assets_admin_delete" ON public.media_assets;
CREATE POLICY "media_assets_admin_delete" 
ON public.media_assets FOR DELETE 
TO authenticated 
USING (public.is_admin_aal2());

-- Step 16: Section Reordering RPC (Strict Validation: No Duplicates, No Unknowns, No Missing)
CREATE OR REPLACE FUNCTION public.reorder_draft_sections(
    p_ordered_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_total_existing INTEGER;
    v_provided_count INTEGER;
    v_distinct_provided_count INTEGER;
    v_matching_existing_count INTEGER;
    v_id UUID;
    v_index INTEGER := 10;
BEGIN
    IF NOT public.is_admin_aal2() THEN
        RAISE EXCEPTION 'ACCESS DENIED: Section reordering requires an active AAL2 administrative session.'
            USING ERRCODE = '42501';
    END IF;

    -- Concurrency Lock
    PERFORM pg_advisory_xact_lock(hashtext('mg_home_cms_workspace_lock'));

    IF p_ordered_ids IS NULL OR array_length(p_ordered_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'VALIDATION ERROR: p_ordered_ids array cannot be null or empty.'
            USING ERRCODE = '22000';
    END IF;

    v_provided_count := array_length(p_ordered_ids, 1);

    -- 1. Check for duplicate IDs in the provided array
    SELECT COUNT(DISTINCT id) INTO v_distinct_provided_count
    FROM unnest(p_ordered_ids) AS id;

    IF v_distinct_provided_count <> v_provided_count THEN
        RAISE EXCEPTION 'VALIDATION ERROR: Duplicate section IDs detected in reorder payload.'
            USING ERRCODE = '22000';
    END IF;

    -- 2. Count existing sections in draft
    SELECT COUNT(*) INTO v_total_existing
    FROM public.draft_page_sections;

    -- 3. Count matching existing sections
    SELECT COUNT(*) INTO v_matching_existing_count
    FROM public.draft_page_sections s
    WHERE s.id = ANY(p_ordered_ids);

    -- 4. Check for unknown IDs
    IF v_matching_existing_count < v_provided_count THEN
        RAISE EXCEPTION 'VALIDATION ERROR: Unknown section ID(s) provided that do not exist in draft sections.'
            USING ERRCODE = '22000';
    END IF;

    -- 5. Check that every existing section is present (no omissions)
    IF v_matching_existing_count <> v_total_existing OR v_provided_count <> v_total_existing THEN
        RAISE EXCEPTION 'VALIDATION ERROR: Every existing draft section must appear exactly once in the reorder payload (expected %, got %).',
            v_total_existing, v_provided_count
            USING ERRCODE = '22000';
    END IF;

    -- Apply new display_order sequentially
    FOREACH v_id IN ARRAY p_ordered_ids
    LOOP
        UPDATE public.draft_page_sections
        SET display_order = v_index,
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = v_id;
        v_index := v_index + 10;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'sections_reordered', v_provided_count
    );
END;
$$;

-- Step 17: Hardened Publishing RPC (Validates Complete Workspace Integrity)
CREATE OR REPLACE FUNCTION public.publish_page_revision(
    p_notes TEXT DEFAULT 'Published via Visual Page Builder'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_snapshot JSONB;
    v_new_revision_id UUID;
    v_revision_number INTEGER;
    v_total_sections INTEGER;
    v_visible_sections INTEGER;
    v_site_settings RECORD;
    v_page_metadata RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL OR NOT public.is_admin_aal2() THEN
        RAISE EXCEPTION 'ACCESS DENIED: Publishing requires an active AAL2 (TOTP MFA) session.'
            USING ERRCODE = '42501';
    END IF;

    -- Concurrency Lock
    PERFORM pg_advisory_xact_lock(hashtext('mg_home_cms_workspace_lock'));

    -- Lock and validate draft site settings
    SELECT * INTO v_site_settings FROM public.draft_site_settings WHERE id = 1 FOR UPDATE;
    IF v_site_settings IS NULL OR v_site_settings.local_phone IS NULL OR LENGTH(TRIM(v_site_settings.local_phone)) = 0 THEN
        RAISE EXCEPTION 'VALIDATION ERROR: Draft site settings are missing or contain an invalid phone number.'
            USING ERRCODE = '22000';
    END IF;

    -- Lock and validate draft page metadata
    SELECT * INTO v_page_metadata FROM public.draft_page_metadata WHERE id = 1 FOR UPDATE;
    IF v_page_metadata IS NULL OR v_page_metadata.title_ar IS NULL OR LENGTH(TRIM(v_page_metadata.title_ar)) = 0 THEN
        RAISE EXCEPTION 'VALIDATION ERROR: Draft page metadata is missing or contains an empty Arabic title.'
            USING ERRCODE = '22000';
    END IF;

    -- Validate sections
    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_visible = true)
    INTO v_total_sections, v_visible_sections
    FROM public.draft_page_sections;

    IF v_total_sections = 0 THEN
        RAISE EXCEPTION 'VALIDATION ERROR: Cannot publish an empty page. At least one section must exist.'
            USING ERRCODE = '22000';
    END IF;

    IF v_visible_sections = 0 THEN
        RAISE EXCEPTION 'VALIDATION ERROR: Cannot publish with zero visible sections. At least one section must be visible.'
            USING ERRCODE = '22000';
    END IF;

    -- Build snapshot
    SELECT jsonb_build_object(
        'version', '2.3.0',
        'published_at', TIMEZONE('utc', NOW()),
        'published_by', v_user_id,
        'site_settings', row_to_json(v_site_settings),
        'page_metadata', row_to_json(v_page_metadata),
        'sections', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', sec.id,
                    'type', sec.section_type,
                    'label', sec.section_label,
                    'order', sec.display_order,
                    'isVisible', sec.is_visible,
                    'anchorId', sec.anchor_id,
                    'content', sec.content,
                    'settings', sec.settings
                ) ORDER BY sec.display_order ASC
            ), '[]'::jsonb)
            FROM public.draft_page_sections sec
        )
    ) INTO v_snapshot;

    -- Verify snapshot structure before insertion
    IF NOT (
        v_snapshot ? 'version' AND
        v_snapshot ? 'site_settings' AND
        jsonb_typeof(v_snapshot->'site_settings') = 'object' AND
        v_snapshot ? 'page_metadata' AND
        jsonb_typeof(v_snapshot->'page_metadata') = 'object' AND
        v_snapshot ? 'sections' AND
        jsonb_typeof(v_snapshot->'sections') = 'array' AND
        jsonb_array_length(v_snapshot->'sections') > 0
    ) THEN
        RAISE EXCEPTION 'SNAPSHOT INTEGRITY ERROR: Generated snapshot does not satisfy integrity constraints.'
            USING ERRCODE = '22000';
    END IF;

    -- Deactivate current active revision
    UPDATE public.page_revisions
    SET is_active = false
    WHERE is_active = true;

    -- Insert new active published revision
    INSERT INTO public.page_revisions (
        snapshot_data,
        published_by,
        published_at,
        notes,
        is_active
    ) VALUES (
        v_snapshot,
        v_user_id,
        TIMEZONE('utc', NOW()),
        COALESCE(p_notes, 'Published via Visual Page Builder'),
        true
    ) RETURNING id, revision_number INTO v_new_revision_id, v_revision_number;

    RETURN jsonb_build_object(
        'success', true,
        'revision_id', v_new_revision_id,
        'revision_number', v_revision_number,
        'total_sections', v_total_sections,
        'visible_sections', v_visible_sections,
        'published_at', TIMEZONE('utc', NOW())
    );
END;
$$;

-- Step 18: Hardened Revision Restoration RPC (Safe Pre-Validation Before Any Destruction)
CREATE OR REPLACE FUNCTION public.restore_revision_to_draft(
    p_revision_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_target_snapshot JSONB;
    v_section RECORD;
    v_restored_count INTEGER := 0;
    v_sections_count INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL OR NOT public.is_admin_aal2() THEN
        RAISE EXCEPTION 'ACCESS DENIED: Revision restoration requires an active AAL2 (TOTP MFA) session.'
            USING ERRCODE = '42501';
    END IF;

    -- Concurrency Lock
    PERFORM pg_advisory_xact_lock(hashtext('mg_home_cms_workspace_lock'));

    SELECT snapshot_data INTO v_target_snapshot
    FROM public.page_revisions
    WHERE id = p_revision_id;

    IF v_target_snapshot IS NULL THEN
        RAISE EXCEPTION 'NOT FOUND: Revision with ID % does not exist.', p_revision_id
            USING ERRCODE = '02000';
    END IF;

    -- 1. Pre-validate top-level snapshot schema BEFORE mutating draft tables
    IF NOT (
        v_target_snapshot ? 'version' AND
        v_target_snapshot ? 'site_settings' AND
        jsonb_typeof(v_target_snapshot->'site_settings') = 'object' AND
        v_target_snapshot ? 'page_metadata' AND
        jsonb_typeof(v_target_snapshot->'page_metadata') = 'object' AND
        v_target_snapshot ? 'sections' AND
        jsonb_typeof(v_target_snapshot->'sections') = 'array'
    ) THEN
        RAISE EXCEPTION 'CORRUPT SNAPSHOT: Snapshot data does not conform to the required v2.3.0 schema.'
            USING ERRCODE = '22000';
    END IF;

    v_sections_count := jsonb_array_length(v_target_snapshot->'sections');
    IF v_sections_count = 0 THEN
        RAISE EXCEPTION 'CORRUPT SNAPSHOT: Cannot restore an empty revision with zero sections.'
            USING ERRCODE = '22000';
    END IF;

    -- 2. Pre-validate every section in the snapshot array
    FOR v_section IN SELECT * FROM jsonb_to_recordset(v_target_snapshot->'sections') AS (
        id UUID,
        type VARCHAR,
        label VARCHAR,
        "order" INTEGER,
        isVisible BOOLEAN,
        anchorId VARCHAR,
        content JSONB,
        settings JSONB
    )
    LOOP
        IF v_section.type IS NULL OR v_section.type NOT IN (
            'hero', 'services', 'copper', 'gallery', 'contact', 'cta-banner', 'faq', 'testimonials', 'text-image'
        ) THEN
            RAISE EXCEPTION 'CORRUPT SNAPSHOT: Unrecognized or missing section type (%) in snapshot.', v_section.type
                USING ERRCODE = '22000';
        END IF;
    END LOOP;

    -- 3. Lock singleton rows
    PERFORM id FROM public.draft_site_settings WHERE id = 1 FOR UPDATE;
    PERFORM id FROM public.draft_page_metadata WHERE id = 1 FOR UPDATE;

    -- 4. Restore Site Settings safely
    UPDATE public.draft_site_settings
    SET 
        business_name_ar = COALESCE(NULLIF(TRIM(v_target_snapshot->'site_settings'->>'business_name_ar'), ''), business_name_ar),
        business_name_en = COALESCE(NULLIF(TRIM(v_target_snapshot->'site_settings'->>'business_name_en'), ''), business_name_en),
        local_phone = COALESCE(NULLIF(TRIM(v_target_snapshot->'site_settings'->>'local_phone'), ''), local_phone),
        country_code = COALESCE(NULLIF(TRIM(v_target_snapshot->'site_settings'->>'country_code'), ''), country_code),
        is_country_code_confirmed = CASE 
            WHEN (v_target_snapshot->'site_settings'->>'is_country_code_confirmed') = 'false' THEN false 
            ELSE true 
        END,
        instagram_url = COALESCE(NULLIF(TRIM(v_target_snapshot->'site_settings'->>'instagram_url'), ''), instagram_url),
        instagram_handle = COALESCE(NULLIF(TRIM(v_target_snapshot->'site_settings'->>'instagram_handle'), ''), instagram_handle),
        facebook_url = COALESCE(NULLIF(TRIM(v_target_snapshot->'site_settings'->>'facebook_url'), ''), facebook_url),
        service_messages_ar = CASE 
            WHEN jsonb_typeof(v_target_snapshot->'site_settings'->'service_messages_ar') = 'object' 
            THEN v_target_snapshot->'site_settings'->'service_messages_ar' 
            ELSE service_messages_ar 
        END,
        service_messages_en = CASE 
            WHEN jsonb_typeof(v_target_snapshot->'site_settings'->'service_messages_en') = 'object' 
            THEN v_target_snapshot->'site_settings'->'service_messages_en' 
            ELSE service_messages_en 
        END,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = 1;

    -- 5. Restore Page Metadata safely
    UPDATE public.draft_page_metadata
    SET
        title_ar = COALESCE(NULLIF(TRIM(v_target_snapshot->'page_metadata'->>'title_ar'), ''), title_ar),
        title_en = COALESCE(NULLIF(TRIM(v_target_snapshot->'page_metadata'->>'title_en'), ''), title_en),
        meta_description_ar = COALESCE(NULLIF(TRIM(v_target_snapshot->'page_metadata'->>'meta_description_ar'), ''), meta_description_ar),
        meta_description_en = COALESCE(NULLIF(TRIM(v_target_snapshot->'page_metadata'->>'meta_description_en'), ''), meta_description_en),
        og_image_url = COALESCE(NULLIF(TRIM(v_target_snapshot->'page_metadata'->>'og_image_url'), ''), og_image_url),
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = 1;

    -- 6. Repopulate draft sections
    DELETE FROM public.draft_page_sections;

    FOR v_section IN SELECT * FROM jsonb_to_recordset(v_target_snapshot->'sections') AS (
        id UUID,
        type VARCHAR,
        label VARCHAR,
        "order" INTEGER,
        isVisible BOOLEAN,
        anchorId VARCHAR,
        content JSONB,
        settings JSONB
    )
    LOOP
        INSERT INTO public.draft_page_sections (
            id,
            section_type,
            section_label,
            display_order,
            is_visible,
            anchor_id,
            content,
            settings
        ) VALUES (
            COALESCE(v_section.id, uuid_generate_v4()),
            v_section.type,
            COALESCE(NULLIF(TRIM(v_section.label), ''), 'Section ' || (v_restored_count + 1)),
            COALESCE(v_section."order", (v_restored_count + 1) * 10),
            COALESCE(v_section.isVisible, true),
            LOWER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(v_section.anchorId), ''), 'sec-' || SUBSTRING(uuid_generate_v4()::text, 1, 8)), '[^a-z0-9-]', '-', 'g')),
            COALESCE(CASE WHEN jsonb_typeof(v_section.content) = 'object' THEN v_section.content ELSE NULL END, '{}'::jsonb),
            COALESCE(CASE WHEN jsonb_typeof(v_section.settings) = 'object' THEN v_section.settings ELSE NULL END, '{"backgroundVariant": "default", "paddingTop": "medium", "paddingBottom": "medium"}'::jsonb)
        );
        v_restored_count := v_restored_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'restored_from_revision', p_revision_id,
        'sections_restored', v_restored_count,
        'message', 'Draft workspace repopulated successfully.'
    );
END;
$$;

-- Step 19: Trusted Server-Side Image Magic Number & Signature Validation RPC
CREATE OR REPLACE FUNCTION public.validate_and_register_media_asset(
    p_file_name TEXT,
    p_storage_path TEXT,
    p_public_url TEXT,
    p_mime_type TEXT,
    p_file_size_bytes INTEGER,
    p_header_bytes BYTEA,
    p_width INTEGER,
    p_height INTEGER,
    p_alt_ar TEXT DEFAULT '',
    p_alt_en TEXT DEFAULT '',
    p_category TEXT DEFAULT 'general'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_new_id UUID;
    v_is_valid_magic BOOLEAN := false;
BEGIN
    -- 1. Check Admin AAL2 session
    IF NOT public.is_admin_aal2() THEN
        RAISE EXCEPTION 'ACCESS DENIED: Media registration requires an active AAL2 administrative session.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Validate storage path pattern
    IF p_storage_path IS NULL OR NOT (p_storage_path ~ '^uploads/[a-zA-Z0-9_\-\.]+\.(webp|jpe?g|png)$') THEN
        RAISE EXCEPTION 'VALIDATION ERROR: Invalid storage path. Must match uploads/<filename>.<ext>.'
            USING ERRCODE = '22000';
    END IF;

    -- 3. Validate file size (1 byte to 5MB)
    IF p_file_size_bytes IS NULL OR p_file_size_bytes <= 0 OR p_file_size_bytes > 5242880 THEN
        RAISE EXCEPTION 'VALIDATION ERROR: File size must be between 1 byte and 5MB (got % bytes).'
            USING ERRCODE = '22000';
    END IF;

    -- 4. Validate image dimensions (1px to 8192px)
    IF p_width IS NULL OR p_width <= 0 OR p_width > 8192 OR
       p_height IS NULL OR p_height <= 0 OR p_height > 8192 THEN
        RAISE EXCEPTION 'VALIDATION ERROR: Image dimensions must be between 1x1 and 8192x8192.'
            USING ERRCODE = '22000';
    END IF;

    -- 5. Binary Magic Number Signature Verification
    -- JPEG: starts with 0xFF 0xD8 0xFF
    -- PNG:  starts with 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    -- WebP: starts with 0x52 0x49 0x46 0x46 (RIFF), followed by 4 bytes size, then 0x57 0x45 0x42 0x50 (WEBP)
    IF p_header_bytes IS NULL OR length(p_header_bytes) < 12 THEN
        RAISE EXCEPTION 'VALIDATION ERROR: Binary header bytes (at least 12 bytes) required for signature verification.'
            USING ERRCODE = '22000';
    END IF;

    IF p_mime_type = 'image/jpeg' THEN
        -- Check JPEG SOI marker: FF D8 FF
        IF substring(p_header_bytes from 1 for 3) = E'\\xFF\\xD8\\xFF'::bytea THEN
            v_is_valid_magic := true;
        END IF;
    ELSIF p_mime_type = 'image/png' THEN
        -- Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
        IF substring(p_header_bytes from 1 for 8) = E'\\x89PNG\\r\\n\\x1a\\n'::bytea THEN
            v_is_valid_magic := true;
        END IF;
    ELSIF p_mime_type = 'image/webp' THEN
        -- Check RIFF header and WEBP chunk type
        IF substring(p_header_bytes from 1 for 4) = E'RIFF'::bytea AND
           substring(p_header_bytes from 9 for 4) = E'WEBP'::bytea THEN
            v_is_valid_magic := true;
        END IF;
    ELSE
        RAISE EXCEPTION 'VALIDATION ERROR: Unsupported MIME type %. Allowed: image/jpeg, image/png, image/webp.', p_mime_type
            USING ERRCODE = '22000';
    END IF;

    IF NOT v_is_valid_magic THEN
        RAISE EXCEPTION 'SECURITY ERROR: File magic header signature does not match claimed MIME type %.', p_mime_type
            USING ERRCODE = '22000';
    END IF;

    -- 6. Insert verified media record
    INSERT INTO public.media_assets (
        file_name,
        storage_path,
        public_url,
        mime_type,
        file_size_bytes,
        width,
        height,
        alt_ar,
        alt_en,
        category
    ) VALUES (
        p_file_name,
        p_storage_path,
        p_public_url,
        p_mime_type,
        p_file_size_bytes,
        p_width,
        p_height,
        COALESCE(p_alt_ar, ''),
        COALESCE(p_alt_en, ''),
        COALESCE(p_category, 'general')
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'success', true,
        'asset_id', v_new_id,
        'storage_path', p_storage_path,
        'public_url', p_public_url,
        'verified_mime_type', p_mime_type
    );
END;
$$;

-- Step 20: Explicit EXECUTE Privileges for Every Helper and RPC
-- Revoke all function execution from PUBLIC and anon
REVOKE ALL ON FUNCTION public.fn_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_prevent_singleton_deletion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_enforce_single_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_handle_new_admin_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_acquire_workspace_lock() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_admin_aal2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_aal2() TO authenticated;

REVOKE ALL ON FUNCTION public.reorder_draft_sections(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_draft_sections(UUID[]) TO authenticated;

REVOKE ALL ON FUNCTION public.publish_page_revision(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_page_revision(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_revision_to_draft(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_revision_to_draft(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_and_register_media_asset(TEXT, TEXT, TEXT, TEXT, INTEGER, BYTEA, INTEGER, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_and_register_media_asset(TEXT, TEXT, TEXT, TEXT, INTEGER, BYTEA, INTEGER, INTEGER, TEXT, TEXT, TEXT) TO authenticated;

-- Step 21: Storage Bucket Configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'media-library',
    'media-library',
    true,
    5242880,
    ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png'],
    file_size_limit = 5242880;

DROP POLICY IF EXISTS "media_library_public_read" ON storage.objects;
CREATE POLICY "media_library_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
    bucket_id = 'media-library'
    AND EXISTS (
        SELECT 1 FROM public.media_assets
        WHERE storage_path = name
    )
);

DROP POLICY IF EXISTS "media_library_admin_upload" ON storage.objects;
CREATE POLICY "media_library_admin_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'media-library' 
    AND public.is_admin_aal2()
);

DROP POLICY IF EXISTS "media_library_admin_delete" ON storage.objects;
CREATE POLICY "media_library_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'media-library' 
    AND public.is_admin_aal2()
);
