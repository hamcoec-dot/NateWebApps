# Plan - Add Voter List Purchase Order Form Button

## Objective
Update the main index file (`Index.html`) to include a navigation link/button for the new Voter List Purchase Form (`Voter List Purchase Form 2026.html`).

## Proposed Changes

### Index.html
- Add a new `<li>` element inside the `<ul class="app-list">`.
- The new item will link to `Voter List Purchase Form 2026.html`.
- Add proper descriptive link text and a span with form description.
- Ensure the href is properly URL-encoded as `Voter%20List%20Purchase%20Form%202026.html`.

## Accessibility (WCAG 2.1 AA)
- Semantic list structure (`<li>` within `<ul>` under `<nav aria-label="Available web applications">`).
- Descriptors are placed within the corresponding list item for clear context mapping for screen readers.
- Anchor target is clear and readable.

## Verification
- Load/inspect the updated list in `Index.html` to confirm accuracy.
