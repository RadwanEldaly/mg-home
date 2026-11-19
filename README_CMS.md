# MG HOME — Custom CMS & Visual Page Builder (Phase 03.9 Implementation)

This repository contains the engineering implementation and security closure of the **MG HOME Custom CMS & Visual Page Builder** (v2.3.0 / Phase 03.9: Staging Safety Closure & Strict Test Harness Hardening).

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
     - **Strict Fail-Closed Helper `public.is_admin_aal2()`**: Queries `auth.mfa_factors` directly for `factor_type = 'totp'` AND `status = 'verified'` with zero fallback to AMR array or regex matching on JWT strings.

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

### 3. Safe Staging Cleanup Procedure (Storage API)
> [!CAUTION]
> **WHY DIRECT SQL `DELETE FROM storage.objects` IS STRICTLY PROHIBITED**:
> In Supabase Storage, deleting records directly from `storage.objects` via SQL removes only the PostgreSQL metadata row. It **does NOT delete the underlying physical binary files** from the storage backend (S3/GCS bucket). This causes physical files to become permanently stranded/orphaned on disk and desynchronizes Supabase Storage metadata.
> 
> Per official Supabase documentation, storage object deletion MUST be performed through the **Supabase Storage API** (`supabase.storage.from('media-library').remove([paths])`).

#### Method A: Using the Hardened Staging Cleanup Tool
A hardened, safe Node.js cleanup script is provided at [`scripts/cleanup_orphaned_media.mjs`](scripts/cleanup_orphaned_media.mjs) featuring:
- **Mandatory Staging Allowlist**: `STAGING_PROJECT_ALLOWLIST` is strictly mandatory. Absolute rejection of Production and arbitrary project references with zero fuzzy fallback.
- **Full Recursive Pagination**: Recursively traverses all nested folders in `media-library` with paginated retrieval.
- **Deterministic Database Pagination**: Enforces `order=storage_path.asc` to guarantee zero skipped records.
- **Recursive Codebase Static Asset Protection**: Recursively scans `index.html`, `js/`, `css/`, `Img/`, `assets/`, `Logo/` and protects both full paths and basenames. Fails closed if repository root cannot be verified.
- **Strict Full-Metadata Report Comparison**: Requires `--report=<report.json>`. Validates `schema_version: '3.9'`, `project_ref`, `target_url`, and compares candidate paths, sizes, and MIME types. Aborts immediately if live storage changed.

```bash
# Step 1: Run audit & generate candidate report (Dry Run - zero deletions)
SUPABASE_URL=https://<staging-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret> \
STAGING_PROJECT_ALLOWLIST=<staging-ref> \
node scripts/cleanup_orphaned_media.mjs

# Step 2: Inspect generated JSON report, then execute safe deletion via Storage API
SUPABASE_URL=https://<staging-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret> \
STAGING_PROJECT_ALLOWLIST=<staging-ref> \
node scripts/cleanup_orphaned_media.mjs \
  --delete \
  --confirm-staging-project=<staging-ref> \
  --report=staging_orphaned_report_<staging-ref>_<timestamp>.json
```

#### Method B: Manual Supabase Storage API Deletion
If performing deletion manually in a Node/TypeScript script or admin tool:
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 1. Identify candidate orphaned paths from SQL audit
const orphanedPaths = ['uploads/unindexed_test_file.jpg'];

// 2. Safely delete from BOTH storage backend and PostgreSQL in sync
const { data, error } = await supabase.storage
  .from('media-library')
  .remove(orphanedPaths);

if (error) console.error('Deletion error:', error);
else console.log('Successfully removed:', data);
```

> [!WARNING]
> Never execute mass deletion scripts on Production without a verified backup and confirmation that legacy static assets are not referenced.

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

## 🧪 Automated Test Suite (79 Tests across 10 Suites) & Test Classifications

```bash
# Run all automated tests
node --test tests/*.test.mjs
```

### Complete Test Classification Breakdown:

> [!NOTE]
> **Technical Honesty & Test Categorization**:
> Local tests run in a Node.js test environment without a live local PostgreSQL daemon. To avoid false confidence, tests are strictly classified into:
> - **Category 1: Static SQL AST & Migration Contract Tests (13 tests)**
> - **Category 2: Pure Unit & Binary Parser Tests (20 tests)**
> - **Category 3: Simulated Interface & State Contract Tests (34 tests)**
> - **Category 4: Staging Safety Guards & Harness Unit Tests (12 tests)**
> - **Category 5: Live Staging Integration Test Suite (`scripts/verify_staging_integration.mjs`)**

#### Category 1: Static SQL AST & Migration Contract Tests (13 tests)
*File: `tests/migration_security.test.mjs`*
- Validates SQL migration AST, default privilege hardening (`REVOKE EXECUTE ... FROM PUBLIC, anon`).
- Verifies database-level single-admin singleton constraint (`uq_admin_profiles_singleton`).
- Verifies direct draft mutation triggers for unified advisory locking (`pg_advisory_xact_lock`).
- Verifies `is_admin_aal2` strict fail-closed check on `auth.mfa_factors` with **zero regex or AMR fallback**.
- Verifies all sensitive RPCs acquire `mg_home_cms_workspace_lock`.
- Verifies explicit `REVOKE`/`GRANT` matrix for all 9 functions/RPCs.
- Verifies permanent dropping of untrusted `validate_and_register_media_asset` RPC.
- Verifies complete removal of direct Storage write policies (`INSERT`/`UPDATE`/`DELETE`).
- Verifies removal of automatic signup promotion triggers.
- Verifies `provision_initial_admin` execution is restricted strictly to `service_role`.
- Verifies strict non-empty snapshot schema checks on `page_revisions`.

#### Category 2: Pure Unit & Binary Parser Tests (20 tests)
*Files: `tests/media_validation.test.mjs`, `tests/preview_protocol.test.mjs`, `tests/public_fallback_and_renderers.test.mjs`, `tests/reorder_validation.test.mjs`*
- **Binary Signature & Dimensions (7 tests)**: Magic bytes (`FF D8 FF`, `89 50 4E 47`, `RIFF...WEBP`), header chunk dimension extraction (SOF0/SOF2, IHDR, VP8), rejection of MIME spoofing (MZ executable disguised as JPEG) and oversized files (> 5MB).
- **Preview Protocol & Handshake (5 tests)**: Sandboxed iframe preview handshake (`READY` -> `ACK` -> `INIT`), message origin validation, source window validation, section selection dispatching.
- **Public Fallback & Renderers (5 tests)**: Preservation of GTM (`GTM-KVDSVFG5`) and Google Ads (`AW-18574001849`), fallback HTML structure, and DOM generation for all 9 supported section types.
- **Section Reordering Logic (5 tests)**: Reorder array validation (no nulls, no duplicates, no unknown IDs, no omitted IDs, monotonic 10-step permutation generation).

#### Category 3: Simulated Interface & State Contract Tests (34 tests)
*Files: `tests/integration_edge_function_upload.test.mjs` (11 tests), `tests/integration_draft_persistence_and_locking.test.mjs` (6 tests), `tests/integration_auth_and_mfa.test.mjs` (7 tests), `tests/snapshot_integrity.test.mjs` (8 tests)*
- **MFA Consistency & Parity (5 tests)**: Rejection of invalid/expired session (401), rejection of AAL1 session (403), rejection of AAL2 session lacking verified TOTP factor (403), rejection of non-admin user (403), acceptance of AAL2 with verified TOTP factor and `super_admin` profile (201).
- **Storage & RPC Bypass Closure (6 tests)**: Rejection of direct client Storage INSERT via RLS, rejection of dropped `validate_and_register_media_asset` RPC, rejection of forged JPEG SOI headers, rejection of disguised executables, hiding of unindexed objects via SELECT RLS, rollback of storage object on simulated DB insert failure.
- **Draft Persistence & Locking Contract (6 tests)**: Concurrency lock serialization, section additions and deletions sync, reordering RPC sequential ordering, full draft snapshot capture (including hidden sections), abort on persistence failure, atomic draft save contract.
- **Supabase Auth & Session Lifecycle (7 tests)**: Invalid credential rejection, AAL1 authentication & MFA factor detection, invalid TOTP code rejection, session upgrade to AAL2, `super_admin` role validation, non-admin rejection, session clearance on logout.
- **Snapshot Publishing & Restoration Resiliency (8 tests)**: Publishing validation (zero sections, all hidden, missing phone, missing Arabic title), restoration resiliency against null, missing, or malformed fields.

#### Category 4: Staging Safety Guards & Harness Unit Tests (12 tests)
*File: `tests/staging_safety_and_harness.test.mjs`*
- **Staging Allowlist & Anti-Production Guards (4 tests)**: Rejection of production project references, rejection of unknown arbitrary projects, strict enforcement of `STAGING_PROJECT_ALLOWLIST`, acceptance of valid staging/dev references.
- **Codebase Static Asset Scanner Fail-Closed (2 tests)**: Fails closed when repository root is missing or unverified, protects full paths and basenames from `index.html`, `js/`, `css/`.
- **Staging Report Tracker & Non-Zero Exit Code Policy (4 tests)**: Asserts exit code 1 when configurations are missing, asserts exit code 1 when any test is skipped, asserts exit code 1 when any test fails, asserts exit code 0 strictly on 100% pass rate.
- **RFC 6238 TOTP Generator (2 tests)**: Validates base32 decoding against RFC 4648 test vector and rejects invalid characters, validates 6-digit numeric TOTP code generation consistency.

---

## 📋 Live Staging Verification Suite & Runbook

For real end-to-end integration verification on a live Supabase Staging environment (verifying real PostgreSQL 15+ engine evaluation, real GoTrue cryptographic JWT signatures, and live Edge Function execution):

### 1. Hardened Staging Verification Suite
Execute the dedicated staging test runner at [`scripts/verify_staging_integration.mjs`](scripts/verify_staging_integration.mjs):

```bash
STAGING_SUPABASE_URL=https://<staging-ref>.supabase.co \
STAGING_SUPABASE_ANON_KEY=<valid-anon-key> \
STAGING_SERVICE_ROLE_KEY=<service-role-secret> \
STAGING_ADMIN_EMAIL=admin@mg-home.online \
STAGING_ADMIN_PASSWORD=SecretPassword123! \
STAGING_ADMIN_TOTP_SECRET=JBSWY3DPEHPK3PXP \
node scripts/verify_staging_integration.mjs
```

This live script automatically executes:
1. **Direct Storage Upload Rejection via PostgreSQL RLS**: Uses a **valid Anon Key** to prove that PostgreSQL RLS (and not a malformed API key) actively blocks client writes on `storage.objects` with explicit RLS error verification.
2. **Anonymous Access Rejection**: Asserts unauthenticated requests to `is_admin_aal2()` return `false` and draft mutations fail.
3. **Dropped RPC Non-Existence (HTTP 404)**: Confirms `validate_and_register_media_asset` is completely dropped from PostgreSQL.
4. **Live AAL1 Session Rejection (HTTP 403)**: Performs password login without TOTP, verifying that an authentic AAL1 session is rejected by `is_admin_aal2()` and `save_draft_page_transaction` with verified permission denial message.
5. **Real TOTP Challenge & Authentic AAL2 Upgrade**: Generates real RFC 6238 TOTP 6-digit codes to verify MFA challenge and obtain authentic AAL2 JWT from Supabase GoTrue.
6. **Authentic is_admin_aal2() Approval**: Confirms super_admin with verified AAL2 session returns `true`.
7. **Complete 3-Table Snapshot ACID Rollback under Authentic Admin AAL2 Session**: Uses `display_order` to query sections, asserts `res.ok` on all baseline queries, submits an invalid section payload under the Admin AAL2 session, asserts that PostgreSQL throws exception `22000` (`VALIDATION ERROR`), and verifies that all three draft tables (`draft_site_settings`, `draft_page_metadata`, `draft_page_sections`) reverted to their baseline snapshots with zero partial mutation across all fields.
8. **Live Edge Function HTTP Suite (`validate-image`)**:
   - Asserts HTTP 401 on missing auth.
   - Asserts HTTP 403 on AAL1 session.
   - Asserts HTTP 403 on unverified TOTP factor session.
   - Asserts HTTP 201 on valid JPEG upload, and performs independent GET verification directly from Storage and DB.
   - Asserts HTTP 422 on spoofed executable (`MZ` header disguised as image) and performs independent checks proving ZERO storage object and ZERO DB row created.
9. **Hardened Teardown**: Runs in a `finally` block to ensure execution even on test failures, and verifies HTTP status of both Storage and Database deletions.
10. **Strict Exit Code Policy**: Summarizes results into `PASS`, `FAIL`, `SKIPPED`, `NOT CONFIGURED` and exits with non-zero code if any test fails, is skipped, or is unconfigured.

### 2. Manual Staging Verification Checklist
Before production cutover, perform these physical verification steps on Staging:

1. **Database Migration Execution**:
   - Apply [`supabase/migrations/20261119000001_initial_schema_v2_3_0.sql`](supabase/migrations/20261119000001_initial_schema_v2_3_0.sql) on a clean Supabase Staging PostgreSQL instance. Confirm zero errors.
2. **Initial Admin Provisioning**:
   - Create a user in Supabase Auth Dashboard, then run `SELECT public.provision_initial_admin('<UID>'::uuid, 'Radwan Eldaly');` using the SQL Editor.
3. **Physical TOTP MFA Enrollment**:
   - Log in to Admin Studio, scan the QR code using Google Authenticator on a physical mobile device, enter the 6-digit TOTP code, and verify session upgrade to AAL2.
4. **Deploy Edge Function**:
   - Run `supabase functions deploy validate-image` and set `SUPABASE_SERVICE_ROLE_KEY`.
   - Upload a test photo through Admin Studio and verify HTTP 201 response and object creation in storage.
5. **Orphaned Storage Audit & Cleanup**:
   - Run `node scripts/cleanup_orphaned_media.mjs` against Staging to ensure zero orphaned files exist.
6. **Live End-to-End Visual Builder Publish Flow**:
   - Open Visual Builder, edit Hero section title and background.
   - Click "Save Draft", verify atomic persistence in database.
   - Click "Publish", verify new active revision created in `page_revisions`.
   - Open public website in an incognito window without login, verify updated title loads within 1500ms.
   - Verify GTM container (`GTM-KVDSVFG5`) and Google Ads (`AW-18574001849`) fire correctly.
