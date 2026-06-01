# Purchase Order Form — PLAN.md
# Hamilton County Election Commission

## Status: Working on Secure Intranet UNC Share Sync Configuration (2026-06-01)

---

## 1. Multi-User Draft Overwrite Collision & Completion Workflow
*(Completed - See history)*

---

## 2. Secure Intranet UNC Share Sync Configuration
### The Problem:
*   GitHub tokens (`ghp_...`) must not be hardcoded in public or shared Git repositories to prevent credential leaks.
*   Direct browser access to Windows network shares/UNC paths (e.g. `\\hcdc\elect\...`) is blocked by modern web browsers' strict filesystem security sandbox (CORS / Local Same-Origin policies) when the page is served over HTTP.
*   We need a way to store the `sync_config.json` securely on a private local intranet share and automatically distribute it to clerks.

### The Solution:
1.  **Express Backend Server Gateway:**
    *   Node.js runs with full system privileges and has no browser sandbox restrictions. It can easily read the UNC network path.
    *   Implement a new API endpoint in `server.js`: `GET /api/config`.
    *   The server will attempt to read `sync_config.json` from the intranet share `\\hcdc\elect\OfficeFiles\User Shareable Folders\Nate's Shareable Folder\PurchaseFormConfig\sync_config.json`.
    *   If the share is unavailable, the server will fallback to a local `./sync_config.json` file in the project folder (which is added to `.gitignore`).
    *   It securely returns the JSON configuration payload to client terminals.
2.  **Client Dynamic Bootstrap:**
    *   On startup, `app.js` performs an asynchronous request to the server gateway: `fetch('/api/config')`.
    *   If found, the terminal auto-configures Gist cloud synchronization instantly.
    *   If not found, it remains in local storage mode safely without crashing.
3.  **Complete Sanitization:**
    *   Remove all hardcoded PAT tokens and Gist IDs from the frontend source files (`app.js`).

---

## Technical Architecture Changes

### [NEW] [.gitignore](file:///x:/antigravity/PurchaseForm/.gitignore)
*   Register `sync_config.json` to prevent local configurations from being committed.

### [MODIFY] [index.html](file:///x:/antigravity/PurchaseForm/index.html)
*   Add `id="sync-gist-display"` to the Gist ID label element and change static placeholder text to `"Not Configured"`.

### [MODIFY] [server.js](file:///x:/antigravity/PurchaseForm/server.js)
*   Add `GET /api/config` endpoint that safely reads from the UNC intranet network path or local fallback, serving it via JSON API.

### [MODIFY] [app.js](file:///x:/antigravity/PurchaseForm/app.js)
*   Clear all hardcoded Gist IDs/tokens.
*   Implement `loadConfig()` background task to fetch configuration from `/api/config` or local `sync_config.json`.
*   Refactor `updateSyncUI()` to dynamically display the active Gist ID (partially masked) or server URL.

---

## Verification Plan
1.  **Direct Secrets Verification:**
    *   Ensure all source files are free of `ghp_` tokens.
2.  **UNC Share Connection Test:**
    *   Verify the Express server reads the configuration from the UNC share and feeds it to the client via `GET /api/config` dynamically.
3.  **Graceful Fallback Test:**
    *   When the network share is offline, verify the app continues functioning in unconfigured local storage mode.
