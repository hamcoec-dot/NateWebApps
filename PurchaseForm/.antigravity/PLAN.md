# Purchase Order Form — PLAN.md
# Hamilton County Election Commission

## Status: Completed Sync Modal Configuration Inputs (Option B Refinements) (2026-06-02)

---

## 1. Multi-User Draft Overwrite & Completion Workflow
*(Completed - See history)*

---

## 2. Secure Intranet UNC Share Sync Configuration
*(Completed - See history)*

---

## 3. Sync Modal Configuration Inputs (Option B Refinements)
### Clarified Requirements:
1.  **Masked Previews:** In the settings modal UI, Gist IDs and Tokens will display masked placeholders (e.g., `2eaa06393a30...b520` or dots `••••••••`) to protect keys while verifying connection.
2.  **No Gist Creation:** Remove the "Create Gist" option from the UI to prevent clerks from spawning divergent databases.
3.  **Intranet Configuration Import/Export:** Provide a simple "Export" and "Import" button flow. Admins can copy a Base64 configuration string from one terminal and import it on another with a single click.
4.  **No URL Auto-seeding:** Bypassed as per workflow design.
5.  **Simplified Diagnostic Messaging:** Failures will print a generic message: *"Connection failed, please contact your administrator."* to keep errors clean for terminal clerks.

---

## Technical Architecture Changes

### [MODIFY] [index.html](file:///x:/antigravity/PurchaseForm/index.html)
*   Update the Sync Modal form to:
    *   Expose editable configuration inputs.
    *   Add **"Export Config"** and **"Import Config"** buttons.
    *   Remove the **"Create Gist"** button.

### [MODIFY] [app.js](file:///x:/antigravity/PurchaseForm/app.js)
*   **Settings Form Mapping:** Populates values dynamically, masking the Gist token.
*   **Security Error Text:** Intercept `testSyncConnection()` errors and display the required generic warning message.
*   **Import/Export Wiring:** Create event handlers for Base64 configuration serialization/deserialization.
*   **Remove unused functions:** Delete `createSyncKey()` since Gist creation has been disabled.

---

## Verification Plan
1.  **UI Verification:**
    *   Verify the Gist token is displayed masked.
    *   Confirm "Create Gist" button is removed.
2.  **Import/Export Verification:**
    *   Click **Export Config**. Verify a Base64 string is written to the clipboard.
    *   On a fresh/cleared terminal, click **Import Config** and paste the string. Verify all Gist settings and provider modes are instantly restored.
3.  **Generic Error Message Verification:**
    *   Corrupt the Token and click "Test Connection".
    *   Verify it displays: *"Connection failed, please contact your administrator."*
