# CapMap — Role-Based Access Control

> This document defines what each role can and cannot do within CapMap. Roles are introduced in **v2** (when authentication is added). In MVP, there are no roles — every user has full access to their own catalogs.

---

## Roles Overview

| Role | Who is this? | Introduced |
|------|-------------|-----------|
| **Client** | The end client (e.g., a contact at Standard Chartered). Read-only access to review maps shared with them. | v3 |
| **Consultant** | A consulting firm employee who builds and edits capability maps for clients. The primary user. | v2 |
| **Admin** | A senior person at the consulting firm who manages users, settings, and the knowledge base. | v3 |

---

## Role Permissions Matrix

| Action | Client | Consultant | Admin |
|--------|--------|-----------|-------|
| **Viewing** | | | |
| View catalogs shared with them | ✅ | ✅ | ✅ |
| View the visual map (canvas) | ✅ | ✅ | ✅ |
| View version history | ✅ | ✅ | ✅ |
| View node details (name, description, level) | ✅ | ✅ | ✅ |
| View all catalogs across the organisation | ❌ | ❌ | ✅ (read-only) |
| **Editing** | | | |
| Upload an Excel file | ❌ | ✅ | ✅ |
| Create a new catalog | ❌ | ✅ | ✅ |
| Manually edit the map (add, remove, rename, drag) | ❌ | ✅ | ✅ |
| Use AI prompts to edit the map | ❌ | ✅ | ✅ |
| Apply or cancel AI-proposed changes | ❌ | ✅ | ✅ |
| Undo / redo changes | ❌ | ✅ | ✅ |
| Restore a previous version | ❌ | ✅ | ✅ |
| Archive or restore a catalog | ❌ | ✅ (own only) | ✅ (any) |
| **Sharing & Collaboration** | | | |
| Share a catalog with another user | ❌ | ✅ (own catalogs) | ✅ (any catalog) |
| Set share permissions (viewer/editor) | ❌ | ✅ (own catalogs) | ✅ (any catalog) |
| Revoke another user's access | ❌ | ✅ (own catalogs) | ✅ (any catalog) |
| Comment on a node | ✅ | ✅ | ✅ |
| Reply to comments | ✅ | ✅ | ✅ |
| **Exporting** | | | |
| Export as PNG | ✅ | ✅ | ✅ |
| Export as PPTX / PDF / SVG / Excel / CSV | ❌ | ✅ | ✅ |
| Export to Confluence / Miro | ❌ | ✅ | ✅ |
| **Knowledge Base** | | | |
| Benefit from AI suggestions (read) | ❌ | ✅ | ✅ |
| View knowledge base entries | ❌ | ❌ | ✅ |
| Add / edit / delete knowledge base entries | ❌ | ❌ | ✅ |
| Import industry frameworks (TOGAF, BIAN, etc.) | ❌ | ❌ | ✅ |
| **Administration** | | | |
| Invite users to the organisation | ❌ | ❌ | ✅ |
| Remove users from the organisation | ❌ | ❌ | ✅ |
| Assign or change user roles | ❌ | ❌ | ✅ |
| Set available industries in the dropdown | ❌ | ❌ | ✅ |
| Define custom validation rules | ❌ | ❌ | ✅ |
| Edit the AI system prompt | ❌ | ❌ | ✅ |
| Upload branded PPTX templates | ❌ | ❌ | ✅ |
| Set mandatory fields on catalog creation | ❌ | ❌ | ✅ |
| Configure export watermarking (firm logo) | ❌ | ❌ | ✅ |
| View and export the audit log | ❌ | ❌ | ✅ |
| Manage billing and subscription | ❌ | ❌ | ✅ |
| **Approval Workflows (v3)** | | | |
| Submit changes for approval | ❌ | ✅ | ✅ |
| Approve or reject pending changes | ❌ | ❌ | ✅ |

---

## Role Details

### Client

**Who:** An external contact at the client organisation (e.g., a VP of Strategy at Standard Chartered who wants to review the capability map the consulting team built).

**What they can do:**
- View any catalog that has been explicitly shared with them.
- See the visual map, zoom, pan, and read node details.
- Add comments on nodes (questions, feedback, action items).
- Export the map as a PNG image for their own records.
- View the version history to see how the map evolved.

**What they cannot do:**
- Create, upload, or edit any catalog.
- Use AI prompts.
- Access any catalog not shared with them.
- Export in editable formats (PPTX, Excel, CSV).
- Access the knowledge base, admin settings, or audit logs.
- Share the catalog with others.

**Why:** Clients should be able to review and give feedback, but should never accidentally (or intentionally) change the map. They also should not have access to editable export formats that could be modified and misrepresented.

---

### Consultant

**Who:** A consulting firm employee who builds capability maps for clients. This is the primary user of CapMap.

**What they can do:**
- Upload Excel files and create new catalogs.
- Fully edit any catalog they own: manual edits, AI prompts, undo/redo, version restore.
- Share their own catalogs with other consultants (as viewer or editor) or with clients (as viewer).
- Export in all formats: PNG, PPTX, PDF, SVG, Excel, CSV.
- Push to Confluence or Miro.
- View and use AI suggestions from the knowledge base.
- Comment on nodes in shared catalogs.
- Submit changes for approval (when approval workflow is enabled).

**What they cannot do:**
- See another consultant's catalogs unless they've been shared.
- View or edit the knowledge base directly.
- Invite or remove users from the organisation.
- Change roles or permissions.
- Access admin settings (validation rules, system prompts, branding).
- Approve changes in the approval workflow (only Admins can approve).
- View the audit log.

**Why:** Consultants need full creative control over their own work but should not be able to affect system-wide settings, other users' work, or the AI knowledge base.

---

### Admin

**Who:** A senior person at the consulting firm (e.g., Practice Lead, CTO, or designated tool administrator) who manages the CapMap instance for the entire organisation.

**What they can do:**
- Everything a Consultant can do, plus:
- **User management:** Invite users, remove users, assign roles (Client/Consultant/Admin).
- **View all catalogs** across the organisation (read-only, for oversight).
- **Knowledge base management:** Add, edit, delete capability patterns and industry templates.
- **Import frameworks:** Load TOGAF, BIAN, HL7, or custom frameworks into the knowledge base.
- **System prompt editing:** Modify the AI instructions without engineering involvement.
- **Validation rules:** Create, edit, and enforce custom structural rules.
- **Branding:** Upload PPTX templates, set export watermarks with firm logo.
- **Configuration:** Set available industries, mandatory fields, default layouts.
- **Audit log:** View the full immutable log of all actions across the organisation. Export as CSV.
- **Approval workflows:** Approve or reject changes submitted by consultants.
- **Billing:** Manage subscription tier and view usage.

**What they cannot do:**
- Delete the audit log (it's immutable).
- Access another Admin's personal draft work (only saved/shared catalogs are visible).
- Bypass validation rules they've set (rules apply to everyone, including Admins).

**Why:** Admins need full oversight and governance control to maintain quality, compliance, and consistency across all consulting engagements.

---

## MVP: No Roles

In the MVP, there are no roles and no authentication:
- Every user has full access to their own catalogs.
- No user can see another user's catalogs (isolated by browser session ID).
- There is no sharing, no admin panel, and no knowledge base management.
- Roles are introduced in **v2** (Consultant) and **v3** (Client, Admin).

---

## Role Introduction Timeline

| Phase | Roles Available | Key Addition |
|-------|----------------|-------------|
| MVP | None (no auth) | Full access to own catalogs |
| v2 | Consultant | Sign in, catalog sharing, team collaboration |
| v3 | Client, Admin | Read-only client access, organisation governance |

---

## Sharing Permissions vs Roles

When a Consultant shares a catalog, they choose a **sharing level** — this is separate from the user's role:

| Sharing Level | Can View | Can Edit | Can Share |
|--------------|----------|----------|-----------|
| Viewer | ✅ | ❌ | ❌ |
| Editor | ✅ | ✅ | ❌ |
| Owner | ✅ | ✅ | ✅ |

**Interaction with roles:**
- A **Client** can only be given **Viewer** access (never Editor or Owner).
- A **Consultant** can be given Viewer, Editor, or Owner access.
- An **Admin** can view any catalog regardless of sharing settings (read-only oversight).

---

## Data Isolation Rules

| Scenario | What happens |
|----------|-------------|
| Consultant A creates a catalog | Only Consultant A can see it |
| Consultant A shares with Consultant B as Editor | Both A and B can see and edit it |
| Consultant A shares with Client C as Viewer | Client C can view and comment, but not edit |
| Admin views organisation catalogs | Admin sees all catalogs (read-only), but cannot edit unless shared as Editor |
| Consultant A archives a catalog | Hidden from dashboard, but still accessible to Admin and anyone it was shared with |
| Consultant A is removed from the org | Their catalogs are reassigned to Admin (not deleted) |
