# TODO - OfflineFirst ePCR Project

## 🔴 High Priority (Phase 1: Security & Core Infrastructure)

### Authentication & Authorization
- [ ] Create encryption utility module (`packages/core/src/security/encryption.ts`)
- [ ] Create audit logging system (`packages/core/src/security/audit.ts`)
- [ ] Create role-based access control (`packages/core/src/security/rbac.ts`)
- [ ] Create session management (`packages/core/src/security/session.ts`)
- [ ] Implement JWT authentication middleware
- [ ] Implement permission checking middleware
- [ ] Create SecurePouchDB wrapper with encryption at rest
- [ ] Add device registration and management
- [ ] Implement auto-logoff timer

### Testing for Phase 1
- [ ] Write parameterized tests for encryption utilities
- [ ] Write tests for RBAC permission checks
- [ ] Write tests for audit logging
- [ ] Write tests for session management

## 🟡 Medium Priority (Phase 2: Data Models)

### Core Models
- [ ] Create Incident model with MCI support
- [ ] Create PatientContact model (normal + MCI modes)
- [ ] Create VitalSigns model
- [ ] Create Intervention model
- [ ] Create Medication model
- [ ] Create Handoff model
- [ ] Create TriageTag model for MCI

### MCI Mode
- [ ] Create MCI mode context and toggle
- [ ] Create quick triage form component
- [ ] Create transport tracking board

## 🟢 Low Priority / Future Phases

### Phase 3: Offline Sync
- [ ] Configure PouchDB ↔ CouchDB sync
- [ ] Implement offline change queue
- [ ] Create sync status indicator
- [ ] Implement conflict resolution

### Phase 4: FHIR Integration
- [ ] FHIR R4 resource mappings
- [ ] Generic FHIR client
- [ ] EPIC adapter
- [ ] ESO/ImageTrend export adapters

### Phase 5: Real-time Notifications
- [ ] WebSocket server
- [ ] Hospital incoming dashboard

### Phase 6: PWA/Mobile
- [ ] PWA manifest and service worker
- [ ] Touch-optimized components

## ✅ Completed

- [x] Repository analysis and modernization (2024-12-13)
- [x] Convert git submodules to regular directories
- [x] Update to Node.js 20+, TypeScript 5.3
- [x] Migrate frontend from CRA to Vite 5
- [x] Update React 16 → React 18
- [x] Update react-query to @tanstack/react-query v5
- [x] Fix all import paths and dependencies
- [x] Create comprehensive implementation plan
- [x] Revise plan for offline-first bridge focus

---

*Last updated: 2024-12-13*
