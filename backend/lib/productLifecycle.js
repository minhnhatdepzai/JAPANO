function hideProduct(state, identifier, now = Date.now()) {
  const products = Array.isArray(state?.products) ? state.products : [];
  const id = String(identifier || '');
  const product = products.find((item) => (
    String(item.id || '') === id || String(item.slug || '') === id
  ));
  if (!product) return null;

  product.status = 'hidden';
  product.updatedAt = now;
  return product;
}

module.exports = { hideProduct };
