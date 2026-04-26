---
name: wireframe-generation
description: 'Generate and publish sequential Meet2Meet wireframe docs. Use when asked to create "NN 버전 wireframe", add next flow screens, sync docs-site, and verify visibility.'
argument-hint: '버전/주제 (예: 07 정산 화면)'
user-invocable: true
---

# Meet2Meet Wireframe Generation

## What This Skill Produces
- A new wireframe HTML source file in `docs/features/`
- Synced public wireframe file in `docs-site/public/wireframes/`
- Updated docs-site planning page embed/link entries in `docs-site/src/content/docs/planning/wireframes.mdx`
- Verified docs-site build status

## When To Use
- User asks for a new numbered wireframe version (e.g., "05 버전", "06 생성")
- Existing wireframe is created but not visible in docs-site
- Need consistent end-to-end documentation flow from source to published docs-site page

## Inputs
- Version number (required): `NN`
- Feature topic (required): what the wireframe represents
- Optional style direction: if omitted, follow existing 01~N visual/document structure

## Procedure
1. Determine target version and topic.
2. Inspect previous wireframes in `docs/features/` to keep naming and narrative continuity.
3. Create source file as `docs/features/NN.<topic>-wireframe.html`.
4. Use the established wireframe structure:
   - `Feature Brief`
   - `User Flow`
   - `Screen Design` (host + participant/consumer views)
   - `Data Model`
   - `API Endpoints`
   - `Edge Cases and Policy`
   - `Implementation Status`
5. Update sync mapping in `docs-site/scripts/sync-planning-docs.mjs` by adding new source/dest mapping.
6. Update docs-site display doc `docs-site/src/content/docs/planning/wireframes.mdx`:
   - Add a section for the new version with short intent + API summary
   - Add `<WireframeFull src="/wireframes/NN....html" ... />`
   - Add the "원본 HTML 새 창" link
7. Run sync command:
   - `pnpm --dir docs-site sync:planning`
8. Validate publication and integrity:
   - Confirm file exists at `docs-site/public/wireframes/NN....html`
   - Run `pnpm --dir docs-site build`
   - Ensure no diagnostics in edited files

## Decision Points
- If version is omitted:
  - Detect highest numbered wireframe in `docs/features/` and create next number.
- If docs-site file exists but page does not show it:
  - Prioritize fixing `wireframes.mdx` embed and link sections.
- If naming is ambiguous:
  - Prefer pattern `NN.meeting-<topic>-wireframe.html`.

## Quality Criteria
- Naming and numbering are sequential and consistent.
- Source + docs-site public copy both exist.
- `wireframes.mdx` includes both embed and source link.
- `sync:planning` and `docs-site build` succeed.
- No new errors in edited files.

## Completion Checklist
- [ ] New `docs/features` wireframe file created
- [ ] sync mapping added
- [ ] `wireframes.mdx` section + embed + link added
- [ ] `sync:planning` executed successfully
- [ ] docs-site build successful
- [ ] final report includes changed file paths
