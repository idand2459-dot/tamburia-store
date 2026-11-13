/**
 * Admin requests: the one place that knows an admin call can hit an expired session.
 *
 * createAdminApi(onUnauthorized) returns the admin API object: one named call per backend
 * action (orders, products, reviews, settings), all built on `request`, the fetch wrapper that
 * used to live inside pages/admin/Admin.js. `request` calls fetch, and when the answer is 401
 * it calls onUnauthorized and then hands back the very same response. The named calls return
 * that raw response too, so the hooks still read `res.ok` and the server's message exactly as
 * before; turning failures into errors would change what the screens show (for example an
 * orders list that is not OK becomes an empty list today).
 *
 * Nothing is caught here: a network failure rejects as it always did, and the hook's own
 * catch shows its network message. /api/auth/* does not go through here (authService), because
 * a 401 on login is the answer, not an expiry.
 */

/** Builds the admin API; onUnauthorized runs once for every 401 answer, before the caller gets it. */
export function createAdminApi(onUnauthorized) {
  /** Calls fetch like the browser does; a 401 answer also calls onUnauthorized. */
  async function request(url, options) {
    const res = await fetch(url, options);
    if (res.status === 401) onUnauthorized?.();
    return res;
  }

  /*
   * Reviews. Each call returns the raw response, exactly like `request`: the hook keeps reading
   * `res.ok` and the server's message itself, so its messages and its handling of non-OK
   * answers do not change.
   */

  /** All reviews, including the ones not yet approved (the storefront list hides them). */
  function getReviews() {
    return request('/api/reviews/all');
  }

  /** Publishes a review. */
  function approveReview(id) {
    return request(`/api/reviews/${id}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true }),
    });
  }

  /** Deletes a review. */
  function deleteReview(id) {
    return request(`/api/reviews/${id}`, { method: 'DELETE' });
  }

  /* Orders. Same rule: raw responses. */

  /** All orders, newest first as the server sorts them. */
  function getOrders() {
    return request('/api/orders');
  }

  /** Moves an order to a new status. */
  function updateOrderStatus(orderId, status) {
    return request(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  /** Marks one pick-list line of an order as picked, or clears the mark. */
  function setOrderLinePicked(orderId, line, picked) {
    return request(`/api/orders/${orderId}/items/${line}/picked`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picked }),
    });
  }

  /** Deletes an order. */
  function deleteOrder(orderId) {
    return request('/api/orders/' + orderId, { method: 'DELETE' });
  }

  /* Settings (key/value rows of the settings table). */

  /** Reads one setting. */
  function getSetting(key) {
    return request(`/api/settings/${key}`);
  }

  /** Writes one setting; a null value deletes it. */
  function saveSetting(key, value) {
    return request(`/api/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
  }

  /* Products. `product` and `patch` are plain objects; they are serialized here. */

  /** The full list including hidden products (the storefront list hides them for everyone). */
  function getProducts() {
    return request('/api/products?active=all');
  }

  /** Uploads image files as multipart form data. No Content-Type is set: the browser adds the boundary. */
  function uploadProductImages(files) {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return request('/api/upload-multiple', { method: 'POST', body: formData });
  }

  /** Creates a product. */
  function createProduct(product) {
    return request('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
  }

  /** Saves a whole product. */
  function updateProduct(id, product) {
    return request('/api/products/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
  }

  /** Changes only the given fields of a product; the server writes just what it receives. */
  function patchProduct(id, patch) {
    return request('/api/products/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  }

  /** Deletes a product. */
  function deleteProduct(id) {
    return request('/api/products/' + id, { method: 'DELETE' });
  }

  return {
    request,
    getReviews, approveReview, deleteReview,
    getOrders, updateOrderStatus, setOrderLinePicked, deleteOrder,
    getSetting, saveSetting,
    getProducts, uploadProductImages, createProduct, updateProduct, patchProduct, deleteProduct,
  };
}
