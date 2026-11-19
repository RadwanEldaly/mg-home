# MG HOME — Custom CMS & Visual Page Builder (Phase 03 Implementation)

This repository contains the engineering implementation of the **MG HOME Custom CMS & Visual Page Builder** (v2.3.0).

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
   - Single-admin authentication with mandatory TOTP MFA (AAL2).
   - Atomic publishing and full rollback/restore support.

3. **Backend & Database (`supabase/migrations/`)**:
   - `20261119000001_initial_schema_v2_3_0.sql`
   - Complete draft and published snapshot isolation:
     - Draft tables (`draft_site_settings`, `draft_page_metadata`, `draft_page_sections`) are 100% private.
     - `page_revisions` stores immutable JSONB snapshots of published states.
     - Hardened RPCs with advisory locks: `publish_page_revision`, `restore_revision_to_draft`, `reorder_draft_sections`.
     - Explicit `GRANT`/`REVOKE` matrix preventing anonymous draft leakage.
     - Storage bucket `media-library` with MIME and path restrictions.

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
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

### 3. Public Website
Serve the root directory with any HTTP server (e.g. `npx serve`, Live Server, or Vercel). The public site will automatically detect published revisions or run the high-speed static fallback.
