# Plan - TN Candidate Qualification Verification Form Update

## Objective
Update `TN Candidate Qualification Verification Form.html` to:
1. Ensure all candidate requirements align with TCA 2025 and applicable constitutional provisions.
2. Incorporate missing legal citations for U.S. Senator, U.S. Representative, State Senator, State Representative, judges, county mayor, clerks, register of deeds, trustee, assessor of property, sheriff, constable, district attorney general, district public defender, state executive committeeman/woman, county commissioner, county highway chief administrative officer, and county school board.
3. Enhance the dynamic citation extraction parser regex in `parseRequirement()` to extract and append US/TN constitutional citations and more complex statutory citations to the titles of the checklist items.
4. Add a Partisan Designation dropdown menu (Partisan/Nonpartisan) to the selector section. If "Partisan" is selected, dynamically generate and append a "Bona Fide Party Membership" checklist block (TCA § 2-13-104 and TCA § 2-5-204) to the form preview, and display the partisan status under the office information section.

## Proposed Changes

### TN Candidate Qualification Verification Form.html
- **HTML (Selector Section)**: Add a new required form group for `Partisan Status` selector dropdown (`#partisanSelect`).
- **JavaScript (generateForm)**:
  - Check both `#officeSelect` and `#partisanSelect` before rendering the preview.
  - Dynamically insert a "Bona Fide Party Membership" block if the partisan status is set to `Partisan`, utilizing the `parseRequirement` helper to move citations to the title.
  - Include the chosen partisan status as an input field in the printed "OFFICE INFORMATION" section.
- **JavaScript (printForm)**: Add validation to ensure both selectors are populated before launching the print dialog.

## Accessibility (WCAG 2.1 AA)
- Use standard checkbox markup with linked `<label>` tags.
- Maintain readable hierarchy.

## Verification
- Open in browser, generate checklists for different offices with Partisan/Nonpartisan combinations.
- Verify that selecting "Partisan" correctly adds the "Bona Fide Party Membership" block and updates the printed partisan status.
- Open print preview (Ctrl+P) and verify letter-sized formatting.
