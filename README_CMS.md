# MG HOME — Custom CMS & Visual Page Builder (Phase 03.5 Implementation)

This repository contains the engineering implementation and security closure of the **MG HOME Custom CMS & Visual Page Builder** (v2.3.0 / Phase 03.5: MFA Consistency & Public Storage Audit).

---

## 🏗️ Architecture Overview

The system strictly adheres to the approved single-page, single-admin architecture:

1. **Public Website (`/`)**:
   - Built with **Vanilla HTML, CSS, JavaScript**.
   - Zero framework overhead; maximum Core Web Vitals speed and SEO preservation.
   - Preserves all Google Tag Manager (`GTM-KVDSVFG5`) and Google Ads conversion tags (`AW-18574001849`).
   - Powered by `js/cms-client.js`:
     - Reads the active published revision snapshot from Supabase PostgREST with a strict 1500ms timeout.
     - Gracefully falls back to pre-rendered static HTML if offline or unconfigured (zero blank screens).
     - Supports live sandboxed `postMessage` preview mode (`?preview_mode=true`).

2. **Admin Studio (`admin/`)**:
   - Built with **React 19, TypeScript, Vite, Tailwind CSS, and @dnd-kit**.
   - 3-Panel Visual Page Builder layout:
     - **Left Panel**: Reorderable outline tree (drag-and-drop) & section library.
     - **Center Canvas**: Responsive device frame (Desktop, Tablet 768px, Mobile 375px) with Design Editor & Live Iframe view.
     - **Right Inspector**: Bilingual property inspector (Arabic RTL / English LTR), styling, padding, and content editing.
   - 30-step undo/redo state stack.
   - Single-admin authentication with mandatory TOTP MFA (AAL2) — zero hardcoded credentials or local storage authorization bypasses.
   - Atomic draft persistence via transactional server-side RPC `save_draft_page_transaction`.
   - Atomic publishing and full rollback/restore support.

3. **Backend & Database (`supabase/migrations/`)**:
   - `20261119000001_initial_schema_v2_3_0.sql`
   - Complete draft and published snapshot isolation:
     - Draft tables (`draft_site_settings`, `draft_page_metadata`, `draft_page_sections`) are 100% private.
     - `page_revisions` stores immutable JSONB snapshots of published states.
     - Hardened RPCs with unified workspace advisory lock (`hashtext('mg_home_cms_workspace_lock')`): `save_draft_page_transaction`, `publish_page_revision`, `restore_revision_to_draft`, `reorder_draft_sections`.
     - Explicit `GRANT`/`REVOKE` matrix preventing anonymous draft leakage.
     - Single-admin database constraint enforced at schema and trigger level (`uq_admin_profiles_singleton`).
     - Untrusted `validate_and_register_media_asset` RPC permanently dropped.

4. **Storage Security Closure, MFA Parity & Complete Write Isolation**:
   - Direct-to-storage client uploads and mutations have been completely eliminated:
     - All `INSERT`, `UPDATE`, and `DELETE` policies on `storage.objects` for `authenticated` and `anon` roles have been removed.
     - Direct client upload bypasses fail with PostgreSQL RLS violation.
   - The bucket `media-library` is configured for high-speed public CDN delivery of static assets.
   - **Write Isolation Guarantee**: The ONLY path that can write to `media-library` is the trusted Edge Function (`validate-image`) using `service_role`.
   - **MFA Consistency & Parity**: The Edge Function enforces identical authorization guarantees to `public.is_admin_aal2()`:
     - Valid Supabase user session (`auth.getUser()`).
     - Administrative assurance level `aal2` in session JWT claims.
     - Verified `super_admin` role in `admin_profiles` table.
     - Server-side verified TOTP factor via Supabase GoTrue Admin MFA API (`supabaseAdmin.auth.admin.mfa.listFactors({ userId })`), requiring at least one enrolled factor where `factor_type = 'totp'` and `status = 'verified'`. Client-provided claims are never trusted blindly.
   - The Edge Function validates:
     - Binary magic bytes in server memory (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `RIFF...WEBP` for WebP).
     - Decodes true image dimensions from chunk headers (SOF0/SOF2, IHDR, VP8/VP8L/VP8X).
     - Rejects forged headers, oversized files (> 5MB), and corrupt payloads *before* writing to storage.
     - Automatically rolls back and deletes storage objects if database registration fails.

---

## 🔒 Safe Initial Admin Provisioning Procedure

Automatic promotion triggers on sign-up have been permanently removed to eliminate public registration privilege escalation. Follow this explicit procedure to provision the administrator:

### Step 1: Create Auth User
In your Supabase project:
1. Navigate to **Authentication** > **Users** in the Supabase Dashboard.
2. Click **Add User** > **Create User**.
3. Enter the administrator's authorized email (e.g. `admin@mg-home.online`) and a strong temporary password.
4. Copy the resulting `User UID` (UUID).

### Step 2: Execute Provisioning RPC (Service Role Only)
In the Supabase **SQL Editor**, run the following statement (replacing the UUID with your administrator's UID):

```sql
SELECT public.provision_initial_admin(
    '00000000-0000-0000-0000-000000000000'::uuid, -- Replace with actual User UID
    'Radwan Eldaly'                               -- Administrator Full Name
);
```

> **Security Note**: `provision_initial_admin` has execution revoked from `PUBLIC`, `anon`, and `authenticated`. It can only be executed by `service_role` or database superusers. It verifies that the user exists in `auth.users` and enforces the single-admin database constraint (`uq_admin_profiles_singleton`).

### Step 3: First Login & TOTP MFA Setup
1. Open the Admin Studio portal (`http://localhost:5173` or your production studio URL).
2. Enter the administrator's email and password.
3. The system detects that no TOTP factor is verified and initiates MFA enrollment:
   - A QR code and manual secret key are displayed on screen.
   - Scan the QR code using Google Authenticator, 1Password, or any standard TOTP app.
   - Enter the generated 6-digit code to confirm and activate the factor.
4. The Supabase session is upgraded to **AAL2**. The admin profile is validated and access to the Studio is granted.

---

## 🔍 Public Storage Security Audit & Staging Cleanup Procedure

### 1. Analysis of Supabase Public Storage & CDN Architecture
In Supabase Storage, the `media-library` bucket is configured with `public = true` to serve static website assets (hero banners, service icons, gallery images) with optimal cacheability and latency.

- **Public CDN URL Behavior**: Direct requests to `https://<project-ref>.supabase.co/storage/v1/object/public/media-library/<path>` are served directly by the Supabase Storage CDN/API gateway. These public GET requests **bypass PostgreSQL Row Level Security (RLS)** completely.
- **Role of SELECT RLS Policy**: The `media_library_public_read` SELECT policy on `storage.objects` strictly controls PostgREST database queries (e.g. `supabase.storage.from('media-library').list()`). It filters catalog listings so that only objects registered in `public.media_assets` are returned. However, if an attacker knows or discovers a direct public path of an unindexed object, CDN access is permitted by design of public buckets.
- **Write Isolation is the Sole Security Boundary**: Because CDN reads cannot be restricted by RLS on public buckets, security is achieved via **absolute write isolation**:
  1. ALL direct `INSERT`, `UPDATE`, and `DELETE` policies for `anon` and `authenticated` roles are DROPPED.
  2. No client can upload, overwrite, or delete objects directly.
  3. The ONLY authorized writer is the trusted Edge Function (`validate-image`), which executes with `service_role`.
  4. The Edge Function inspects file magic bytes and validates image headers in server memory before any bytes reach storage.
  5. If database catalog insertion fails, the Edge Function deletes the object immediately, ensuring zero orphaned objects are created going forward.

### 2. Staging Existing-Object Risk & Audit
During early development iterations (prior to Phase 03.4 write isolation), manual testing or direct client uploads may have placed unverified or orphaned objects inside the `media-library` bucket. These objects remain accessible if their URL is discovered.

To identify and audit all orphaned objects on your Supabase Staging project, execute the following SQL in the Supabase **SQL Editor**:

```sql
-- STEP 1: Audit query to discover orphaned objects in staging media-library
SELECT 
    id, 
    name, 
    bucket_id, 
    created_at, 
    (metadata->>'size')::bigint AS size_bytes,
    (metadata->>'mimetype') AS mime_type
FROM storage.objects
WHERE bucket_id = 'media-library'
  AND name NOT IN (
      SELECT storage_path 
      FROM public.media_assets
  );
```

### 3. Safe Staging Cleanup Procedure (Staging Only)
> [!CAUTION]
> **STAGING ENVIRONMENT ONLY**: Never execute mass deletion scripts on production without first verifying if existing legacy pages reference static paths!

To clean up all untrusted, unindexed, or test files on Staging:

```sql
-- STEP 2: Safe cleanup of orphaned objects on Staging ONLY
-- Run inside an explicit transaction to verify affected count before committing
BEGIN;

DELETE FROM storage.objects
WHERE bucket_id = 'media-library'
  AND name NOT IN (
      SELECT storage_path 
      FROM public.media_assets
  );

-- Verify the number of deleted rows matches expectations, then commit:
COMMIT;
```

---

## 🚀 Getting Started

### 1. Database Setup (Supabase)
1. Open your Supabase project dashboard.
2. Navigate to **SQL Editor**.
3. Run the SQL migration script:
   [`supabase/migrations/20261119000001_initial_schema_v2_3_0.sql`](supabase/migrations/20261119000001_initial_schema_v2_3_0.sql)

### 2. Admin Dashboard Setup
1. Enter the `admin/` directory:
   ```bash
   cd admin
   ```
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Install dependencies and start the development server:
   ```bash
   npm install
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

### 3. Public Website
Serve the root directory with any HTTP server (e.g. `npx serve`, Live Server, or Vercel). The public site will automatically detect published revisions or run the high-speed static fallback.

---

## 🧪 Comprehensive Test Suite (67 Tests)

```bash
# Run all tests
node --test tests/*.test.mjs
```

### Test Suites Breakdown:
1. **`tests/integration_edge_function_upload.test.mjs` (11 tests)**:
   - **MFA Consistency & Parity**:
     - Rejection: Invalid or expired session rejected with 401.
     - Rejection: AAL1 session rejected with 403 (MFA challenge required).
     - Rejection: AAL2 session without verified TOTP factor rejected with 403.
     - Rejection: Non-admin user rejected with 403 even if AAL2 and TOTP are present.
     - Acceptance: AAL2 with verified TOTP factor and super_admin profile accepted (201).
   - **Storage & RPC Bypass Closure**:
     - Direct authenticated Storage INSERT rejection via PostgreSQL RLS.
     - Direct RPC invocation rejection (`validate_and_register_media_asset` dropped).
     - Forged JPEG header rejection (SOI followed by non-SOF or corrupt payload).
     - Executable upload rejection (`MZ` header disguised as image).
     - Unregistered object hiding via SELECT RLS policy.
     - Failed database registration rollback (immediate storage object deletion).

2. **`tests/integration_draft_persistence_and_locking.test.mjs` (6 tests)**:
   - Concurrency: Unified workspace advisory lock (`hashtext('mg_home_cms_workspace_lock')`).
   - Section additions and deletions synchronization.
   - Reordering RPC validation (monotonic 10-step renumbering).
   - Publishing snapshot captures full draft state including hidden sections.
   - Publishing completely aborts if draft persistence fails.
   - `save_draft_page_transaction` atomic rollback: prevents partial persistence on failure.

3. **`tests/integration_auth_and_mfa.test.mjs` (7 tests)**:
   - Rejects invalid credentials.
   - Authenticates valid user at AAL1 and identifies required MFA factors.
   - Rejects invalid TOTP codes.
   - Upgrades session to AAL2 upon successful challenge.
   - Enforces `super_admin` role validation against `admin_profiles`.
   - Rejects unauthorized users.
   - Verifies session cleanup on logout.

4. **`tests/migration_security.test.mjs` (13 tests)**:
   - Validates SQL migration AST, default privilege hardening, RLS enforcement, single-admin constraints, unified locks, dropping auto-promotion triggers, `provision_initial_admin` privileges, dropping untrusted media RPC, eliminating direct storage write policies, and transactional draft RPC advisory locking.

5. **`tests/media_validation.test.mjs` (7 tests)**:
   - Binary magic signature verification, MIME mismatch detection, file size limits, dimension limits.

6. **`tests/preview_protocol.test.mjs` (5 tests)**:
   - Sandboxed iframe preview handshake, source and origin security validation, message schema validation.

7. **`tests/public_fallback_and_renderers.test.mjs` (5 tests)**:
   - Verifies preservation of Google Tag Manager (`GTM-KVDSVFG5`) and Google Ads (`AW-18574001849`).
   - Verifies all 9 section renderers generate valid DOM strings with tracking attributes.

8. **`tests/reorder_validation.test.mjs` (5 tests)**:
   - Reorder input validation (no duplicates, no unknowns, no omissions, sequential 10-step permutation).

9. **`tests/snapshot_integrity.test.mjs` (8 tests)**:
   - Publishing validation (zero sections, all hidden, missing required fields).
   - Restoration resiliency against missing, null, or malformed fields.

---

## 📋 Explicit Staging-Only Verification Requirements

> [!IMPORTANT]
> The automated test suite validates syntax, contracts, and simulated transactional semantics. **True security approval cannot be granted based on mocked or static tests alone.** The following live tests MUST be performed on a live Supabase Staging project before production cutover:

1. **Clean Database Migration Execution**:
   - Apply `supabase/migrations/20261119000001_initial_schema_v2_3_0.sql` on a fresh Supabase PostgreSQL 15+ instance.
   - Confirm zero syntax errors, zero missing extensions, and proper RLS enablement across all 5 CMS tables and `storage.objects`.

2. **Direct Storage Upload Bypass Attempt (CLI Verification)**:
   - Obtain an authenticated session JWT (with AAL2) for the admin.
   - Issue a direct `POST` request to `https://<staging-project>.supabase.co/storage/v1/object/media-library/test_bypass.jpg` using `curl` with the user JWT (NOT the service role key).
   - **Expected Result**: HTTP 400/403 with `new row violates row-level security policy for table "objects"`.

3. **Direct Media RPC Attempt (CLI Verification)**:
   - Attempt to call `POST https://<staging-project>.supabase.co/rest/v1/rpc/validate_and_register_media_asset` with the user JWT.
   - **Expected Result**: HTTP 404 / `function public.validate_and_register_media_asset does not exist`.

4. **Edge Function Live Deployment & Execution**:
   - Deploy `validate-image` function via `supabase functions deploy validate-image`.
   - Set function secret: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`.
   - Upload a test JPEG photo through the Admin Studio.
   - Confirm:
     - HTTP 201 response.
     - Object appears in Supabase Storage under `uploads/<timestamp>_filename.jpg`.
     - Asset record appears in table `public.media_assets`.

5. **Live TOTP MFA Physical Enrollment**:
   - Perform user sign-up and `provision_initial_admin` execution.
   - Log in to the Admin Studio on Staging.
   - Scan QR code using Google Authenticator on a physical mobile device.
   - Confirm TOTP verification code upgrades session to AAL2.

6. **Live End-to-End Visual Builder Publish Flow**:
   - Open Visual Builder, edit Hero section title and background.
   - Click "Save Draft", verify atomic persistence in database.
   - Click "Publish", verify new active revision created in `page_revisions`.
   - Open public website in an incognito window without login, verify updated title loads within 1500ms.
   - Verify GTM container (`GTM-KVDSVFG5`) and Google Ads (`AW-18574001849`) fire correctly.
