# Purchase Order Form — PLAN.md
# Hamilton County Election Commission

## Status: Implementing Diagnostic Logging for UNC Share Config (2026-06-01)

---

## 1. Multi-User Draft Overwrite Collision & Completion Workflow
*(Completed - See history)*

---

## 2. Secure Intranet UNC Share Sync Configuration
### The Problem:
*   The host machine is stuck in local-only mode despite having network access to the UNC path.
*   To resolve this, we need diagnostic console logging inside `server.js`'s `/api/config` endpoint. This will print the precise access checks and any filesystem/permission errors directly to the terminal when the host runs `node server.js`.

### The Solution:
1.  **Add Robust Server Logs:**
    *   Print to console when `/api/config` is requested.
    *   Log if `fs.existsSync(UNC_CONFIG)` resolves to `true` or `false`.
    *   Catch and print any detailed filesystem/network read errors (e.g. `EACCES` permission denied or `ENOENT` not found).
2.  **Verify Server Response:**
    *   Instruct the user to visit `http://localhost:3000/api/config` in their browser and review the terminal logs.

---

## Technical Architecture Changes

### [MODIFY] [server.js](file:///x:/antigravity/PurchaseForm/server.js)
*   Add console logging, existence indicators, and catch blocks inside the `/api/config` route to aid terminal diagnostics.

---

## Verification Plan
1.  **Console Diagnostic Verification:**
    *   Verify the console prints step-by-step checks of UNC path existence when `/api/config` is fetched.
