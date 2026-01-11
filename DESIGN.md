# Design Document - OfflineFirst ePCR

## Project Overview

**What:** An offline-first EMS/Hospital bridge system that provides reliable patient care documentation and handoff capabilities when connectivity is limited or unavailable.

**Why:** Existing ePCR systems (ESO, ImageTrend, ZOLL) and hospital EHRs (EPIC, Cerner) are cloud-dependent. Rural areas, natural disasters, and mass casualty incidents create situations where these systems fail. This project fills that gap.

**Target Users:**
- Rural EMS agencies with limited connectivity
- Rural hospitals without robust IT infrastructure
- Disaster response teams
- Any EMS/Hospital wanting better data handoff

**Compliance:** California HIPAA standards (strictest in US)

---

## Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SYSTEMS                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────┐          │
│  │  EPIC   │  │ Cerner  │  │   ESO   │  │ImageTrend │          │
│  └────┬────┘  └────┬────┘  └────┬────┘  └─────┬─────┘          │
│       │            │            │              │                 │
│       └────────────┴─────┬──────┴──────────────┘                │
│                          │                                       │
│                    ┌─────▼─────┐                                 │
│                    │ FHIR/HL7  │  ← Standard healthcare APIs     │
│                    │  Adapter  │                                 │
│                    └─────┬─────┘                                 │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    OFFLINEFIRST ePCR                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    CouchDB (Central)                      │   │
│  │                   ┌─────────────────┐                     │   │
│  │                   │  Encrypted PHI  │                     │   │
│  │                   │  Audit Logs     │                     │   │
│  │                   │  Sync Metadata  │                     │   │
│  │                   └─────────────────┘                     │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              │               │               │                   │
│         ┌────▼────┐    ┌─────▼─────┐   ┌────▼────┐             │
│         │   EMS   │    │ Hospital  │   │Dispatch │             │
│         │ Tablet  │    │  Tablet   │   │ Console │             │
│         │         │    │           │   │         │             │
│         │ PouchDB │    │  PouchDB  │   │ PouchDB │             │
│         │(offline)│    │ (offline) │   │         │             │
│         └─────────┘    └───────────┘   └─────────┘             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Component Architecture (Frontend)

```
packages/frontend/src/
├── ems/                      # EMS-specific features
│   ├── incidents/            # Run/call management
│   ├── epcr/                 # Patient contact forms
│   ├── mci/                  # Mass casualty mode
│   └── handoff/              # Hospital handoff
├── hospital/                 # Hospital-specific features
│   ├── incoming/             # Incoming patient dashboard
│   └── handoff/              # Accept patient handoff
├── shared/                   # Shared across all users
│   ├── components/           # Reusable UI components
│   ├── hooks/                # Custom React hooks
│   ├── db/                   # Database access layer
│   ├── security/             # Auth, encryption, audit
│   └── context/              # React contexts
├── patients/                 # (existing) Patient management
├── scheduling/               # (existing) Appointments
├── labs/                     # (existing) Lab orders
└── ...                       # Other existing modules
```

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | React 18 | Industry standard, large ecosystem, existing codebase |
| **State Management** | Redux Toolkit + React Query | Redux for UI state, React Query for server state |
| **Build Tool** | Vite 5 | Fast dev server, good TypeScript support |
| **Styling** | Bootstrap 5 + Sass | Existing design system, responsive by default |
| **Local Database** | PouchDB | Offline-first, syncs with CouchDB, encrypted at rest |
| **Backend** | Node.js + Fastify 4 | Fast, TypeScript support, existing codebase |
| **Central Database** | CouchDB | Designed for sync, conflict resolution built-in |
| **Real-time** | WebSocket (ws) | Push notifications to hospital |
| **Integration** | FHIR R4 | Healthcare interoperability standard |
| **Language** | TypeScript 5.3 | Type safety, better tooling, catch errors early |

---

## Design Patterns Used

### 1. Repository Pattern (Data Access)
**Where:** `packages/frontend/src/shared/db/*Repository.ts`
**Why:** Abstracts database operations, makes switching storage easy, testable.

```typescript
// Example: PatientRepository.ts
class PatientRepository {
  async find(id: string): Promise<Patient>
  async save(patient: Patient): Promise<Patient>
  async search(query: string): Promise<Patient[]>
}
```

### 2. Custom Hooks Pattern (React)
**Where:** `packages/frontend/src/*/hooks/*.ts`
**Why:** Encapsulates complex logic, reusable, testable.

```typescript
// Example: usePatient.ts
function usePatient(id: string) {
  return useQuery({
    queryKey: ['patient', id],
    queryFn: () => PatientRepository.find(id)
  })
}
```

### 3. Provider Pattern (React Context)
**Where:** `packages/frontend/src/shared/context/*.tsx`
**Why:** Share state without prop drilling, dependency injection.

```typescript
// Example: MCIModeContext.tsx
const MCIModeContext = createContext<MCIModeState>(...)
export function MCIModeProvider({ children }) { ... }
export function useMCIMode() { return useContext(MCIModeContext) }
```

### 4. Adapter Pattern (Integrations)
**Where:** `packages/server/src/integrations/*/Adapter.ts`
**Why:** Uniform interface for different external systems.

```typescript
// All adapters implement this interface
interface EHRAdapter {
  sendPatientData(patient: PatientContact): Promise<void>
  receivePatientData(externalId: string): Promise<Demographics>
}
```

---

## Security Architecture

### HIPAA Technical Safeguards Implementation

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ LAYER 1: TRANSPORT                                       │    │
│  │ • TLS 1.3 for all network traffic                       │    │
│  │ • Certificate pinning for mobile apps                   │    │
│  │ • WebSocket over TLS (wss://)                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ LAYER 2: AUTHENTICATION                                  │    │
│  │ • JWT tokens with short expiry (15 min)                 │    │
│  │ • Refresh tokens (7 days, rotated on use)               │    │
│  │ • Device registration required                          │    │
│  │ • Auto-logoff after inactivity                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ LAYER 3: AUTHORIZATION                                   │    │
│  │ • Role-based access control (RBAC)                      │    │
│  │ • Agency-scoped data access                             │    │
│  │ • Break-glass emergency access (logged)                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ LAYER 4: DATA PROTECTION                                 │    │
│  │ • AES-256-GCM encryption at rest (PouchDB)              │    │
│  │ • PHI fields encrypted, metadata unencrypted for index  │    │
│  │ • Key derived from user password (PBKDF2, 100k iter)    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ LAYER 5: AUDIT                                           │    │
│  │ • All PHI access logged                                 │    │
│  │ • Tamper-evident chain (checksum includes previous)     │    │
│  │ • 10-year retention (California requirement)            │    │
│  │ • Export for compliance audits                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Role Definitions

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| `ems_crew` | Paramedic/EMT in field | Create/update incidents and patient contacts |
| `ems_supervisor` | EMS supervisor | Above + delete, reassign, view reports |
| `hospital_nurse` | ED nurse | View incoming, acknowledge, accept handoff |
| `hospital_physician` | ED physician | Above + add addendums to ePCR |
| `dispatcher` | Dispatch center | View all incidents, assign units |
| `system_admin` | System administrator | Full access, manage users/agencies |

---

## Database Schema

### Core Entities (CouchDB Documents)

```typescript
// Agency (EMS company or Hospital)
{
  _id: "agency:uuid",
  type: "agency",
  name: "Rural County EMS",
  agencyType: "ems", // or "hospital", "dispatch"
  address: { ... },
  settings: { ... },
  createdAt: "2024-01-01T00:00:00Z"
}

// User
{
  _id: "user:uuid",
  type: "user",
  email: "medic@example.com",
  passwordHash: "...", // bcrypt
  agencyId: "agency:uuid",
  roles: ["ems_crew"],
  devices: [{ id: "...", name: "iPad-001", registeredAt: "..." }],
  createdAt: "..."
}

// Incident (Run)
{
  _id: "incident:uuid",
  type: "incident",
  incidentNumber: "2024-001234",
  agencyId: "agency:uuid",
  mode: "normal", // or "mci"
  callType: "medical_emergency",
  priority: "emergent",
  location: { lat: 39.5, lng: -119.8, address: "..." },
  timestamps: {
    dispatched: "...",
    enRoute: "...",
    onScene: "...",
    // ...
  },
  status: "on_scene",
  unitId: "M-42",
  crewMembers: [{ userId: "...", role: "lead" }],
  patientContactIds: ["patient_contact:uuid"],
  _encrypted: "..." // Encrypted PHI fields
}

// PatientContact (ePCR)
{
  _id: "patient_contact:uuid",
  type: "patient_contact",
  incidentId: "incident:uuid",
  mode: "normal",
  _encrypted: "...", // Contains demographics, assessment, vitals, etc.
  externalLinks: {
    hospitalPatientId: "...",
    emsSystemId: "..."
  },
  handoff: {
    status: "pending",
    hospitalId: "agency:uuid",
    initiatedAt: "..."
  }
}

// AuditEntry
{
  _id: "audit:uuid",
  type: "audit",
  timestamp: "2024-01-01T12:00:00Z",
  userId: "user:uuid",
  action: "read",
  resourceType: "patient_contact",
  resourceId: "patient_contact:uuid",
  deviceId: "...",
  checksum: "sha256:..." // Chain integrity
}
```

---

## API Design

### REST Endpoints (Phase 1)

```
Authentication:
POST   /api/auth/login          # Get JWT tokens
POST   /api/auth/refresh        # Refresh access token
POST   /api/auth/logout         # Invalidate refresh token
POST   /api/auth/device         # Register device

Users:
GET    /api/users/me            # Current user profile
PUT    /api/users/me            # Update profile
GET    /api/users/:id           # Get user (admin only)

Agencies:
GET    /api/agencies/:id        # Get agency details
PUT    /api/agencies/:id        # Update agency (admin only)
```

### WebSocket Events (Phase 5)

```typescript
// Server → Hospital
{
  type: "incoming_patient",
  incidentId: "...",
  eta: 5, // minutes
  priority: "critical",
  summary: {
    chiefComplaint: "Chest pain",
    vitals: { bp: "180/110", hr: 110, spo2: 94 },
    interventions: ["ASA", "NTG x2"]
  }
}

// Hospital → Server
{
  type: "acknowledge_incoming",
  incidentId: "...",
  acknowledgedBy: "user:uuid",
  roomAssignment: "Trauma 1"
}
```

---

## MCI Mode Design

### Triage Categories (START Protocol)

| Category | Color | Criteria | Priority |
|----------|-------|----------|----------|
| Immediate | RED | Life-threatening, salvageable | 1 |
| Delayed | YELLOW | Serious but stable | 2 |
| Minor | GREEN | Walking wounded | 3 |
| Deceased | BLACK | Dead or non-salvageable | 4 |

### MCI Data Model (Minimal)

```typescript
interface MCIPatientContact {
  tagNumber: string        // "RED-001"
  triageCategory: 'red' | 'yellow' | 'green' | 'black'
  chiefComplaint: string   // Brief, e.g., "Arm fracture"
  locationFound: string    // "Section B, Row 3"
  transportStatus: 'on_scene' | 'transported' | null
  transportDestination?: string
  transportTime?: string
  // Full demographics synced LATER from hospital
}
```

---

## Deployment Architecture

### Self-Hosted (Phase 1)

```
┌─────────────────────────────────────────┐
│           Agency Infrastructure          │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │         Docker Compose            │   │
│  │  ┌─────────┐  ┌─────────────┐    │   │
│  │  │ CouchDB │  │   Node.js   │    │   │
│  │  │  :5984  │  │   :3001     │    │   │
│  │  └─────────┘  └─────────────┘    │   │
│  │                                   │   │
│  │  ┌─────────────────────────────┐ │   │
│  │  │   Nginx (TLS termination)   │ │   │
│  │  │          :443               │ │   │
│  │  └─────────────────────────────┘ │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Tablets connect via local network       │
│  or VPN when remote                      │
└─────────────────────────────────────────┘
```

---

*Last updated: 2024-12-13*
