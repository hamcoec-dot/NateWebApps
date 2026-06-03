# Purchase Order Form — PLAN.md
# Hamilton County Election Commission

## Status: Completed PII Pre-seeded Data Removal (2026-06-03)

---

## 1. Multi-User Draft Overwrite & Completion Workflow
*(Completed - See history)*

---

## 2. Secure Intranet UNC Share Sync Configuration
*(Completed - See history)*

---

## 3. Sync Modal Configuration Inputs (Option B Refinements)
*(Completed - See history)*

---

## 4. PII Pre-seeded Data Removal
### Clarification & Design Questions:
1. **Scope of Removal (Ship-To Locations):** Should we also completely remove the pre-seeded `ship-to` locations (containing name, organization, street addresses, and phone numbers that might be PII)?
2. **First-Run UX:** When Local Storage is empty and sync is not yet configured, the dropdowns will be completely blank. Do we want to add any user-friendly guiding text or instruction inside the selects/form layout?
3. **PII Cleanup in Existing Client Storage:** Do we want a migration script to scrub previously seeded default records from clients' browser Local Storage?

### Technical Architecture Changes:
* **[MODIFY] [app.js](file:///X:/Nate%20Backup/Github/NateWebApps/PurchaseForm/app.js)**
  * Remove hardcoded default arrays inside `seedIfEmpty()`.
  * (Optional) Implement Local Storage cleanup checks.

### Verification Plan:
1. Clear localStorage and reload. Check that dropdowns start empty.
2. Manually add records and check that they save and persist.
3. Test loading sync data to ensure the empty state is correctly overwritten.
