/**
 * Who is looking at the admin: the owner edits everything; the viewer is the public read-only demo
 * session (plan 006). The role comes from GET /api/auth/me and is used only to choose what to render:
 * every write also fails on the server for a viewer, so a control left visible would be harmless.
 *
 * The default is the owner, so a component rendered without the provider behaves as it always did.
 */
import { createContext, useContext } from 'react';
import { Eye } from 'lucide-react';

export const AdminAccessContext = createContext({ role: 'owner', readOnly: false });

/** Returns { role, readOnly } for the admin that is open. */
export function useAdminAccess() {
  return useContext(AdminAccessContext);
}

/** The tabs a viewer does not get: both only write. */
export const VIEWER_HIDDEN_TABS = ['add', 'import'];

/** The note shown to a viewer, at the top of the admin. */
export const READ_ONLY_NOTE = 'מצב צפייה בהדגמה: אפשר לעיין בכל המסכים, אבל לא לשנות דבר. '
  + 'הכניסה המלאה לעריכה שמורה לבעלים.';

/** Shows the read-only note, or nothing for the owner. */
export function ReadOnlyNote() {
  const { readOnly } = useAdminAccess();
  if (!readOnly) return null;

  return (
    <p className="admin-readonly-note" role="note">
      <Eye size={18} aria-hidden="true" /> {READ_ONLY_NOTE}
    </p>
  );
}
