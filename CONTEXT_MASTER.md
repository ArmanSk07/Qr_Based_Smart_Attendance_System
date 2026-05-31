# 📚 QR Attendance Management System - Master Context

This file serves as the definitive Single Source of Truth (SSOT) for the QR Attendance Project. It contains a deep analysis of the entire codebase (Backend + Frontend) so that any AI assistant or developer can immediately understand the architecture, data flow, current development phase, and future scalability points.

## 🚀 1. Project Overview & Tech Stack
**Goal:** A full-stack application to track student attendance manually or via QR Code scanning, with a role-based access system, SMS alerts for low attendance, geo-location validation, and robust dashboard reporting.

### Tech Stack
*   **Backend:** Django 5.1.4, Django REST Framework (DRF), SQLite (Database)
*   **Frontend:** React 19 (Vite), React Router DOM, Context API (State Management)
*   **Authentication:** Token-based Auth (DRF Authtoken)
*   **Integrations:** Twilio (SMS Alerts for <75% attendance)
*   **Libraries:** `jsqr` (QR Scanning), `qrcode.react` (QR Generation), `html2canvas` (ID Card Export), `recharts` (Dashboard Analytics), `lucide-react` (Icons), `exceljs` (Excel Report Export), `geopy` (Server-side Geo-validation).

---

## 🏛️ 2. Backend Architecture (Django)
*Directory:* `/backend/`

### A. Data Models (`core/models.py`)
1.  **`Branch`**: Top-level entity (e.g., "Computer Science").
2.  **`SubBranch` (Subject)**: Linked to `Branch`. Represents specific subjects (e.g., "Java").
3.  **`Student`**: Linked to `Branch` and `SubBranch` (via `Enrollment`). Has `roll_no`, `phone`, `photo`, and a unique `qr_payload`.
4.  **`Enrollment`**: M2M through-table mapping `Student` to `SubBranch`.
5.  **`Attendance`**: Tracks daily attendance. Unique together on (student, sub_branch, date).
6.  **`UserRole` (Proxy Model)**: Proxy of Django's `Group` for admin access control.
7.  **`CampusLocation`** *(NEW — 2026-05-27)*: Defines allowed GPS attendance zones per branch (or globally).
    - `branch` (FK → Branch, **nullable** — if NULL = Global location for ALL branches)
    - `name` (e.g., "Main Building", "Lab 2")
    - `latitude`, `longitude` (DecimalField, 7 decimal places)
    - `allowed_radius_meters` (PositiveIntegerField, default=100)
    - `is_active` (BooleanField — toggle without deleting)
    - `created_at`

### B. Core Logic & Views (`core/views.py`)
*   **Auth**: `api_login`, `change_password`, `request_password_reset`, `reset_password_confirm`.
*   **Data ViewSets**: `BranchViewSet`, `SubBranchViewSet`, `StudentViewSet` — all require `IsAuthenticated`.
*   **Attendance**: `mark_attendance` (manual, blocks weekends), `mark_attendance_qr` (QR scanner), `mark_attendance_via_browser` (link-based).
*   **Twilio Alerts (`check_and_alert`)**: Filters out dummy Indian numbers to save credits.
*   **Backup & Restore**: `restore_database` wipes & re-inserts from JSON in an atomic transaction.
*   **`_validate_geo_location(branch_id, lat, lng)`** *(NEW)*: Internal helper called by all attendance endpoints.
*   **`get_campus_locations`** *(NEW)*: `GET /api/campus-locations/?branch_id=<id>` — returns active zones for a branch.

#### Geo-Validation Helper Logic
```python
def _validate_geo_location(branch_id, latitude, longitude):
    # Fetches: branch-specific locations + global locations (branch=NULL)
    active_locations = CampusLocation.objects.filter(
        Q(branch_id=branch_id) | Q(branch__isnull=True), is_active=True
    )
    if not active_locations.exists():
        return True, None          # No fence configured → always allow (backward compat)
    if latitude is None or longitude is None:
        return False, "Location is required..."
    for location in active_locations:
        if geodesic(device_coords, center_coords).meters <= location.allowed_radius_meters:
            return True, None      # Inside at least one zone → allow
    return False, "You are outside the allowed campus area..."
```

**Called in:** `mark_attendance`, `mark_attendance_qr` (both read `latitude` & `longitude` from request body).

### C. Signals (`core/signals.py`)
*   Branch created → Group `Branch: {name}` auto-created.
*   SubBranch created → existing students in that branch auto-enrolled.
*   Student created → auto-enrolled in all existing sub-branches of their branch.

### D. Admin (`core/admin.py`)
*   Jazzmin UI, `BranchGroupFilter` for per-branch data visibility, hidden sensitive fields.
*   **Groups Page Hierarchy**: 🏛️ Branch groups at top in bold indigo, 📚 Subject groups indented with tree markers. "Belongs To" column shows parent branch.
*   **`CampusLocationAdmin`** *(NEW)*:
    - `list_display`: Name, **Scope (Branch)** column (color-coded badge), Lat, Lng, Radius, Is Active, Created At.
    - `list_editable`: `is_active`, `allowed_radius_meters` (edit directly from list view).
    - `location_scope()`: Shows `🌐 Global (All Branches)` (green badge) or `🏛️ BranchName` (indigo badge).
    - `fieldsets`: Guides admin to **leave Branch blank for a Global location**.

### E. URL Routes (`server/urls.py`)
| Endpoint | View |
|---|---|
| `api/mark-attendance/` | `mark_attendance` (+ geo validation) |
| `api/mark-attendance-qr/` | `mark_attendance_qr` (+ geo validation) |
| `api/campus-locations/?branch_id=X` | `get_campus_locations` *(NEW)* |
| `api/branches/`, `api/sub-branches/`, `api/students/` | ViewSets |
| `api/login/`, `api/change-password/` | Auth |
| `api/send-alerts/` | Twilio |
| `api/restore/` | Backup restore |
| `api/request-reset/`, `api/reset-confirm/<uid>/<token>/` | Password reset |

### F. Configuration (`server/settings.py` & `.env`)
*   All sensitive values read from `.env` — **never hardcoded**.
*   `geopy==2.4.1` added to `requirements.txt`.

---

## 💻 3. Frontend Architecture (React + Vite)
*Directory:* `/src/`

### A. State Management (`context/AppContext.jsx`)
*   **Auth State**: `token`, `isAuthenticated`, `isSuperUser`, `userGroups`.
*   **Data State**: `branches`, `subBranches`, `students`, `attendance`.
*   **Toast System** (two layers):
    *   `showToast(msg, type)` — 3-second standard notification.
    *   `showUndoToast(msg, onDelete, onUndo)` — **Stacked** 10-second undo toasts.
    *   `undoAll()` — "Undo All (N)" button appears when 2+ pending deletes exist.
*   **Delete Functions** — all three accept `(id, name, onOptimisticRemove, onOptimisticRestore)`.
*   **`getDeviceLocation()`** *(NEW)*: Returns a Promise that resolves to `{ latitude, longitude }` via `navigator.geolocation`. Rejects with a descriptive error message on denial/failure. **Lazily called** (never auto-runs on mount — only called when Scanner initiates a scan).
*   **`markAttendance(studentId, subBranchId, date, lat?, lng?)`** *(UPDATED)*: Accepts optional lat/lng, forwards to backend.
*   **`markAttendanceByQr(qrPayload, subBranchId, date, lat?, lng?)`** *(UPDATED)*: Accepts optional lat/lng, forwards to backend.

### B. Routing (`App.jsx`)
*   Public: `/login`, `/forgot-password`, `/reset-password/:uid/:token`
*   Protected: `/dashboard`, `/scanner` (via `<ProtectedRoute>`)

### C. Pages
1.  **Dashboard (`pages/Dashboard.jsx`)** — Core command center.
    *   Enforces RBAC: `canEdit = isSuperUser || userGroups.includes('Branch: Name')`.
    *   **Delete Flow**: Click delete → Confirm Modal → "Yes, Delete" → 10s Undo Toast.
    *   **Bulk Delete**: Select Mode toolbar → checkbox cards → "Delete N Selected" → Confirm → Undo Toast.
    *   **Branch Report** (`exportToCSV`): Downloads `.xlsx` via ExcelJS with full styling *(UPGRADED)*.
    *   **Subject Report** (`exportSubjectCSV`): Downloads `.xlsx` via ExcelJS with full styling *(UPGRADED)*.

2.  **Scanner (`pages/Scanner.jsx`)** *(UPDATED)*:
    *   Before each QR scan, calls `getDeviceLocation()`.
    *   On **location success**: coordinates passed to `markAttendanceByQr(payload, subId, date, lat, lng)`.
    *   On **location failure**: shows descriptive toast (`"Location permission denied..."`, `"Unable to determine your location..."`) and **resumes scanning** — does NOT hard-block (backend is the authoritative validator).
    *   Backend rejects if the branch has active geo-fences and device is outside all of them.

### D. Components
*   **`Sidebar.jsx`**: Navigation, Backup/Restore, Theme, Scanner launch.
*   **`TopBar.jsx`**: Date picker, Search, Add Student, Export Excel Report, Delete Branch.
*   **`StudentCard.jsx`**: Attendance pie chart, Mark/QR/Delete buttons. Supports select mode.
*   **`modals/DashboardModals.jsx`**: AddStudentModal, AddBranchModal, IDCardModal (QR + html2canvas).

---

## 🧠 4. Core Logic & Constraints

1.  **Working Days Calculation**: Percentage excludes Sat/Sun from denominator (frontend `getWorkingDaysInMonth()` + backend Twilio loop).
2.  **Monthly Locking**: Attendance can only be marked/edited for the current month.
3.  **QR Payload Security**: Prefix `SECURE_APP_VER1:` required to trigger API call.
4.  **Twilio Cost Saving**: Dummy numbers (all-same digits, sequential, >7 zeros) are blocked.
5.  **RBAC**: Superusers = full access. Teachers = edit only their assigned `Branch: [Name]` group.
6.  **Geo-Validation**: Server-side only. Frontend sends coordinates; backend validates against `CampusLocation` table. If no locations configured for a branch → attendance always allowed (backward compatible).

---

## 📍 5. Geo-Location Validation System (Added: 2026-05-27)

### How it Works
```
Student scans QR  →  Scanner calls getDeviceLocation()
                  →  lat/lng sent with attendance request
                  →  Backend: _validate_geo_location(branch_id, lat, lng)
                      → Fetch branch-specific + global (branch=NULL) active locations
                      → If none exist → ALLOW (backward compat)
                      → geodesic distance check against each location
                      → Inside ANY radius → ALLOW
                      → Outside ALL → REJECT 403
```

### Campus Location Types
| Branch field | Scope |
|---|---|
| Set to a specific Branch | Only that branch uses this zone |
| **Left blank (NULL)** | **Global — applies to ALL branches** |

### Admin Configuration
1. Go to `/admin/core/campuslocation/` → **Add campus location**
2. Leave **Branch blank** for a campus-wide root location
3. Or select a branch for a branch-specific zone
4. Set `allowed_radius_meters` — recommendation:
   - Desktop/laptop (WiFi GPS): **500–1000m**
   - Mobile with GPS: 100–200m
5. Multiple locations per branch supported — device must be inside ANY one

### Key Files
| File | Change |
|---|---|
| `backend/core/models.py` | `CampusLocation` model (branch nullable) |
| `backend/core/admin.py` | `CampusLocationAdmin` with scope badge |
| `backend/core/views.py` | `_validate_geo_location()`, updated `mark_attendance`, `mark_attendance_qr`, new `get_campus_locations` |
| `backend/server/urls.py` | `api/campus-locations/` route |
| `backend/requirements.txt` | `geopy==2.4.1` |
| `src/context/AppContext.jsx` | `getDeviceLocation()`, updated `markAttendance`, `markAttendanceByQr` |
| `src/pages/Scanner.jsx` | Calls `getDeviceLocation()` before each scan |
| `backend/core/migrations/` | `0002_campuslocation.py`, `0003_alter_campuslocation_options_and_more.py` |

---

## 📊 6. Excel Report System (Upgraded: 2026-05-27)

Reports now download as **`.xlsx`** (was `.csv`). Uses `exceljs` library.

### Report Structure (both branch + subject reports)
| Row | Content | Style |
|---|---|---|
| 1 | Branch Name — REPORT TYPE | Deep indigo bg, white bold text, size 16, merged, centered |
| 2–4 | Month / Working Days / Subject / Generated On | Indigo bg, white text, merged, centered |
| 5 | *(blank spacer)* | — |
| 6 | Column headers (Sr No, Roll No, Name, Phone...) | Indigo-600 bg, white bold, centered |
| 7+ | Student data rows | Alternating white / indigo-50, borders |
| Last | Summary (Total Students, Avg %) | Light indigo bg, bold |

### Per-cell Formatting
- **Student Name**: Bold, left-aligned
- **Phone**: Stored as text (`numFmt: '@'`), left-aligned — no Excel auto-formatting
- **Status "Safe ✓"**: Green background, dark green bold text
- **Status "Short Attendance"**: Red background, dark red bold text
- **Numbers**: Centered
- **Column widths**: Pre-set (Name=26, Phone=16, Status=18, etc.)

### Functions
```js
// Branch-level report — "Report" button in TopBar
exportToCSV()               // async, downloads BranchName_MonthlyReport_May_2026.xlsx

// Subject-level report — 📄 icon next to each subject tab
exportSubjectCSV(id, name)  // async, downloads SubjectName_Branch_May_2026_Report.xlsx
```

---

## ♻️ 7. Delete Flow — Confirm + Undo System (Updated: 2026-05-27)

**Flow for every delete (Student / Branch / Subject):**
```
Click 🗑️  →  Confirm Modal ("Yes, Delete")  →  10-second Undo Toast at bottom-center
```
If user clicks **Undo** within 10 seconds → delete cancelled.
After 10 seconds → actual API DELETE call fires.

**Bulk Student Delete Flow:**
```
"Select Students" button  →  Check cards (or "Select All")  →  "Delete N Selected"
→  Confirm Modal  →  10-second Undo Toast
```

### Key Implementation Details
*   **Stacked Toasts**: `undoToasts` is an **array** in AppContext state. Each delete appends a new entry with its own `timerId`.
*   **Independent Timers**: Each toast has its own `setTimeout(10000)`. Undo on one does not affect others.
*   **Undo All**: When 2+ toasts are pending, an "Undo All (N)" button appears at the bottom.

---

## 🔒 8. Security Hardening

All security threats eliminated — ready for production hosting.

| Threat | Status |
|---|---|
| `DEBUG = True` hardcoded | Read from `.env`, defaults `False` |
| `ALLOWED_HOSTS = ['*']` | Explicit list from `.env` |
| `CORS_ALLOW_ALL_ORIGINS = True` | Whitelist from `.env` |
| Geo-validation client-side only | ✅ Fully server-side via `_validate_geo_location()` |
| Native `confirm()` dialog | Replaced with custom modal |
| QR payload spoofing | Branch-scoped student lookup prevents cross-branch attacks |

---

## 📋 9. Current Development Phase
*   **Phase:** Feature-complete, stable, production-safe.
*   **Latest Features:** Geo-Location Validation System, Global Campus Location, Excel Report Export.
*   **Hosting:** Backend → PythonAnywhere, Frontend → Netlify. See `For-Hosting.txt`.
*   **Database:** SQLite (`db.sqlite3`). Backup/Restore feature handles data migration.

---

## 🛠️ 10. How to Implement Future Features

1.  **New Backend Model**: Define in `models.py` → `makemigrations` → `migrate` → `admin.py` → `serializers.py` → `views.py` → `urls.py`.
2.  **New Frontend Feature**: State/API in `AppContext.jsx`. Respect `canEdit` checks. Use `lucide-react` icons.
3.  **Attendance Logic**: Changes must be made in 3 places — `StudentCard.jsx` (pie chart), `Dashboard.jsx` (Excel export), `core/views.py` (Twilio SMS + geo validation).
4.  **New Delete Operation**: Call `showUndoToast(msg, onDelete, onUndo)` from `AppContext`. Always pair with a confirm modal first.
5.  **New Geo-Zone**: Add via Django Admin → Campus Locations. Leave Branch blank for global. No code changes needed.

---
*Last Updated: 2026-05-27 — Geo-Location Validation System, Global Campus Locations, Excel Report Export (ExcelJS), Confirm+Undo Delete, Bulk Delete, Security Hardening.*
*Created by AI Developer Assistant for seamless context handoff.*
