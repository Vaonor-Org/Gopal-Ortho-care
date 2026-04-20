# Project Guidelines

## Code Style
- This repository is a static multi-page HTML/CSS/JS site with page-local CSS and scripts.
- Reuse existing design tokens and typography from styles/tokens.css and styles/global.css when possible.
- Keep iconography SVG-only; do not introduce emoji.
- Keep motion accessible: place new keyframes and animation utilities under prefers-reduced-motion handling (see styles/animations.css).
- Use Cormorant Garamond for headings, DM Sans for body/UI text, and DM Mono only for numeric/stat-style text.

## Architecture
- Main pages are standalone HTML documents:
  - /index.html
  - /booking/index.html
  - /about/index.html
  - /services/index.html
  - /doctors/index.html
  - /contact/index.html
- styles/global.css imports styles/tokens.css and styles/animations.css.
- components/*.html and sections/*.html are reference/snippet files; they are not auto-included at runtime.
- Because pages are standalone, shared UI updates (navbar, emergency bar, footer, floating actions) often need to be mirrored across multiple page files.

## Build And Test
- No package manager, bundler, or formal test suite is configured.
- Run locally from repo root with a static server:
  - python -m http.server 8000
- Then open http://localhost:8000
- Do not rely on file:// open for validation; root-absolute links and object/embed SVG paths can behave differently.

## Conventions
- Treat prompt.md, overview.md, and feature.json as reference docs (read-only unless explicitly requested otherwise).
- Track implementation progress in progress.md.
- Follow feature order from progress.md when implementing backlog items.
- Preserve the link style already used in the file you edit (root-relative vs ../ relative) and verify navigation from that page after edits.
- Prefer small, targeted edits over large rewrites, especially in pages with extensive inline CSS/JS.
- For responsiveness work, prioritize mobile behavior and avoid desktop-only visual changes unless explicitly requested.

## Documentation Links
- Design intent and UI rules: prompt.md
- Project identity and business details: overview.md
- Feature definitions and acceptance criteria: feature.json
- Build status and backlog order: progress.md
