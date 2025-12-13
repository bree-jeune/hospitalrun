# Development Log - OfflineFirst ePCR

## 2025-12-13 - Project Initialization & Modernization

### What Was Built
- Analyzed archived HospitalRun repository structure
- Converted 5 git submodules (frontend, server, components, core, cli) to regular directories
- Modernized entire tech stack:
  - Node.js 12/14 → Node.js 20+
  - TypeScript 3.8 → TypeScript 5.3
  - React 16 → React 18 (with createRoot API)
  - Create React App → Vite 5
  - react-query v2 → @tanstack/react-query v5
  - Fastify 3 → Fastify 4
  - node-sass → dart-sass
  - TSDX → Vite library mode (for components)

### Technical Decisions

1. **Kept PouchDB/CouchDB** - The existing offline-first architecture is perfect for our rural/disaster use case. No need to replace.

2. **Switched to npm from yarn** - yarn 4 couldn't be downloaded via corepack in the environment. npm works fine for workspaces.

3. **Downgraded React Router to v5** - The codebase uses v5 API (Switch, component prop). Full v6 migration would be significant work for minimal benefit at this stage.

4. **Components package exports source files** - Changed from `./dist/` to `./src/index.tsx` for development. Will need proper build step for production.

### Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| SSH URLs in .gitmodules failing | Converted to HTTPS URLs |
| react-query v5 has different API | Updated 50+ files from `queryCache` to `useQueryClient` pattern |
| TinyMCE v6 removed paste plugin | Removed paste import, it's now built-in |
| FullCalendar v6 CSS bundled differently | Removed separate CSS imports |
| Sass `~` imports not supported in Vite | Changed to direct paths, added `includePaths` |

### Lessons Learned

1. **Modernizing old codebases is tedious but mechanical** - Most issues are predictable: import paths, API changes, package renames.

2. **Read the migration guides** - react-query v5 migration guide would have saved time understanding the `queryCache` → `useQueryClient` change.

3. **Test frequently during migration** - Running `npm run dev:frontend` after each major change helped catch issues early.

### Next Steps
- Begin Phase 1: Security & Core Infrastructure
- Create encryption utilities with AES-256-GCM
- Set up audit logging system
- Implement role-based access control

---

## Session Notes Template

```markdown
## [DATE] - Session Title

### What Was Built
-

### Technical Decisions
-

### Challenges & Solutions
-

### Lessons Learned
-

### Next Steps
-
```
