# OfflineFirst ePCR - Implementation Plan

## Vision Statement

**An offline-first EMS/Hospital bridge that works when nothing else does.**

Not a replacement for EPIC, ESO, or ImageTrend - a resilient sync layer that:
- Works in rural areas with spotty connectivity
- Operates during grid/comms failures and natural disasters
- Provides simplified MCI triage mode when full documentation isn't feasible
- Syncs bidirectionally with existing hospital and EMS systems via FHIR/HL7

---

## Target Users & Use Cases

### Primary Users
1. **Rural EMS agencies** - Limited connectivity, need offline-capable ePCR
2. **Rural hospitals** - May not have robust IT infrastructure
3. **Disaster response teams** - Grid-down scenarios, MCIs
4. **EMS-Hospital handoff** - Any agency wanting better data flow

### Key Scenarios
```
Scenario 1: Rural Run
├── Crew responds 30 miles from town
├── No cell service at scene
├── Document patient contact offline
├── Sync when returning to coverage area
└── Hospital receives data before crew arrives

Scenario 2: Hurricane Response
├── Cell towers down, hospital on generator
├── Local mesh network or satellite backhaul
├── MCI mode: triage tags + transport tracking
├── Full documentation synced post-event
└── Demographics pulled from hospital system later

Scenario 3: Normal Operations
├── Full connectivity available
├── Real-time sync between EMS and hospital
├── Incoming patient alerts
├── Seamless handoff workflow
└── Auto-export to ImageTrend/ESO via FHIR
```

---

## HIPAA Compliance Framework

### Security Requirements (Strictest State Standards)

```
┌─────────────────────────────────────────────────────────────┐
│                    HIPAA TECHNICAL SAFEGUARDS                │
├─────────────────────────────────────────────────────────────┤
│ Access Control                                               │
│ ├── Unique user identification                              │
│ ├── Automatic logoff (configurable timeout)                 │
│ ├── Role-based access control (RBAC)                        │
│ └── Emergency access procedure (break-glass)                │
├─────────────────────────────────────────────────────────────┤
│ Audit Controls                                               │
│ ├── All PHI access logged                                   │
│ ├── Tamper-evident audit trail                              │
│ ├── Retention per state requirements (6-10 years)           │
│ └── Export capability for compliance audits                 │
├─────────────────────────────────────────────────────────────┤
│ Integrity Controls                                           │
│ ├── Data validation on input                                │
│ ├── Checksums for sync verification                         │
│ └── Version history for all PHI changes                     │
├─────────────────────────────────────────────────────────────┤
│ Transmission Security                                        │
│ ├── TLS 1.3 for all network traffic                         │
│ ├── End-to-end encryption for sync                          │
│ ├── Certificate pinning for mobile apps                     │
│ └── Offline data encrypted at rest (AES-256)                │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// packages/core/src/security/encryption.ts
interface EncryptionConfig {
  algorithm: 'AES-256-GCM'
  keyDerivation: 'PBKDF2'
  iterations: 100000
  saltLength: 32
}

// packages/core/src/security/audit.ts
interface AuditEntry {
  id: string
  timestamp: string
  userId: string
  action: 'create' | 'read' | 'update' | 'delete' | 'export'
  resourceType: string
  resourceId: string
  ipAddress?: string
  deviceId: string
  details: Record<string, any>
  checksum: string  // For tamper detection
}
```

---

## Phase 1: Security & Core Infrastructure

### 1.1 Authentication & Authorization

**Files to Create:**
```
packages/core/src/security/
├── encryption.ts         # AES-256 encryption utilities
├── audit.ts              # Audit logging
├── rbac.ts               # Role-based access control
└── session.ts            # Session management

packages/server/src/middleware/
├── authenticate.ts       # JWT validation
├── authorize.ts          # Permission checking
└── audit.ts              # Request logging
```

**User Roles & Permissions:**

```typescript
// Role hierarchy with permissions
const RolePermissions = {
  ems_crew: [
    'incident:create', 'incident:read', 'incident:update',
    'patient_contact:create', 'patient_contact:read', 'patient_contact:update',
    'vitals:create', 'vitals:read',
    'intervention:create', 'intervention:read',
    'handoff:initiate'
  ],
  ems_supervisor: [
    ...RolePermissions.ems_crew,
    'incident:delete', 'incident:reassign',
    'crew:manage', 'reports:view'
  ],
  hospital_nurse: [
    'incoming:view', 'incoming:acknowledge',
    'patient_contact:read',
    'handoff:accept', 'handoff:complete',
    'patient:link'  // Link ePCR to hospital patient
  ],
  hospital_physician: [
    ...RolePermissions.hospital_nurse,
    'patient_contact:addendum'  // Add notes to ePCR
  ],
  // ... etc
}
```

### 1.2 Encrypted Local Storage

```typescript
// packages/frontend/src/shared/db/SecurePouchDB.ts
import PouchDB from 'pouchdb'
import CryptoJS from 'crypto-js'

export class SecurePouchDB {
  private db: PouchDB.Database
  private encryptionKey: string

  constructor(name: string, userKey: string) {
    this.db = new PouchDB(name)
    this.encryptionKey = this.deriveKey(userKey)
  }

  async put(doc: any): Promise<void> {
    const encrypted = this.encrypt(doc)
    await this.db.put(encrypted)
    await this.audit('create', doc._id)
  }

  async get(id: string): Promise<any> {
    const encrypted = await this.db.get(id)
    await this.audit('read', id)
    return this.decrypt(encrypted)
  }

  private encrypt(doc: any): any {
    // Encrypt PHI fields, leave metadata for indexing
    const phi = { /* PHI fields */ }
    const encryptedPhi = CryptoJS.AES.encrypt(
      JSON.stringify(phi),
      this.encryptionKey
    ).toString()
    return { ...doc, _encrypted: encryptedPhi }
  }
}
```

### 1.3 Audit Trail

```typescript
// Every PHI access logged with tamper-evident checksums
async function createAuditEntry(entry: Omit<AuditEntry, 'id' | 'checksum'>) {
  const id = uuid()
  const previousEntry = await getLastAuditEntry()
  const checksum = hash(JSON.stringify(entry) + previousEntry?.checksum)

  await AuditRepository.save({ ...entry, id, checksum })
}
```

**Deliverables:**
- [ ] Encryption at rest for PouchDB
- [ ] JWT authentication with refresh tokens
- [ ] Role-based permission system
- [ ] Audit logging for all PHI access
- [ ] Session timeout and auto-logoff
- [ ] Device registration and management

---

## Phase 2: Data Models & MCI Mode

### 2.1 Core Models

**Incident (Run):**
```typescript
interface Incident {
  id: string
  incidentNumber: string
  agencyId: string

  // Mode
  mode: 'normal' | 'mci'  // MCI = simplified fields
  mciTriageTag?: string   // RED/YELLOW/GREEN/BLACK

  // Dispatch
  dispatchedAt: string
  callType: CallType
  priority: Priority
  location: GeoLocation

  // Timeline
  timestamps: {
    dispatched?: string
    enRoute?: string
    onScene?: string
    patientContact?: string
    departScene?: string
    atDestination?: string
    transferCare?: string
    available?: string
  }

  // Crew & Unit
  unitId: string
  crewMembers: CrewMember[]

  // Destination
  destinationId?: string
  destinationType?: 'hospital' | 'clinic' | 'other'

  // Status
  status: IncidentStatus

  // Linked records
  patientContactIds: string[]

  // Sync metadata
  _localOnly?: boolean     // Not yet synced
  _syncedAt?: string
  _conflicts?: string[]
}
```

**PatientContact (ePCR):**
```typescript
interface PatientContact {
  id: string
  incidentId: string
  mode: 'normal' | 'mci'

  // MCI Mode - minimal fields
  mciData?: {
    triageTag: 'red' | 'yellow' | 'green' | 'black'
    tagNumber: string
    chiefComplaint: string  // Brief
    location: string        // Where patient was found
    transportedTo?: string
    transportedAt?: string
  }

  // Normal Mode - full ePCR
  demographics?: Demographics
  assessment?: Assessment
  vitals?: VitalSigns[]
  interventions?: Intervention[]
  medications?: MedicationAdministration[]

  // Handoff
  handoff?: Handoff

  // Links to external systems
  externalLinks?: {
    hospitalPatientId?: string    // Link to EPIC/Cerner patient
    emsSystemId?: string          // Link to ESO/ImageTrend
  }

  // Sync
  _pendingSync?: boolean
  _lastSyncedAt?: string
}
```

### 2.2 MCI Mode Toggle

```typescript
// packages/frontend/src/shared/context/MCIModeContext.tsx
interface MCIModeState {
  active: boolean
  incidentName: string
  activatedAt: string
  activatedBy: string
  triageStats: {
    red: number
    yellow: number
    green: number
    black: number
    total: number
  }
}

// MCI Mode provides:
// 1. Simplified patient contact form (triage tag only)
// 2. Quick tag assignment buttons
// 3. Transport tracking board
// 4. Suppress non-essential fields
// 5. Batch sync when connectivity restored
```

**MCI Triage Form (Simplified):**
```
┌─────────────────────────────────────────┐
│  MCI TRIAGE TAG                         │
├─────────────────────────────────────────┤
│  Tag #: [AUTO-GENERATED]                │
│                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │ RED │ │ YEL │ │ GRN │ │ BLK │       │
│  │     │ │     │ │     │ │     │       │
│  └─────┘ └─────┘ └─────┘ └─────┘       │
│                                         │
│  Chief Complaint: [____________]        │
│                                         │
│  Location Found: [____________]         │
│                                         │
│  [ ] Transported                        │
│      Destination: [________▼]           │
│                                         │
│  [       SAVE & NEXT       ]            │
└─────────────────────────────────────────┘
```

### 2.3 Files to Create

```
packages/core/src/model/
├── Incident.ts
├── PatientContact.ts
├── VitalSigns.ts
├── Intervention.ts
├── Medication.ts
├── Handoff.ts
├── TriageTag.ts          # MCI triage
└── index.ts

packages/frontend/src/ems/
├── incidents/
│   ├── IncidentList.tsx
│   ├── NewIncident.tsx
│   ├── IncidentTimeline.tsx
│   └── hooks/
├── epcr/
│   ├── PatientContactForm.tsx
│   ├── VitalsEntry.tsx
│   ├── InterventionEntry.tsx
│   └── hooks/
├── mci/                   # MCI Mode
│   ├── MCIActivation.tsx
│   ├── TriageBoard.tsx
│   ├── QuickTriageForm.tsx
│   └── TransportTracker.tsx
└── handoff/
    ├── InitiateHandoff.tsx
    └── HandoffStatus.tsx
```

**Deliverables:**
- [ ] Incident model with MCI support
- [ ] PatientContact model (normal + MCI modes)
- [ ] MCI mode toggle and context
- [ ] Quick triage form
- [ ] Transport tracking board
- [ ] Normal mode full ePCR form

---

## Phase 3: Offline Sync Engine

### 3.1 Sync Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SYNC FLOW                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [EMS Tablet]              [CouchDB]              [Hospital] │
│       │                        │                       │     │
│       │── 1. Create locally ──▶│                       │     │
│       │   (encrypted)          │                       │     │
│       │                        │                       │     │
│       │◀── 2. Sync when ──────▶│◀── 2. Sync ─────────▶│     │
│       │      online            │                       │     │
│       │                        │                       │     │
│       │   3. Conflict?         │                       │     │
│       │      └─ Auto-merge     │                       │     │
│       │         or flag        │                       │     │
│       │                        │                       │     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Sync Status & Queue

```typescript
// packages/frontend/src/shared/hooks/useSync.ts
interface SyncState {
  status: 'synced' | 'syncing' | 'offline' | 'error'
  pendingChanges: number
  lastSyncedAt: string | null
  errors: SyncError[]
}

export function useSync() {
  const [state, setState] = useState<SyncState>()

  // Monitor connectivity
  useEffect(() => {
    const online = navigator.onLine
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }, [])

  // Sync queue
  async function syncPendingChanges() {
    const pending = await localDb.getPendingChanges()
    for (const change of pending) {
      try {
        await remoteDb.sync(change)
        await localDb.markSynced(change.id)
      } catch (error) {
        handleSyncError(change, error)
      }
    }
  }

  return { ...state, syncNow: syncPendingChanges }
}
```

### 3.3 Conflict Resolution

```typescript
// packages/core/src/sync/conflict-resolution.ts
type ConflictStrategy = 'last-write-wins' | 'merge' | 'manual'

interface ConflictResolution {
  strategy: ConflictStrategy

  // Field-level merge rules
  mergeRules: {
    // Vitals: append (both sets are valid)
    vitals: 'append',
    // Status: last-write-wins
    status: 'last-write',
    // Demographics: manual review if different
    demographics: 'manual-if-different'
  }
}

async function resolveConflict(local: Doc, remote: Doc): Promise<Doc> {
  // Auto-merge where possible
  // Flag for manual review where necessary
}
```

**Deliverables:**
- [ ] PouchDB ↔ CouchDB sync configuration
- [ ] Offline change queue
- [ ] Sync status indicator component
- [ ] Conflict resolution logic
- [ ] Manual conflict review UI
- [ ] Sync retry with exponential backoff

---

## Phase 4: Integration Layer (FHIR/HL7)

### 4.1 FHIR R4 Resources

Map internal models to FHIR for interoperability:

```typescript
// packages/core/src/fhir/mappings.ts

// PatientContact → FHIR Bundle
function toFHIRBundle(patientContact: PatientContact): fhir.Bundle {
  return {
    resourceType: 'Bundle',
    type: 'document',
    entry: [
      toFHIRPatient(patientContact.demographics),
      toFHIREncounter(patientContact),
      ...patientContact.vitals.map(toFHIRObservation),
      ...patientContact.interventions.map(toFHIRProcedure),
      ...patientContact.medications.map(toFHIRMedicationAdministration)
    ]
  }
}

// FHIR Patient → Internal Demographics
function fromFHIRPatient(fhirPatient: fhir.Patient): Demographics {
  return {
    firstName: fhirPatient.name?.[0]?.given?.[0],
    lastName: fhirPatient.name?.[0]?.family,
    dateOfBirth: fhirPatient.birthDate,
    gender: fhirPatient.gender,
    // ... etc
  }
}
```

### 4.2 Integration Adapters

```typescript
// packages/server/src/integrations/
├── fhir/
│   ├── FHIRClient.ts        # Generic FHIR R4 client
│   ├── adapters/
│   │   ├── EPICAdapter.ts   # EPIC-specific quirks
│   │   ├── CernerAdapter.ts
│   │   └── GenericAdapter.ts
│   └── webhooks/
│       └── IncomingFHIR.ts  # Receive data from hospitals
├── ems-systems/
│   ├── ImageTrendAdapter.ts
│   ├── ESOAdapter.ts
│   └── ZOLLAdapter.ts
└── index.ts
```

### 4.3 Webhook Receivers

```typescript
// Hospital sends patient demographics after EMS handoff
// EMS system receives for QA/billing completion

app.post('/webhooks/fhir', async (req, res) => {
  const bundle = req.body as fhir.Bundle

  // Validate signature
  // Parse and map to internal format
  // Link to existing PatientContact
  // Update demographics for billing
})
```

**Deliverables:**
- [ ] FHIR R4 resource mappings
- [ ] Generic FHIR client
- [ ] EPIC adapter (most common)
- [ ] ESO/ImageTrend export adapters
- [ ] Webhook endpoints for receiving data
- [ ] Integration configuration UI

---

## Phase 5: Real-Time Hospital Notifications

### 5.1 WebSocket Server

```typescript
// packages/server/src/websocket/notifications.ts
interface IncomingPatientAlert {
  type: 'incoming_patient'
  incidentId: string
  eta: number  // minutes
  priority: 'critical' | 'emergent' | 'routine'
  chiefComplaint: string
  vitals: {
    latest: VitalSigns
    trend?: 'stable' | 'improving' | 'deteriorating'
  }
  interventions: string[]  // Summary
  crewContact: string      // Radio/phone
}
```

### 5.2 Hospital Incoming Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  INCOMING PATIENTS                              [MCI MODE]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🔴 CRITICAL    ETA 3 min                            │    │
│  │ Unit: M-42     Chief Complaint: Chest Pain          │    │
│  │ Vitals: BP 180/110, HR 110, SpO2 94%               │    │
│  │ Interventions: ASA, NTG x2, 12-lead transmitted    │    │
│  │ [View Full ePCR]  [Acknowledge]  [Assign Room]     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🟡 URGENT      ETA 12 min                           │    │
│  │ Unit: A-7      Chief Complaint: Fall, hip pain      │    │
│  │ Vitals: BP 140/88, HR 88, SpO2 98%                 │    │
│  │ [View Full ePCR]  [Acknowledge]                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Deliverables:**
- [ ] WebSocket server with authentication
- [ ] Hospital subscription management
- [ ] Incoming patient alert system
- [ ] Hospital dashboard component
- [ ] Push notifications (optional)
- [ ] Audio alerts for critical patients

---

## Phase 6: Mobile & PWA

### 6.1 PWA Configuration

```typescript
// packages/frontend/vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'OfflineFirst ePCR',
        short_name: 'ePCR',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [/* ... */]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,  // Fast fallback to cache
            }
          }
        ]
      }
    })
  ]
})
```

### 6.2 Touch-Optimized UI

```css
/* Large touch targets for gloved hands */
.btn-touch {
  min-height: 48px;
  min-width: 48px;
  padding: 12px 24px;
  font-size: 18px;
}

/* High contrast for outdoor/bright conditions */
.high-contrast {
  --bg: #000;
  --fg: #fff;
  --accent: #ffeb3b;
}
```

**Deliverables:**
- [ ] PWA manifest and service worker
- [ ] Offline page and indicators
- [ ] Touch-optimized component variants
- [ ] High-contrast theme
- [ ] Install prompts

---

## Implementation Order (Recommended)

```
Week 1-2:  Phase 1 (Security) - Foundation for everything else
Week 2-3:  Phase 2 (Models) - Core data structures + MCI mode
Week 3-4:  Phase 3 (Sync) - Offline-first functionality
Week 4-5:  Phase 4 (FHIR) - Integration capability
Week 5-6:  Phase 5 (Real-time) - Hospital notifications
Week 6-7:  Phase 6 (PWA) - Mobile optimization
Week 7+:   Testing, compliance audit, pilot deployment
```

## Starting Point

**Recommended first step:** Phase 1.1 - Authentication & Role System

This establishes:
- User management foundation
- Permission system for all features
- Audit logging from day one
- HIPAA compliance baked in

Want me to start implementing the authentication and role system?

---

## Open Questions

1. **Deployment model** - Self-hosted by agencies? Shared SaaS? Hybrid?
2. **Identity provider** - Build our own or integrate with Azure AD/Okta?
3. **State selection** - Which state's requirements should we implement first?
4. **Pilot users** - Any specific agencies to design for?

---

*Plan revised to focus on: Offline resilience, MCI mode, integration (not replacement), HIPAA compliance*
