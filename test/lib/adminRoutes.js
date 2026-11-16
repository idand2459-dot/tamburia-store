/**
 * The table of every admin-protected route: one row per route that uses requireAdmin (owner only) or
 * requireAdminRead (owner and viewer, GET and HEAD only). `test/unit-admin-routes-covered.js` reads
 * the `*.routes.js` sources and fails when a protected route has no row here, or a row has no route,
 * so the table cannot fall behind. `test/smoke-admin-roles.js` runs every row against a real server.
 *
 * access:
 *   'read'  — the viewer may call it (the explicit allowlist; seven rows).
 *   'owner' — the viewer gets 403, whatever the method.
 * `path` uses :id, :line and :key placeholders; `body` is a sample body for the owner-only writes.
 */
const ROUTES = [
  // orders
  { method: 'GET', path: '/api/orders', access: 'read' },
  { method: 'GET', path: '/api/orders/stats', access: 'read' },
  { method: 'GET', path: '/api/orders/:id', access: 'read' },
  { method: 'PUT', path: '/api/orders/:id', access: 'owner', body: { notes: 'changed' } },
  { method: 'DELETE', path: '/api/orders/:id', access: 'owner' },
  { method: 'PUT', path: '/api/orders/:id/status', access: 'owner', body: { status: 'processing' } },
  { method: 'PUT', path: '/api/orders/:id/items/:line/picked', access: 'owner', body: { picked: true } },
  // products
  { method: 'POST', path: '/api/products', access: 'owner', body: { name: 'viewer product', category: 'tools', price: 5 } },
  { method: 'PUT', path: '/api/products/:id', access: 'owner', body: { name: 'viewer rename' } },
  { method: 'DELETE', path: '/api/products/:id', access: 'owner' },
  // pigment formulas
  { method: 'POST', path: '/api/pigment-formulas', access: 'owner', body: { color_code: 'viewer_test', color_name_he: 'בדיקה', hex: '#123456', ml_per_liter_light: 10, ml_per_liter_medium: 20, ml_per_liter_dark: 30 } },
  { method: 'PUT', path: '/api/pigment-formulas/:id', access: 'owner', body: { color_name_he: 'שונה' } },
  { method: 'DELETE', path: '/api/pigment-formulas/:id', access: 'owner' },
  // reviews
  { method: 'GET', path: '/api/reviews/all', access: 'read' },
  { method: 'GET', path: '/api/reviews/:id', access: 'read' },
  { method: 'PUT', path: '/api/reviews/:id', access: 'owner', body: { text: 'changed' } },
  { method: 'DELETE', path: '/api/reviews/:id', access: 'owner' },
  { method: 'PUT', path: '/api/reviews/:id/approve', access: 'owner', body: { approved: true } },
  // settings
  { method: 'GET', path: '/api/settings/:key', access: 'read' },
  { method: 'PUT', path: '/api/settings/:key', access: 'owner', body: { value: null } },
  // uploads
  { method: 'POST', path: '/api/upload-multiple', access: 'owner' },
  // session
  { method: 'GET', path: '/api/auth/me', access: 'read' },
];

/** The viewer allowlist, stated once more on purpose: a change here must be a deliberate edit. */
const VIEWER_READ_ROUTES = [
  'GET /api/orders',
  'GET /api/orders/stats',
  'GET /api/orders/:id',
  'GET /api/reviews/all',
  'GET /api/reviews/:id',
  'GET /api/settings/:key',
  'GET /api/auth/me',
];

module.exports = { ROUTES, VIEWER_READ_ROUTES };
