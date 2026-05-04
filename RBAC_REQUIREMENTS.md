# Role-Based Access Control (RBAC) Requirements

## Overview
This document outlines the role-based access control requirements for Visual Placemat, defining what actions each user role can perform across different pages and features.

---

## Roles Definition

### 1. **Admin**
- **Description**: Platform owner/Cprime representative
- **Scope**: System-wide access, tenant management, billing
- **Access Level**: Full read + write + delete + configuration

### 2. **Client**
- **Description**: Organization representative (AmEx, Southwest, etc.)
- **Scope**: Own tenant data only
- **Access Level**: Read + limited write (no code/system edits), NO delete

### 3. **User (Editor)**
- **Description**: Individual contributor within a client organization
- **Scope**: Own tenant data + assigned diagrams
- **Access Level**: Read + write for assigned catalogs only

### 4. **Viewer**
- **Description**: Stakeholder with read-only access
- **Scope**: Assigned diagrams only
- **Access Level**: Read-only, no write/delete

---

## Page-Level Access Control Matrix

| Page | Route | Admin | Client | User (Editor) | Viewer |
|---|---|---|---|---|---|
| **Landing** | `/` | ✅ | ✅ | ✅ | ✅ |
| **Dashboard** | `/dashboard` | ✅ | ✅ | ✅ | ✅ (read-only) |
| **Documents (Upload)** | `/documents` | ✅ | ✅ | ✅ | ❌ |
| **Canvas (Edit)** | `/dashboard?mode=edit` | ✅ | ✅ | ✅ (assigned only) | ❌ |
| **Export** | `/export` | ✅ | ✅ | ✅ | ✅ (assigned only) |
| **Admin Panel** | `/admin` | ✅ | ❌ | ❌ | ❌ |
| **Tenant Settings** | `/settings/tenant` | ✅ | ✅ | ❌ | ❌ |
| **Billing** | `/settings/billing` | ✅ | ✅ | ❌ | ❌ |
| **User Management** | `/admin/users` | ✅ | ✅ (own tenant) | ❌ | ❌ |

---

## Feature-Level Permission Matrix

### **Dashboard Page** (`/dashboard`)

| Feature | Function | Admin | Client | User (Editor) | Viewer |
|---|---|---|---|---|---|
| **View Diagrams** | List all catalogs | ✅ | ✅ (own only) | ✅ (own only) | ✅ (assigned only) |
| **Create Diagram** | New catalog | ✅ | ✅ | ✅ | ❌ |
| **Edit Diagram** | Modify canvas | ✅ | ✅ | ✅ (assigned) | ❌ |
| **Delete Diagram** | Remove catalog | ✅ | ✅ | ❌ | ❌ |
| **Duplicate Diagram** | Clone catalog | ✅ | ✅ | ✅ | ❌ |
| **Share Diagram** | Create public link | ✅ | ✅ | ✅ | ✅ (read-only link) |
| **View Collaborators** | See who has access | ✅ | ✅ | ✅ | ❌ |
| **Add Collaborators** | Invite users | ✅ | ✅ | ❌ | ❌ |
| **Remove Collaborators** | Revoke access | ✅ | ✅ | ❌ | ❌ |

### **Canvas Page** (`/dashboard?mode=edit`)

| Feature | Function | Admin | Client | User (Editor) | Viewer |
|---|---|---|---|---|---|
| **View Canvas** | Render diagram | ✅ | ✅ | ✅ | ✅ |
| **Add Node** | New capability | ✅ | ✅ | ✅ (assigned) | ❌ |
| **Edit Node** | Modify name/desc | ✅ | ✅ | ✅ (assigned) | ❌ |
| **Delete Node** | Remove capability | ✅ | ✅ | ✅ (assigned) | ❌ |
| **Rearrange Nodes** | Drag/reposition | ✅ | ✅ | ✅ (assigned) | ❌ |
| **Apply AI Prompt** | Edit with natural language | ✅ | ✅ | ✅ (assigned) | ❌ |
| **Undo/Redo** | Revert changes | ✅ | ✅ | ✅ (assigned) | ❌ |
| **View History** | See change log | ✅ | ✅ | ✅ | ✅ |
| **Revert to Version** | Restore old version | ✅ | ✅ | ❌ | ❌ |

### **Documents Page** (`/documents`)

| Feature | Function | Admin | Client | User (Editor) | Viewer |
|---|---|---|---|---|---|
| **Upload File** | Excel/CSV import | ✅ | ✅ | ✅ | ❌ |
| **Validate Format** | Check column headers | ✅ | ✅ | ✅ | ❌ |
| **Replace File** | Re-upload same catalog | ✅ | ✅ | ✅ | ❌ |
| **Continue to Canvas** | Process file | ✅ | ✅ | ✅ | ❌ |
| **View Upload History** | Previous uploads | ✅ | ✅ | ✅ | ❌ |

### **Export Page** (`/export`)

| Feature | Function | Admin | Client | User (Editor) | Viewer |
|---|---|---|---|---|---|
| **Export PNG** | Raster image | ✅ | ✅ | ✅ (assigned) | ✅ (assigned) |
| **Export SVG** | Vector format | ✅ | ✅ | ✅ (assigned) | ✅ (assigned) |
| **Export PDF** | Document format | ✅ | ✅ | ✅ (assigned) | ✅ (assigned) |
| **Export JSON** | Data payload | ✅ | ✅ | ✅ (assigned) | ✅ (assigned) |
| **Export CSV** | Tabular data | ✅ | ✅ | ✅ (assigned) | ✅ (assigned) |
| **Export Excel** | XLSX workbook | ✅ | ✅ | ✅ (assigned) | ✅ (assigned) |
| **Create View Link** | Read-only share URL | ✅ | ✅ | ✅ (assigned) | ✅ (assigned) |
| **Create Duplicate Link** | Editable copy link | ✅ | ✅ | ✅ (assigned) | ❌ |

### **Admin Panel** (`/admin`)

| Feature | Function | Admin | Client | User (Editor) | Viewer |
|---|---|---|---|---|---|
| **View All Tenants** | List organizations | ✅ | ❌ | ❌ | ❌ |
| **Create Tenant** | Add organization | ✅ | ❌ | ❌ | ❌ |
| **Edit Tenant** | Modify org settings | ✅ | ❌ | ❌ | ❌ |
| **Suspend Tenant** | Disable access | ✅ | ❌ | ❌ | ❌ |
| **View System Logs** | Audit trail | ✅ | ❌ | ❌ | ❌ |
| **Manage Subscrptions** | Billing settings | ✅ | ❌ | ❌ | ❌ |

### **Tenant Settings** (`/settings/tenant`)

| Feature | Function | Admin | Client | User (Editor) | Viewer |
|---|---|---|---|---|---|
| **Edit Org Name** | Change tenant name | ✅ | ✅ | ❌ | ❌ |
| **Edit Org Description** | Update organization info | ✅ | ✅ | ❌ | ❌ |
| **Manage API Keys** | Create/revoke tokens | ✅ | ✅ | ❌ | ❌ |
| **View Members** | List tenant users | ✅ | ✅ | ✅ | ❌ |
| **Deactivate Account** | Disable tenant | ✅ | ✅ | ❌ | ❌ |

### **User Management** (`/admin/users`)

| Feature | Function | Admin | Client | User (Editor) | Viewer |
|---|---|---|---|---|---|
| **Invite User** | Send invitation | ✅ | ✅ (own tenant) | ❌ | ❌ |
| **Change User Role** | Modify permissions | ✅ | ✅ (own tenant) | ❌ | ❌ |
| **Deactivate User** | Remove access | ✅ | ✅ (own tenant) | ❌ | ❌ |
| **View User Activity** | See what users did | ✅ | ✅ (own tenant) | ✅ (self only) | ❌ |
| **Reset User MFA** | Reset 2FA | ✅ | ❌ | ❌ | ❌ |

### **Billing** (`/settings/billing`)

| Feature | Function | Admin | Client | User (Editor) | Viewer |
|---|---|---|---|---|---|
| **View Invoices** | See billing history | ✅ | ✅ | ❌ | ❌ |
| **Update Payment Method** | Change credit card | ✅ | ✅ | ❌ | ❌ |
| **Download Receipt** | Export invoice | ✅ | ✅ | ❌ | ❌ |
| **Change Plan** | Upgrade/downgrade | ✅ | ✅ | ❌ | ❌ |
| **View Billing Address** | Registered address | ✅ | ✅ | ❌ | ❌ |

---

## API Endpoint Protection

### Admin-Only Endpoints
```
DELETE   /api/admin/tenants/:id
POST     /api/admin/tenants
PUT      /api/admin/tenants/:id
GET      /api/admin/analytics
POST     /api/admin/users/:id/reset-mfa
```

### Client Endpoints (Own Tenant Only)
```
GET      /api/capabilities?catalogId=X          (client's own catalogs)
GET      /api/catalogs?tenantId=X               (client's own tenant)
POST     /api/documents                         (create in own tenant)
PUT      /api/capabilities/:id                  (if assigned)
DELETE   /api/capabilities/:id                  (client with admin role only)
```

### Public/Shared Endpoints
```
GET      /api/share/:shareToken                (public view link, read-only)
GET      /api/export/:shareToken/png           (public export, read-only)
```

---

## Client Role Restrictions

### What Client CANNOT Do
- ❌ Edit server-side code or configuration
- ❌ Access other tenants' data
- ❌ Create/delete capabilities (in some use cases)
- ❌ Access admin dashboard
- ❌ Manage platform-wide billing
- ❌ Reset user MFA
- ❌ View system logs
- ❌ Export sensitive data outside their org
- ❌ Permanently delete diagrams (soft delete only)

### What Client CAN Do
- ✅ Upload and parse Excel files
- ✅ Create diagrams from uploads
- ✅ Edit diagrams in canvas
- ✅ Invite team members to own tenant
- ✅ Manage own tenant settings
- ✅ Export in all formats (PNG, SVG, PDF, JSON, CSV, Excel)
- ✅ Create read-only view links
- ✅ Manage tenant-level API keys
- ✅ View own usage/billing

---

## User (Editor) Role Restrictions

### What User CANNOT Do
- ❌ Invite other users
- ❌ Change user roles
- ❌ Delete diagrams
- ❌ Access tenant settings
- ❌ View billing
- ❌ Create API keys
- ❌ See other users' activity (except shared diagrams)

### What User CAN Do
- ✅ Create diagrams (assigned access)
- ✅ Edit diagrams (assigned access only)
- ✅ Upload files
- ✅ Export in all formats
- ✅ Create view links (read-only)
- ✅ View own activity/history

---

## Viewer Role (Read-Only)

### What Viewer CANNOT Do
- ❌ Create anything
- ❌ Edit anything
- ❌ Delete anything
- ❌ Upload files
- ❌ Create view links with edit rights
- ❌ Access any settings

### What Viewer CAN Do
- ✅ View assigned diagrams
- ✅ Export diagrams (all formats, read-only)
- ✅ View history (read-only)
- ✅ Access public share links

---

## Implementation Requirements

### 1. **Database Layer**
```sql
-- Add role and tenant to users table
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'viewer';  -- admin, client, user, viewer
ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Add assignment table for diagram access
CREATE TABLE diagram_assignments (
  id UUID PRIMARY KEY,
  diagram_id UUID REFERENCES visual_maps(id),
  user_id UUID REFERENCES users(id),
  role TEXT DEFAULT 'editor',  -- viewer, editor
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(diagram_id, user_id)
);
```

### 2. **Middleware**
```typescript
// Middleware to extract and validate role from JWT token
export async function validateRole(req: Request, requiredRoles: string[]) {
  const token = req.headers.get('authorization');
  const payload = jwt.verify(token);
  
  if (!requiredRoles.includes(payload.role)) {
    return new Response('Unauthorized', { status: 403 });
  }
  
  return payload;
}
```

### 3. **API Route Protection**
```typescript
// Example: DELETE catalog (admin/client only)
export async function DELETE(req: Request, { params }) {
  const user = await validateRole(req, ['admin', 'client']);
  if (!user) return new Response('Forbidden', { status: 403 });
  
  const { catalogId } = params;
  const catalog = await db.query(
    'SELECT tenant_id FROM capability_catalogs WHERE id = $1',
    [catalogId]
  );
  
  // Client can only delete their own tenant's catalogs
  if (user.role === 'client' && catalog.tenant_id !== user.tenant_id) {
    return new Response('Forbidden', { status: 403 });
  }
  
  await db.delete('capability_catalogs', catalogId);
  return new Response('Deleted');
}
```

### 4. **Frontend Components**
```typescript
// Conditional rendering based on role
import { useAuth } from '@/lib/auth/hooks';

export function Dashboard() {
  const { user } = useAuth(); // { role, tenant_id }
  
  return (
    <>
      {/* Show upload button for Admin, Client, User */}
      {['admin', 'client', 'user'].includes(user.role) && (
        <button>Upload Excel</button>
      )}
      
      {/* Show delete button for Admin and Client only */}
      {['admin', 'client'].includes(user.role) && (
        <button>Delete</button>
      )}
      
      {/* Show settings for Admin and Client only */}
      {['admin', 'client'].includes(user.role) && (
        <Link href="/settings">Settings</Link>
      )}
      
      {/* Show admin panel for Admin only */}
      {user.role === 'admin' && (
        <Link href="/admin">Admin Panel</Link>
      )}
    </>
  );
}
```

### 5. **Row-Level Security (RLS) Policies**
```sql
-- Users can only see their own tenant's catalogs
CREATE POLICY "tenant_isolation" ON capability_catalogs
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Admins can see all catalogs
CREATE POLICY "admin_override" ON capability_catalogs
  FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
```

---

## Invitation & Onboarding Flow

### Client Onboarding
1. **Admin** creates tenant for organization
2. **Client admin** is invited and assigned `client` role
3. **Client admin** invites team members (`user` or `viewer` roles)
4. Team members accept invitation, get access to tenant diagrams

### User Onboarding
1. **Client/Admin** invites user via email
2. User accepts and signs up
3. User is assigned to specific catalogs with `editor` or `viewer` role
4. User can only access assigned catalogs

---

## Audit & Logging

### Actions to Log (by role)
```
✅ Admin: All actions (system-wide)
✅ Client: All actions within own tenant
✅ User: Create, edit, delete of assigned catalogs
✅ Viewer: None (read-only, no changes)
```

### Log Schema
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT,  -- 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'
  resource_type TEXT,  -- 'capability', 'catalog', 'user'
  resource_id UUID,
  tenant_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  changes JSONB  -- What changed
);
```

---

## Summary Table

| Role | Read Own Tenant | Write Own Tenant | Delete Dialogs | Admin Access | Invite Users |
|---|---|---|---|---|---|
| **Admin** | ✅ All | ✅ All | ✅ Yes | ✅ Full | ✅ Yes |
| **Client** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ✅ Yes (own) |
| **User** | ✅ Assigned | ✅ Assigned | ❌ No | ❌ No | ❌ No |
| **Viewer** | ✅ Assigned | ❌ No | ❌ No | ❌ No | ❌ No |

---

## Next Steps

1. **Implement authentication middleware** — Validate JWT tokens with role claims
2. **Add role column to users table** — Track user role per tenant
3. **Create assignment table** — Map users to catalogs with granular permissions
4. **Update all API routes** — Add role checks and tenant isolation
5. **Add UI guards** — Show/hide buttons based on role
6. **Implement RLS policies** — Database-level enforcement
7. **Add audit logging** — Track all permission-sensitive actions
8. **Test RBAC** — Verify each role can/cannot access expected features
