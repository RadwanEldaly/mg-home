-- ============================================================================
-- MG HOME CMS — Production Database Migration (v2.3.0)
-- File: supabase/migrations/20261119000001_initial_schema_v2_3_0.sql
-- ============================================================================

-- Step 1: Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 2: Global Privilege Hardening
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- Step 3: Admin Profiles Table (Single Admin Identity)
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'super_admin' CHECK (role = 'super_admin'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

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

-- Step 7: Page Revisions (With Unique Revision Number)
CREATE TABLE IF NOT EXISTS public.page_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    revision_number SERIAL UNIQUE,
    snapshot_data JSONB NOT NULL CHECK (
        snapshot_data ? 'version' AND
        snapshot_data ? 'published_at' AND
        snapshot_data ? 'site_settings' AND
        snapshot_data ? 'page_metadata' AND
        snapshot_data ? 'sections' AND
        jsonb_typeof(snapshot_data->'sections') = 'array'
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
    width INTEGER CHECK (width IS NULL OR width > 0),
    height INTEGER CHECK (height IS NULL OR height > 0),
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

-- Step 11: Seed Singleton Rows
INSERT INTO public.draft_site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.draft_page_metadata (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Step 12: Helper Security Function for Admin AAL2
CREATE OR REPLACE FUNCTION public.is_admin_aal2()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT 
        (auth.jwt() ->> 'aal' = 'aal2') AND
        EXISTS (
            SELECT 1 
            FROM public.admin_profiles 
            WHERE id = auth.uid() 
              AND role = 'super_admin'
        );
$$;

-- Step 13: Revoke & Grant SQL Privileges
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

-- Step 14: Enable Row Level Security (RLS)
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

-- 5. Page Revisions (Public reads active; Admin reads all; mutations strictly via RPC)
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

-- Step 15: Section Reordering RPC (Transactional Drag-and-Drop)
CREATE OR REPLACE FUNCTION public.reorder_draft_sections(
    p_ordered_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_id UUID;
    v_index INTEGER := 10;
BEGIN
    IF NOT public.is_admin_aal2() THEN
        RAISE EXCEPTION 'ACCESS DENIED: Section reordering requires an active AAL2 administrative session.'
            USING ERRCODE = '42501';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('mg_home_cms_workspace_lock'));

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
        'sections_reordered', array_length(p_ordered_ids, 1)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_draft_sections(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_draft_sections(UUID[]) TO authenticated;

-- Step 16: Hardened Publishing RPC (All sections captured, AAL2 required)
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
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL OR NOT public.is_admin_aal2() THEN
        RAISE EXCEPTION 'ACCESS DENIED: Publishing requires an active AAL2 (TOTP MFA) session.'
            USING ERRCODE = '42501';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('mg_home_cms_workspace_lock'));

    PERFORM id FROM public.draft_site_settings WHERE id = 1 FOR UPDATE;
    PERFORM id FROM public.draft_page_metadata WHERE id = 1 FOR UPDATE;

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

    SELECT jsonb_build_object(
        'version', '2.3.0',
        'published_at', TIMEZONE('utc', NOW()),
        'published_by', v_user_id,
        'site_settings', (
            SELECT row_to_json(s) 
            FROM public.draft_site_settings s 
            WHERE s.id = 1
        ),
        'page_metadata', (
            SELECT row_to_json(m) 
            FROM public.draft_page_metadata m 
            WHERE m.id = 1
        ),
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

    UPDATE public.page_revisions
    SET is_active = false
    WHERE is_active = true;

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
        COALESCE(p_notes, 'Published via CMS'),
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

REVOKE ALL ON FUNCTION public.publish_page_revision(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_page_revision(TEXT) TO authenticated;

-- Step 17: Hardened Revision Restoration RPC
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
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL OR NOT public.is_admin_aal2() THEN
        RAISE EXCEPTION 'ACCESS DENIED: Revision restoration requires an active AAL2 (TOTP MFA) session.'
            USING ERRCODE = '42501';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('mg_home_cms_workspace_lock'));

    SELECT snapshot_data INTO v_target_snapshot
    FROM public.page_revisions
    WHERE id = p_revision_id;

    IF v_target_snapshot IS NULL THEN
        RAISE EXCEPTION 'NOT FOUND: Revision with ID % does not exist.', p_revision_id
            USING ERRCODE = '02000';
    END IF;

    IF NOT (
        v_target_snapshot ? 'version' AND
        v_target_snapshot ? 'site_settings' AND
        v_target_snapshot ? 'page_metadata' AND
        v_target_snapshot ? 'sections' AND
        jsonb_typeof(v_target_snapshot->'sections') = 'array'
    ) THEN
        RAISE EXCEPTION 'CORRUPT SNAPSHOT: Snapshot data does not conform to the required v2 schema.'
            USING ERRCODE = '22000';
    END IF;

    PERFORM id FROM public.draft_site_settings WHERE id = 1 FOR UPDATE;
    PERFORM id FROM public.draft_page_metadata WHERE id = 1 FOR UPDATE;

    UPDATE public.draft_site_settings
    SET 
        business_name_ar = COALESCE(v_target_snapshot->'site_settings'->>'business_name_ar', business_name_ar),
        business_name_en = COALESCE(v_target_snapshot->'site_settings'->>'business_name_en', business_name_en),
        local_phone = COALESCE(v_target_snapshot->'site_settings'->>'local_phone', local_phone),
        country_code = COALESCE(v_target_snapshot->'site_settings'->>'country_code', country_code),
        is_country_code_confirmed = COALESCE((v_target_snapshot->'site_settings'->>'is_country_code_confirmed')::boolean, is_country_code_confirmed),
        instagram_url = COALESCE(v_target_snapshot->'site_settings'->>'instagram_url', instagram_url),
        instagram_handle = COALESCE(v_target_snapshot->'site_settings'->>'instagram_handle', instagram_handle),
        facebook_url = COALESCE(v_target_snapshot->'site_settings'->>'facebook_url', facebook_url),
        service_messages_ar = COALESCE(v_target_snapshot->'site_settings'->'service_messages_ar', service_messages_ar),
        service_messages_en = COALESCE(v_target_snapshot->'site_settings'->'service_messages_en', service_messages_en),
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = 1;

    UPDATE public.draft_page_metadata
    SET
        title_ar = COALESCE(v_target_snapshot->'page_metadata'->>'title_ar', title_ar),
        title_en = COALESCE(v_target_snapshot->'page_metadata'->>'title_en', title_en),
        meta_description_ar = COALESCE(v_target_snapshot->'page_metadata'->>'meta_description_ar', meta_description_ar),
        meta_description_en = COALESCE(v_target_snapshot->'page_metadata'->>'meta_description_en', meta_description_en),
        og_image_url = COALESCE(v_target_snapshot->'page_metadata'->>'og_image_url', og_image_url),
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = 1;

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
            COALESCE(v_section.label, 'Section'),
            COALESCE(v_section."order", v_restored_count * 10),
            COALESCE(v_section.isVisible, true),
            COALESCE(v_section.anchorId, 'sec-' || SUBSTRING(uuid_generate_v4()::text, 1, 8)),
            COALESCE(v_section.content, '{}'::jsonb),
            COALESCE(v_section.settings, '{}'::jsonb)
        );
        v_restored_count := v_restored_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'restored_from_revision', p_revision_id,
        'sections_restored', v_restored_count,
        'message', 'Draft workspace repopulated successfully. Review in preview before explicitly publishing.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_revision_to_draft(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_revision_to_draft(UUID) TO authenticated;

-- Step 18: Storage Bucket Configuration
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
USING (bucket_id = 'media-library');

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
