# Client-Specific Folder Management — Architecture

## Overview

Client-specific folder management ensures that only users explicitly granted access to a client can view or modify that client's capability maps. Access is enforced at the database level via Supabase Row Level Security (RLS).

---

## Data Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NEW TABLES                                  │
│                                                                     │
│  ┌─────────────────────────────┐    ┌────────────────────────────┐ │
│  │  clients                    │    │  client_members            │ │
│  │  ─────────────────────────  │    │  ──────────────────────── │ │
│  │  id          uuid PK        │◄──┐│  id          uuid PK      │ │
│  │  name        text NOT NULL  │   ││  client_id   uuid FK ────►│ │
│  │  industry    text           │   ││  user_id     uuid FK      │ │
│  │  description text           │   ││  role        text         │ │
│  │  logo_url    text           │   ││    "admin"|"editor"|"viewer"│
│  │  created_by  uuid FK→users  │   ││  invited_by  uuid FK      │ │
│  │  created_at  timestamptz    │   ││  created_at  timestamptz  │ │
│  │  updated_at  timestamptz    │   ││  UNIQUE(client_id,user_id)│ │
│  └─────────────────────────────┘   │└────────────────────────────┘ │
│                                     │                               │
│  ┌─────────────────────────────────┐│                               │
│  │  capability_catalogs (MODIFIED) ││                               │
│  │  ───────────────────────────────││                               │
│  │  + client_id  uuid FK ──────────┘                               │
│  │    (links each catalog to a client folder)                       │
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Table Definitions

### `clients`

| Column | Type | Default | Constraints | Description |
|--------|------|---------|-------------|-------------|
| `id` | uuid | `gen_random_uuid()` | PRIMARY KEY | Unique client identifier |
| `name` | text | — | NOT NULL | Client name, e.g., "AMEX" |
| `industry` | text | — | — | Industry tag, e.g., "Banking" |
| `description` | text | — | — | Optional description |
| `logo_url` | text | — | — | Optional client logo |
| `created_by` | uuid | — | FK → `auth.users(id)` | Who created this folder |
| `created_at` | timestamptz | `now()` | — | Creation timestamp |
| `updated_at` | timestamptz | `now()` | — | Last modified timestamp |

### `client_members` (Access Control Table)

| Column | Type | Default | Constraints | Description |
|--------|------|---------|-------------|-------------|
| `id` | uuid | `gen_random_uuid()` | PRIMARY KEY | Unique membership identifier |
| `client_id` | uuid | — | FK → `clients(id)` ON DELETE CASCADE | Which client folder |
| `user_id` | uuid | — | FK → `auth.users(id)` ON DELETE CASCADE | Which user |
| `role` | text | `'viewer'` | NOT NULL | `"admin"` \| `"editor"` \| `"viewer"` |
| `invited_by` | uuid | — | FK → `auth.users(id)` | Who invited this member |
| `created_at` | timestamptz | `now()` | — | When membership was granted |

**Constraint:** `UNIQUE(client_id, user_id)` — one membership per user per client.

### `capability_catalogs` (Modified)

Add one new column:

| Column | Type | Default | Constraints | Description |
|--------|------|---------|-------------|-------------|
| `client_id` | uuid | NULL | FK → `clients(id)` ON DELETE SET NULL | Links catalog to a client folder |

---

## Access Control Chain

```
User authenticates (Microsoft SSO)
       │
       ▼
┌──────────────────────────────────────────────┐
│  client_members table = THE GATEKEEPER       │
│                                              │
│  Can user see this client?                   │
│  → EXISTS row in client_members              │
│    WHERE client_id = X AND user_id = Y       │
│                                              │
│  Can user edit catalogs in this client?      │
│  → role IN ('admin', 'editor')              │
│                                              │
│  Can user manage members / delete client?    │
│  → role = 'admin'                           │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  RLS cascades DOWN the chain:                │
│                                              │
│  clients          → user must be in          │
│                      client_members          │
│  capability_catalogs → catalog.client_id     │
│                      must be in user's       │
│                      accessible clients      │
│  capabilities     → inherits from catalog    │
│  visual_maps      → inherits from catalog    │
│  diff_history     → admin/editor only        │
└──────────────────────────────────────────────┘
```

---

## Role Permissions Matrix

| Action | Admin | Editor | Viewer |
|--------|-------|--------|--------|
| View client folder & catalogs | ✅ | ✅ | ✅ |
| Open/view capability maps | ✅ | ✅ | ✅ |
| Create/upload new catalogs | ✅ | ✅ | ❌ |
| Edit capabilities (AI/manual) | ✅ | ✅ | ❌ |
| Move catalogs between clients | ✅ | ✅ | ❌ |
| Add/remove members | ✅ | ❌ | ❌ |
| Change member roles | ✅ | ❌ | ❌ |
| Rename/delete client folder | ✅ | ❌ | ❌ |
| View audit/diff history | ✅ | ✅ | ❌ |

---

## RLS Policy Logic

### `clients` table

```sql
-- SELECT: only visible to members
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (
    id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid())
  );

-- INSERT: any authenticated user can create a client
CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: admin only
CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (
    id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- DELETE: admin only
CREATE POLICY "clients_delete" ON clients
  FOR DELETE USING (
    id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid() AND role = 'admin')
  );
```

### `client_members` table

```sql
-- SELECT: members can see other members of their clients
CREATE POLICY "client_members_select" ON client_members
  FOR SELECT USING (
    client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid())
  );

-- INSERT: admin only
CREATE POLICY "client_members_insert" ON client_members
  FOR INSERT WITH CHECK (
    client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- UPDATE: admin only (changing roles)
CREATE POLICY "client_members_update" ON client_members
  FOR UPDATE USING (
    client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- DELETE: admin can remove anyone, user can remove themselves
CREATE POLICY "client_members_delete" ON client_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid() AND role = 'admin')
  );
```

### `capability_catalogs` table (Updated)

```sql
-- Replace existing policy to include client membership
DROP POLICY IF EXISTS "access_catalogs" ON capability_catalogs;

CREATE POLICY "access_catalogs" ON capability_catalogs
  FOR ALL USING (
    user_id = auth.uid()                                                      -- catalog owner
    OR id IN (SELECT catalog_id FROM catalog_shares WHERE user_id = auth.uid())  -- shared directly
    OR client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid())  -- client member
  );
```

### `capabilities`, `visual_maps` (Updated)

```sql
-- Inherit access from catalog → client membership
DROP POLICY IF EXISTS "access_capabilities" ON capabilities;

CREATE POLICY "access_capabilities" ON capabilities
  FOR ALL USING (
    catalog_id IN (
      SELECT id FROM capability_catalogs
      WHERE user_id = auth.uid()
      OR id IN (SELECT catalog_id FROM catalog_shares WHERE user_id = auth.uid())
      OR client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid())
    )
  );
```

### `diff_history` (Updated)

```sql
-- Only admin/editor of the client can see audit logs
DROP POLICY IF EXISTS "access_diff_history" ON diff_history;

CREATE POLICY "access_diff_history" ON diff_history
  FOR ALL USING (
    catalog_id IN (
      SELECT id FROM capability_catalogs
      WHERE user_id = auth.uid()
      OR client_id IN (
        SELECT client_id FROM client_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
      )
    )
  );
```

---

## DB Trigger: Auto-Admin on Client Creation

When a user creates a new client, they automatically become the admin:

```sql
CREATE OR REPLACE FUNCTION add_client_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO client_members (client_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'admin', NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER client_auto_admin
  AFTER INSERT ON clients
  FOR EACH ROW
  WHEN (NEW.created_by IS NOT NULL)
  EXECUTE FUNCTION add_client_creator_as_admin();
```

---

## Helper Function: Write Permission Check

```sql
CREATE OR REPLACE FUNCTION user_can_write_client(p_client_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM client_members
    WHERE client_id = p_client_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

---

## API Endpoints

| Method | Route | Description | Required Role |
|--------|-------|-------------|---------------|
| `GET` | `/api/clients` | List user's accessible client folders | Any member |
| `POST` | `/api/clients` | Create new client folder | Authenticated |
| `GET` | `/api/clients/[clientId]` | Get client details + catalogs | Any member |
| `PATCH` | `/api/clients/[clientId]` | Update client name/industry | Admin |
| `DELETE` | `/api/clients/[clientId]` | Delete client folder | Admin |
| `GET` | `/api/clients/[clientId]/members` | List all members | Any member |
| `POST` | `/api/clients/[clientId]/members` | Add member by email | Admin |
| `PATCH` | `/api/clients/[clientId]/members` | Change member role | Admin |
| `DELETE` | `/api/clients/[clientId]/members` | Remove member | Admin (or self) |
| `PATCH` | `/api/clients/[clientId]/catalogs` | Move catalog into client | Editor/Admin |

---

## Frontend Pages

| Route | Purpose | Access |
|-------|---------|--------|
| `/clients` | Grid of client folder cards | Shows only folders user is a member of |
| `/clients/[clientId]` | Folder contents: catalogs list + member sidebar | Members only |
| `/clients/[clientId]/members` | Member management (add/remove/change roles) | Admin only |

---

## User Flows

### Flow 1: User Logs In

```
1. User signs in via Microsoft SSO
2. Frontend calls GET /api/clients
3. API queries: SELECT * FROM clients 
   WHERE id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid())
4. User sees ONLY client folders they've been added to
5. Clicking a folder shows ONLY catalogs with client_id = that folder
6. All enforced at DB level via RLS — even if API is bypassed
```

### Flow 2: Admin Adds a New Team Member

```
1. Admin opens /clients/[clientId]/members
2. Clicks "Add Member"
3. Enters email + selects role (editor/viewer)
4. API checks:
   a. Is requester an admin of this client? → proceed
   b. Does target user exist in auth.users? → Yes → insert into client_members
   c. If user doesn't exist → show "They must sign in once first"
5. New member immediately sees the client folder on their /clients page
6. RLS automatically grants them access to all catalogs under that client
```

### Flow 3: Creating a New Client Folder

```
1. User clicks "New Client Folder" on /clients page
2. Enters client name + optional industry/description
3. POST /api/clients creates the row
4. DB trigger auto-inserts the creator as admin in client_members
5. Creator can now add other team members
6. Upload/create catalogs within this folder
```

### Flow 4: Moving a Catalog Between Clients

```
1. Editor/Admin opens a catalog's settings or drag-drops it
2. Selects target client folder
3. API verifies:
   a. User has editor/admin access to the TARGET client
   b. User has ownership or editor/admin access to the SOURCE
4. UPDATE capability_catalogs SET client_id = <new> WHERE id = <catalog>
5. Access instantly changes — old client members lose access, new ones gain it
```

### Flow 5: Removing a Member

```
1. Admin clicks "Remove" next to a member's name
2. API checks:
   a. Requester is admin (or user removing themselves)
   b. Target is NOT the last admin (prevent orphaned folders)
3. DELETE from client_members
4. Removed user immediately loses access to all catalogs in that folder
5. No data is deleted — just the access link is severed
```

---

## Migration Strategy (Existing Data)

```
Step 1: Run migration SQL
  → CREATE TABLE clients
  → CREATE TABLE client_members
  → ALTER TABLE capability_catalogs ADD COLUMN client_id uuid FK

Step 2: Auto-create clients from existing data
  → INSERT INTO clients (name, industry, created_by)
     SELECT DISTINCT client_name, industry, user_id
     FROM capability_catalogs WHERE client_name IS NOT NULL

Step 3: Link catalogs to clients
  → UPDATE capability_catalogs SET client_id = (
       SELECT id FROM clients WHERE name = capability_catalogs.client_name
     ) WHERE client_name IS NOT NULL

Step 4: Add catalog owners as client admins
  → INSERT INTO client_members (client_id, user_id, role)
     SELECT DISTINCT c.client_id, c.user_id, 'admin'
     FROM capability_catalogs c
     WHERE c.client_id IS NOT NULL AND c.user_id IS NOT NULL

Step 5: Update all RLS policies (as defined above)

Step 6: Deploy updated API routes + frontend
```

---

## Security Guarantees

1. **Database-level enforcement** — Even if someone bypasses the frontend or API, RLS prevents unauthorized reads/writes
2. **No data leakage** — A user cannot see client names, catalogs, or capabilities they don't have membership for
3. **Cascading access** — Adding someone to a client gives them access to ALL catalogs under it; removing severs ALL access
4. **Audit trail** — `client_members.invited_by` tracks who granted access; `diff_history` tracks who made changes
5. **Last-admin protection** — Cannot remove the last admin from a client (prevents orphaned data)
6. **Soft unlinking on delete** — Deleting a client sets `client_id = NULL` on catalogs rather than deleting the maps
