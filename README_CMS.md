# MG HOME — Custom CMS & Visual Page Builder (Phase 03.3 Implementation)

This repository contains the engineering implementation and security remediation of the **MG HOME Custom CMS & Visual Page Builder** (v2.3.0 / Phase 03.3).

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
   - Draft persistence with real-time PostgreSQL synchronization.
   - Atomic publishing and full rollback/restore support.

3. **Backend & Database (`supabase/migrations/`)**:
   - `20261119000001_initial_schema_v2_3_0.sql`
   - Complete draft and published snapshot isolation:
     - Draft tables (`draft_site_settings`, `draft_page_metadata`, `draft_page_sections`) are 100% private.
     - `page_revisions` stores immutable JSONB snapshots of published states.
     - Hardened RPCs with unified workspace advisory lock (`hashtext('mg_home_cms_workspace_lock')`): `publish_page_revision`, `restore_revision_to_draft`, `reorder_draft_sections`.
     - Explicit `GRANT`/`REVOKE` matrix preventing anonymous draft leakage.
     - Single-admin database constraint enforced at schema and trigger level (`uq_admin_profiles_singleton`).
     - Storage bucket `media-library` with MIME and path restrictions.

4. **Trusted Edge Function Media Validation (`supabase/functions/validate-image/`)**:
   - Direct-to-storage client uploads have been eliminated.
   - Client sends multipart uploads to the server-side Edge Function with active JWT.
   - The Edge Function validates:
     - Valid user session with `super_admin` role in `admin_profiles`.
     - Active AAL2 (TOTP MFA) session claim.
     - Binary magic bytes in server memory (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `RIFF...WEBP` for WebP).
     - Decodes true image dimensions from chunk headers (SOF0/SOF2, IHDR, VP8/VP8L/VP8X).
     - Rejects spoofed or malicious payloads *before* any byte touches storage.
     - Uploads to storage using `service_role` and inserts approved record into `public.media_assets`.
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

## 🧪 Comprehensive Test Suite (58 Tests)

The test suite covers static contract analysis, pure unit tests, and integration simulations:

```bash
# Run all tests
node --test tests/*.test.mjs
```

### Test Suites Breakdown:
1. **`tests/integration_auth_and_mfa.test.mjs` (7 tests)**:
   - Rejects invalid credentials.
   - Authenticates valid user at AAL1 and identifies required MFA factors.
   - Rejects invalid TOTP codes.
   - Upgrades session to AAL2 upon successful challenge.
   - Enforces `super_admin` role validation against `admin_profiles`.
   - Rejects unauthorized users.
   - Verifies session cleanup on logout.

2. **`tests/integration_draft_persistence_and_locking.test.mjs` (5 tests)**:
   - Verifies unified workspace advisory lock (`424242`) preventing concurrent conflicting mutations.
   - Validates section addition and deletion synchronization in the database.
   - Tests reordering RPC enforcing sequential order values and strict validation.
   - Verifies that published snapshots preserve both visible and hidden sections.
   - Confirms that publishing transaction completely aborts if draft persistence fails.

3. **`tests/integration_edge_function_upload.test.mjs` (6 tests)**:
   - Rejects unauthenticated upload requests with 401.
   - Rejects AAL1 sessions with 403 (MFA required).
   - Rejects non-admin users with 403.
   - Rejects spoofed executables (`MZ` header) with 422 before storage write.
   - Successfully uploads and registers valid JPEG, PNG, and WebP images with 201.
   - Rolls back and deletes uploaded storage objects if database registration fails.

4. **`tests/migration_security.test.mjs` (10 tests)**:
   - Validates SQL migration AST, default privilege hardening, RLS enforcement, single-admin constraints, unified locks, dropping auto-promotion triggers, and `provision_initial_admin` privileges.

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
