# Folder Access, Diagram Archive, and Admin Portal TODO

Date: 2026-08-06
Status: Planned, not implemented

## Goal

Provide a complete folder and access-management workflow:

- A user can archive and restore a personal diagram they own.
- A client-folder admin can manage the folder and its members.
- Editors can create and edit diagrams in their assigned folders.
- Viewers can only view and export diagrams.
- A platform admin can see every folder, diagram, and membership, then grant, change, or remove access.

## Current State

### Already available

- `/clients` lists client folders and can create a client folder.
- Creating a client automatically makes the creator a folder `admin`.
- `/clients/[clientId]/members` can add an existing user by email.
- Folder roles are `admin`, `editor`, and `viewer`.
- Folder admins can change roles and remove members.
- The API prevents demoting or removing the last folder admin.
- Editors and admins can create diagrams inside a client folder.
- Viewers are blocked from the catalog save API.

### Missing or incomplete

- Personal and client diagrams cannot be archived or restored from the UI.
- There is no catalog archive/delete API.
- There is no archived-diagrams view.
- The folder archive action only prefixes the description with `[ARCHIVED]`; it does not archive the folder or its diagrams.
- The member page exposes role controls to every folder member even though the API rejects non-admin changes.
- Member rows show UUIDs rather than name/email.
- Moving a diagram into a folder verifies destination access but does not verify ownership or write access to the source diagram.
- Service-role database calls bypass RLS, so every mutating API must perform explicit authorization.
- There is no platform-admin role, admin route guard, or admin portal.
- There is no access-change audit log.
- Template instantiation through the client API does not yet clone style categories and category assignments.

## Permission Matrix

| Action | Personal owner | Folder admin | Folder editor | Folder viewer | Platform admin |
| --- | --- | --- | --- | --- | --- |
| View diagram | Yes | Yes | Yes | Yes | Yes |
| Export diagram | Yes | Yes | Yes | Yes | Yes |
| Edit diagram | Yes | Yes | Yes | No | Yes |
| Create diagram in folder | N/A | Yes | Yes | No | Yes |
| Archive diagram | Yes | Yes | No | No | Yes |
| Restore diagram | Yes | Yes | No | No | Yes |
| Permanently delete diagram | No | No | No | No | Optional future action |
| Rename/archive folder | N/A | Yes | No | No | Yes |
| Add/remove members | N/A | Yes | No | No | Yes |
| Change member roles | N/A | Yes | No | No | Yes |
| View all folders | No | Assigned only | Assigned only | Assigned only | Yes |

## Phase 0: Authorization Foundation

- [ ] Add shared server authorization helpers:
  - [ ] `getCatalogAccess(catalogId, userId)` returning owner/folder role/share access.
  - [ ] `requireCatalogView(...)`.
  - [ ] `requireCatalogEdit(...)`.
  - [ ] `requireCatalogArchive(...)`.
  - [ ] `requireClientAdmin(...)`.
  - [ ] `requirePlatformAdmin(...)`.
- [ ] Use the helpers in every catalog, client, transcript, export, chat, note, restore, and save mutation route.
- [ ] Fix `PATCH /api/clients/[clientId]/catalogs`:
  - [ ] Require editor/admin access to the destination folder.
  - [ ] Require ownership or admin access to the source diagram.
  - [ ] Reject moving a diagram out of another folder without source-folder admin permission.
- [ ] Split catalog RLS into explicit `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies.
- [ ] Ensure viewers cannot write capabilities, visual maps, styles, notes, chat history, or transcripts directly.
- [ ] Add API tests for cross-folder and crafted-request access attempts.

### Acceptance tests

- [ ] A viewer receives `403` for every write endpoint.
- [ ] An editor can edit but cannot archive a client diagram.
- [ ] A user cannot move another user's personal diagram into a folder.
- [ ] A folder editor cannot move a diagram out of a folder they do not administer.
- [ ] A platform admin can perform authorized support operations with an audit record.

## Phase 1: Diagram Archive and Restore

- [ ] Use the existing `capability_catalogs.status` field with `active` and `archived` values.
- [ ] Add `archived_at`, `archived_by`, and optional `archive_reason` columns.
- [ ] Add `POST /api/catalogs/[id]/archive`.
- [ ] Add `POST /api/catalogs/[id]/restore`.
- [ ] Keep hard deletion disabled for normal users.
- [ ] Authorization:
  - [ ] Personal diagram: only `user_id` owner can archive/restore.
  - [ ] Client diagram: only folder admin can archive/restore.
  - [ ] Platform admin can archive/restore with an audit reason.
- [ ] Add an archive action to diagram rows and the dashboard menu.
- [ ] Add a confirmation dialog showing the diagram and folder name.
- [ ] Add an `Archived` page/filter to My Works and each client folder.
- [ ] Add restore actions for authorized users.
- [ ] Hide archived diagrams from normal lists and direct edit navigation.
- [ ] Preserve capabilities, styles, versions, transcripts, and history when archived.

### Acceptance tests

- [ ] A personal owner can archive and restore their diagram.
- [ ] A folder admin can archive and restore a folder diagram.
- [ ] Editors and viewers cannot archive client diagrams.
- [ ] Archived diagrams disappear from active lists but remain recoverable.
- [ ] Direct access to an archived diagram shows an archived state instead of editing controls.

## Phase 2: Client Folder Management Completion

- [ ] Add a prominent `New client folder` action to My Works, linking to or reusing `/clients` creation UI.
- [ ] After creation, route directly to the new folder and show the creator as admin.
- [ ] Replace the current fake folder archive behavior with a real folder status:
  - [ ] Add `clients.status`, `archived_at`, and `archived_by`.
  - [ ] Archive/unarchive the folder without modifying its description.
  - [ ] Decide whether folder archive automatically archives diagrams or only hides the folder.
- [ ] Show the current user's folder role on folder cards.
- [ ] Make the members page admin-aware:
  - [ ] Admins see add, role, and remove controls.
  - [ ] Editors/viewers see a read-only member list or no member list, according to product policy.
- [ ] Return member email and display name from a safe profile source instead of UUID-only rows.
- [ ] Allow admins to invite as `viewer`, `editor`, or `admin`.
- [ ] Keep last-admin safeguards and require confirmation when promoting another admin.
- [ ] Show clear permission descriptions:
  - [ ] Viewer: view and export only.
  - [ ] Editor: create and edit diagrams; no access management or archive.
  - [ ] Admin: manage folder, diagrams, and members.
- [ ] Add success/error feedback for folder creation and member changes.
- [ ] Clone style categories, assignments, legends, and legacy styles when instantiating templates in a client folder.

### Current usage after implementation

1. Open `My Works` and choose `New client folder`.
2. Enter the client/folder name, industry, and optional description.
3. Open the new folder and choose `Manage Members`.
4. Enter an existing user's email and select Viewer, Editor, or Admin.
5. Change a role from the member table or choose Remove Access.
6. Create a blank diagram or instantiate a template inside the folder.

## Phase 3: Platform Admin Identity

- [ ] Add a server-owned `user_profiles` table:
  - [ ] `user_id uuid primary key references auth.users(id)`.
  - [ ] `display_name text`.
  - [ ] `email text` synchronized from auth and never trusted from client input.
  - [ ] `platform_role text check (platform_role in ('user', 'admin'))`.
  - [ ] `created_at`, `updated_at`, and `last_seen_at`.
- [ ] Backfill profiles for existing auth users.
- [ ] Add a database trigger or trusted server sync for new users.
- [ ] Seed the first platform admin through a migration/environment allowlist, not a public API.
- [ ] Implement `requirePlatformAdmin()` using the database role.
- [ ] Protect `/admin` in both the page layout and every admin API route.
- [ ] Never authorize platform admin from editable browser metadata alone.

### Acceptance tests

- [ ] Normal authenticated users receive `403` from admin APIs.
- [ ] Direct navigation to `/admin` is blocked for non-admin users.
- [ ] Platform admins can access admin APIs and every action is audited.
- [ ] A platform admin cannot remove their own final platform-admin role.

## Phase 4: Admin Portal

- [ ] Add `/admin` with operational summary counts:
  - [ ] Users.
  - [ ] Active/archived client folders.
  - [ ] Active/archived diagrams.
  - [ ] Memberships by role.
- [ ] Add `/admin/folders`:
  - [ ] Search by folder/client name.
  - [ ] Filter active/archived.
  - [ ] Show creator, created date, diagram count, and member count.
  - [ ] Open a folder access drawer.
- [ ] Add `/admin/folders/[clientId]` or a drawer with:
  - [ ] Folder metadata and diagrams.
  - [ ] Member names/emails and roles.
  - [ ] Add existing user access.
  - [ ] Change Viewer/Editor/Admin role.
  - [ ] Remove access.
  - [ ] Promote a replacement before removing the last folder admin.
  - [ ] Archive/restore the folder.
- [ ] Add `/admin/users`:
  - [ ] Search users by name/email.
  - [ ] Show folders and role in each folder.
  - [ ] Grant access to a folder.
  - [ ] Change or remove folder access.
  - [ ] Disable future login only after a separate account-status design is approved.
- [ ] Add `/admin/diagrams`:
  - [ ] Search by diagram name, owner, or folder.
  - [ ] Show active/archived status and last update.
  - [ ] Archive/restore with reason.
- [ ] Use dense tables, filters, status chips, and confirmation dialogs suitable for repeated administration.
- [ ] Paginate all global user/folder/diagram lists.

## Phase 5: Audit Log

- [ ] Add `access_audit_log` with:
  - [ ] Actor user ID.
  - [ ] Action type.
  - [ ] Target user ID.
  - [ ] Client/catalog ID.
  - [ ] Previous and new role/status JSON.
  - [ ] Reason.
  - [ ] Timestamp and request correlation ID.
- [ ] Log folder creation, rename, archive, restore, and deletion.
- [ ] Log member add, role change, removal, and self-removal.
- [ ] Log diagram archive and restore.
- [ ] Log platform-admin changes.
- [ ] Add a read-only `/admin/audit` page with filters.
- [ ] Prevent application users from updating or deleting audit records.

## Phase 6: Automated RBAC Tests

- [ ] Add fixtures for two users, two folders, and admin/editor/viewer roles.
- [ ] Test personal diagram owner versus unrelated user.
- [ ] Test folder admin/editor/viewer API permissions.
- [ ] Test cross-folder isolation.
- [ ] Test last-admin demotion and removal safeguards.
- [ ] Test platform-admin route guards.
- [ ] Test archive/restore visibility and authorization.
- [ ] Test access removal takes effect immediately on view and edit routes.
- [ ] Test template creation preserves style categories and assignments.

## Recommended Implementation Order

1. Phase 0 authorization foundation.
2. Phase 1 diagram archive/restore.
3. Phase 2 complete the existing client-folder workflow.
4. Phase 3 establish trusted platform-admin identity.
5. Phase 4 build the admin portal.
6. Phase 5 add comprehensive audit visibility.
7. Phase 6 complete the RBAC regression suite and run it in CI.

## Decisions Required Before Implementation

- [ ] Confirm whether client-folder editors may archive diagrams. Recommended: no; folder admin only.
- [ ] Confirm whether archiving a folder also archives every diagram. Recommended: folder archive hides the folder while preserving each diagram's own status.
- [ ] Confirm whether platform admins may permanently delete data. Recommended: archive/restore only for the first release.
- [ ] Identify the initial platform-admin email/user ID for the migration seed.
- [ ] Decide whether users who have never signed in can be invited. Current behavior requires one prior sign-in.