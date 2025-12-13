# HospitalRun + EMS ePCR Convergence - Implementation Plan

## Executive Summary

Transform HospitalRun from a hospital-only HIS into a converged Hospital + EMS system with seamless patient handoff capabilities. The offline-first architecture (PouchDB/CouchDB) is retained and enhanced with real-time notification layer.

---

## Phase 1: Foundation & Multi-Tenancy (Week 1-2)

### 1.1 Data Model: Agency & User Roles

**New Models:**

```typescript
// packages/core/src/model/Agency.ts
interface Agency {
  id: string
  name: string
  type: 'ems' | 'hospital' | 'dispatch'
  address: Address
  contactInfo: ContactInfo
  settings: AgencySettings
  createdAt: string
  updatedAt: string
}

// packages/core/src/model/UserRole.ts
type UserRole =
  | 'ems_crew'           // Paramedic/EMT in field
  | 'ems_supervisor'     // EMS supervisor
  | 'hospital_nurse'     // ED nurse
  | 'hospital_physician' // ED physician
  | 'hospital_admin'     // Hospital administrator
  | 'dispatcher'         // Dispatch center
  | 'system_admin'       // System administrator
```

**Files to Create:**
- `packages/core/src/model/Agency.ts`
- `packages/core/src/model/UserRole.ts`
- `packages/core/src/model/UserProfile.ts` (extend existing User)

**Files to Modify:**
- `packages/frontend/src/shared/model/Permissions.ts` - Add EMS permissions
- `packages/server/src/routes/` - Add agency routes

### 1.2 Database Schema Updates

**CouchDB Design Documents:**

```javascript
// Agency database
{
  "_id": "_design/agency",
  "views": {
    "by_type": {
      "map": "function(doc) { if(doc.type) emit(doc.type, doc); }"
    }
  }
}

// User-Agency relationship
{
  "_id": "_design/user_agency",
  "views": {
    "by_agency": {
      "map": "function(doc) { if(doc.agencyId) emit(doc.agencyId, doc); }"
    }
  }
}
```

**Deliverables:**
- [ ] Agency CRUD operations
- [ ] User-Agency association
- [ ] Role-based permission matrix
- [ ] Agency-scoped data access

---

## Phase 2: ePCR Core Data Models (Week 2-3)

### 2.1 Incident/Run Model

```typescript
// packages/core/src/model/Incident.ts
interface Incident {
  id: string
  incidentNumber: string          // Auto-generated (e.g., "2024-001234")
  agencyId: string                // EMS agency

  // Dispatch Info
  dispatchedAt: string
  callType: CallType              // Medical, Trauma, Fire, etc.
  priority: 'emergent' | 'urgent' | 'non-emergent'
  dispatchAddress: Address
  dispatchNotes: string

  // Crew
  unitId: string                  // Ambulance/unit identifier
  crewMembers: CrewMember[]

  // Timeline
  enRouteAt?: string
  onSceneAt?: string
  patientContactAt?: string
  departSceneAt?: string
  atHospitalAt?: string
  transferCareAt?: string
  availableAt?: string

  // Status
  status: IncidentStatus

  // Linked Data
  patientContactIds: string[]     // Can have multiple patients
  destinationHospitalId?: string

  createdAt: string
  updatedAt: string
}

type IncidentStatus =
  | 'dispatched'
  | 'en_route'
  | 'on_scene'
  | 'patient_contact'
  | 'transporting'
  | 'at_hospital'
  | 'transfer_care'
  | 'available'
  | 'complete'
  | 'cancelled'

type CallType =
  | 'medical_emergency'
  | 'trauma'
  | 'cardiac'
  | 'respiratory'
  | 'stroke'
  | 'overdose'
  | 'psychiatric'
  | 'obstetric'
  | 'pediatric'
  | 'transfer'
  | 'standby'
  | 'other'
```

### 2.2 Patient Contact (ePCR) Model

```typescript
// packages/core/src/model/PatientContact.ts
interface PatientContact {
  id: string
  incidentId: string
  patientId?: string              // Links to hospital Patient record

  // Demographics (may not have hospital record yet)
  demographics: {
    firstName?: string
    lastName?: string
    dateOfBirth?: string
    gender?: string
    weight?: { value: number; unit: 'kg' | 'lb' }
    allergies?: string[]
  }

  // Chief Complaint & History
  chiefComplaint: string
  historyOfPresentIllness: string
  pastMedicalHistory: string[]
  medications: string[]

  // Assessment
  primaryImpression: string
  secondaryImpression?: string
  traumaAssessment?: TraumaAssessment

  // Vitals (time series)
  vitals: VitalSigns[]

  // Interventions
  interventions: Intervention[]

  // Disposition
  disposition: Disposition

  // Handoff
  handoff?: Handoff

  // Signatures
  signatures: Signature[]

  createdAt: string
  updatedAt: string
  createdBy: string
  lastModifiedBy: string
}

interface VitalSigns {
  id: string
  timestamp: string
  bloodPressure?: { systolic: number; diastolic: number }
  heartRate?: number
  respiratoryRate?: number
  oxygenSaturation?: number
  temperature?: { value: number; unit: 'C' | 'F' }
  bloodGlucose?: number
  painScale?: number              // 0-10
  gcs?: { eye: number; verbal: number; motor: number }
  pupils?: { left: PupilAssessment; right: PupilAssessment }
  skinCondition?: string
  notes?: string
  takenBy: string
}

interface Intervention {
  id: string
  timestamp: string
  type: InterventionType
  details: Record<string, any>    // Flexible for different intervention types
  outcome?: string
  performedBy: string
  notes?: string
}

type InterventionType =
  | 'medication_administration'
  | 'iv_access'
  | 'airway_management'
  | 'cpr'
  | 'defibrillation'
  | 'splinting'
  | 'bleeding_control'
  | 'spinal_immobilization'
  | 'oxygen_therapy'
  | 'cardiac_monitoring'
  | 'other'

interface Handoff {
  hospitalId: string
  hospitalName: string
  receivingNurse?: string
  receivingPhysician?: string
  roomAssignment?: string
  handoffTime: string
  handoffNotes: string
  acknowledgmentTime?: string
  acknowledgedBy?: string
  status: 'pending' | 'acknowledged' | 'completed'
}
```

### 2.3 Files to Create

```
packages/core/src/model/
├── Incident.ts
├── PatientContact.ts
├── VitalSigns.ts
├── Intervention.ts
├── Handoff.ts
├── CrewMember.ts
└── index.ts (re-export all)

packages/frontend/src/ems/
├── incidents/
│   ├── Incidents.tsx
│   ├── NewIncident.tsx
│   ├── ViewIncident.tsx
│   └── hooks/
│       ├── useIncidents.ts
│       ├── useIncident.ts
│       └── useCreateIncident.ts
├── epcr/
│   ├── PatientContactForm.tsx
│   ├── VitalsPanel.tsx
│   ├── InterventionsPanel.tsx
│   ├── AssessmentPanel.tsx
│   └── hooks/
└── shared/
    └── components/
```

**Deliverables:**
- [ ] Incident model & repository
- [ ] PatientContact model & repository
- [ ] VitalSigns time-series storage
- [ ] Intervention tracking
- [ ] Basic ePCR form UI

---

## Phase 3: Real-Time Notifications (Week 3-4)

### 3.1 WebSocket Server

**New Package or Server Extension:**

```typescript
// packages/server/src/websocket/index.ts
import { WebSocketServer } from 'ws'
import { FastifyInstance } from 'fastify'

interface NotificationPayload {
  type: 'patient_incoming' | 'handoff_request' | 'handoff_acknowledged' | 'status_update'
  incidentId: string
  patientContactId?: string
  hospitalId: string
  eta?: number                    // minutes
  priority: 'critical' | 'urgent' | 'routine'
  summary: string
  timestamp: string
}

export function setupWebSocket(fastify: FastifyInstance) {
  const wss = new WebSocketServer({ server: fastify.server })

  // Connection management by agency
  const connections = new Map<string, Set<WebSocket>>()

  wss.on('connection', (ws, req) => {
    // Authenticate and associate with agency
    // Subscribe to agency-specific channels
  })

  // Publish to specific hospital
  function notifyHospital(hospitalId: string, payload: NotificationPayload) {
    const hospitalConnections = connections.get(hospitalId)
    hospitalConnections?.forEach(ws => ws.send(JSON.stringify(payload)))
  }

  return { notifyHospital }
}
```

### 3.2 Frontend WebSocket Client

```typescript
// packages/frontend/src/shared/hooks/useRealtimeNotifications.ts
export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(WS_URL)

    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data)
      setNotifications(prev => [notification, ...prev])

      // Show toast for urgent notifications
      if (notification.priority === 'critical') {
        showUrgentAlert(notification)
      }
    }

    wsRef.current = ws
    return () => ws.close()
  }, [])

  return { notifications }
}
```

### 3.3 Hospital Incoming Patients Dashboard

```typescript
// packages/frontend/src/hospital/incoming/IncomingPatients.tsx
// Real-time list of EMS units en route to this hospital
// Shows: ETA, chief complaint, vitals summary, crew contact
```

**Deliverables:**
- [ ] WebSocket server integration
- [ ] Authentication for WebSocket connections
- [ ] Agency-scoped message routing
- [ ] Frontend notification hook
- [ ] Incoming patients dashboard
- [ ] Push notification support (optional)

---

## Phase 4: Patient Handoff Workflow (Week 4-5)

### 4.1 Handoff States

```
EMS Side                          Hospital Side
─────────────────────────────────────────────────────
1. Create handoff request    →    Notification received
2. Awaiting acknowledgment   ←    Acknowledge receipt
3. Handoff acknowledged      →    Prepare for arrival
4. Arrived at hospital       →    Patient in ED
5. Transfer care complete    ←    Accept patient
6. Run complete              →    Patient now hospital record
```

### 4.2 Patient Record Linking

When EMS arrives and transfers care:

```typescript
// Link EMS PatientContact to Hospital Patient
async function linkPatientRecords(
  patientContactId: string,
  hospitalPatientId: string
): Promise<void> {
  // Update PatientContact with hospital patient reference
  const patientContact = await PatientContactRepository.find(patientContactId)
  patientContact.patientId = hospitalPatientId
  await PatientContactRepository.save(patientContact)

  // Add ePCR reference to hospital Patient
  const patient = await PatientRepository.find(hospitalPatientId)
  patient.emsContacts = patient.emsContacts || []
  patient.emsContacts.push({
    patientContactId,
    incidentDate: patientContact.createdAt,
    chiefComplaint: patientContact.chiefComplaint
  })
  await PatientRepository.save(patient)
}
```

### 4.3 Hospital View of ePCR

Hospital staff can view full ePCR data:
- All vitals taken in field
- Interventions performed
- Medications given
- Scene observations
- Transport notes

**Deliverables:**
- [ ] Handoff request/acknowledge API
- [ ] Handoff status tracking
- [ ] Patient record linking
- [ ] Hospital ePCR viewer component
- [ ] Print/export ePCR for hospital records

---

## Phase 5: Mobile-First EMS UI (Week 5-6)

### 5.1 Responsive Design Requirements

```
┌────────────────────────────────────────┐
│  EMS Tablet UI (Primary)               │
│  - Large touch targets                 │
│  - Glove-friendly                      │
│  - High contrast for sunlight          │
│  - Quick vitals entry                  │
│  - Voice input support (future)        │
└────────────────────────────────────────┘
```

### 5.2 Offline-First Enhancements

```typescript
// packages/frontend/src/shared/hooks/useOfflineSync.ts
export function useOfflineSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const [pendingChanges, setPendingChanges] = useState(0)

  // Queue changes when offline
  // Sync when connection restored
  // Conflict resolution for concurrent edits
}
```

### 5.3 PWA Configuration

```typescript
// packages/frontend/vite.config.ts - Add PWA plugin
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
})
```

**Deliverables:**
- [ ] Mobile-optimized ePCR form
- [ ] Quick vitals entry component
- [ ] Offline indicator & sync status
- [ ] PWA manifest & service worker
- [ ] Touch-optimized buttons & inputs

---

## Phase 6: Reporting & Compliance (Week 6-7)

### 6.1 NEMSIS Compliance (US Standard)

```typescript
// packages/core/src/export/nemsis.ts
// National EMS Information System data export
interface NEMSISExport {
  generatePatientCareReport(patientContactId: string): NEMSISDocument
  validateCompliance(patientContact: PatientContact): ValidationResult
  exportToState(patientContact: PatientContact): Promise<void>
}
```

### 6.2 Reports

- Run reports (individual incident)
- Crew activity reports
- Response time analytics
- Hospital handoff metrics
- QA/QI reports

**Deliverables:**
- [ ] NEMSIS-compliant data export
- [ ] Run report PDF generation
- [ ] Analytics dashboard
- [ ] Export to state reporting system (configurable)

---

## Technical Debt & Improvements

### During Implementation

1. **Migrate remaining react-query hooks** to v5 patterns (partially done)
2. **TypeScript strict mode** - Enable and fix errors
3. **Test coverage** - Add tests for new features
4. **Error boundaries** - Add proper error handling
5. **Logging** - Add structured logging for debugging

### Post-Implementation

1. **Performance optimization** - Code splitting, lazy loading
2. **Accessibility audit** - WCAG compliance
3. **Security audit** - Authentication, data encryption
4. **Load testing** - Multi-tenant scalability

---

## File Structure After Implementation

```
packages/
├── core/
│   └── src/
│       ├── model/
│       │   ├── Agency.ts
│       │   ├── Incident.ts
│       │   ├── PatientContact.ts
│       │   ├── VitalSigns.ts
│       │   ├── Intervention.ts
│       │   ├── Handoff.ts
│       │   └── ... (existing models)
│       └── export/
│           └── nemsis.ts
├── frontend/
│   └── src/
│       ├── ems/                    # NEW: EMS module
│       │   ├── incidents/
│       │   ├── epcr/
│       │   └── dashboard/
│       ├── hospital/               # NEW: Hospital-specific
│       │   ├── incoming/
│       │   └── handoff/
│       ├── shared/
│       │   ├── hooks/
│       │   │   ├── useRealtimeNotifications.ts
│       │   │   └── useOfflineSync.ts
│       │   └── components/
│       └── ... (existing)
└── server/
    └── src/
        ├── websocket/              # NEW: Real-time
        ├── routes/
        │   ├── incidents.ts
        │   ├── patient-contacts.ts
        │   └── handoffs.ts
        └── ... (existing)
```

---

## Getting Started

To begin implementation, run these commands in order:

```bash
# 1. Create core model files
npm run dev:frontend  # Verify app still runs

# 2. Start with Phase 1
# Create Agency model first, then extend User model
```

**Recommended Starting Point:** Phase 2.1 - Incident Model

This provides immediate value (run tracking) and establishes patterns for remaining work.

---

## Questions to Resolve

1. **State reporting requirements** - Which state(s) will this deploy to? NEMSIS versions vary.
2. **Hospital integration** - Will hospitals already have HospitalRun, or need to integrate with existing EHR?
3. **Dispatch integration** - CAD system integration, or standalone dispatch?
4. **Billing codes** - ICD-10, CPT for interventions?
5. **Authentication** - SSO requirements? Active Directory integration?

---

*Plan created: Phase 1-6 implementation for HospitalRun + EMS ePCR convergence*
