# Plan - TN Candidate Qualification Verification Form Update

## Objective
Update `TN Candidate Qualification Verification Form.html` to:
1. Ensure all candidate requirements align with TCA 2025 and applicable constitutional provisions.
2. Incorporate missing legal citations for U.S. Senator, U.S. Representative, State Senator, State Representative, judges, county mayor, clerks, register of deeds, trustee, assessor of property, sheriff, constable, district attorney general, district public defender, state executive committeeman/woman, county commissioner, county highway chief administrative officer, and county school board.
3. Enhance the dynamic citation extraction parser regex in `parseRequirement()` to extract and append US/TN constitutional citations and more complex statutory citations to the titles of the checklist items.

## Proposed Changes

### TN Candidate Qualification Verification Form.html
- **JavaScript (officeRequirements)**: Update requirements arrays for all requested offices with precise legal citations matching TCA 2025 and state/federal constitutions.
- **JavaScript (parseRequirement)**: Update the regular expression `citeRegex` to support `US Constitution`, `US Const.`, `TN Constitution`, `TN Const.`, and related variations so that all legal citations are dynamically moved to the checklist item titles.

## Accessibility (WCAG 2.1 AA)
- Use standard checkbox markup with linked `<label>` tags.
- Maintain readable hierarchy.

## Verification
- Open in browser, generate checklists for different offices (e.g. U.S. Senator, County Trustee).
- Verify that citations (e.g. TN Constitution, US Constitution, TCA) are correctly parsed and appended to the checklist block titles.
- Open print preview (Ctrl+P) and verify letter-sized formatting.
