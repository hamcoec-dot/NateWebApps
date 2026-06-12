# Plan - TN Candidate Qualification Verification Form Update

## Objective
Update `TN Candidate Qualification Verification Form.html` to add Campaign Finance Requirements to the checklist generated for all offices and optimize for letter-sized paper printing.

## Proposed Changes

### TN Candidate Qualification Verification Form.html
- **Print Styles**: Add spacing and layout overrides inside `@media print` to keep the document compact on letter-sized paper (reduce section margins, block padding, signature heights).
- **Checklist Additions**: Add dynamic blocks for Campaign Finance Registry Identification (PC 1087, § 27) and Campaign Financial Disclosure Reports (TCA § 2-10-107(b)) in `generateForm()`.
- Ensure correct numbering sequence using `reqIndex`.

## Accessibility (WCAG 2.1 AA)
- Use standard checkbox markup with linked `<label>` tags.
- Maintain readable hierarchy.

## Verification
- Open in browser, generate checklists for different offices.
- Open print preview (Ctrl+P) and verify letter-sized formatting.
