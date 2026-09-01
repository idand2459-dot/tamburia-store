let cartCount = 0;
let cartTotal = 0;

const cartCountDiv = document.getElementById('cart-count');
const cartItemsList = document.getElementById('cart-items');
const cartTotalDiv = document.getElementById('cart-total');
const clearCartBtn = document.getElementById('clear-cart');

fetch('/api/products')
  .then(function(response) {
    return response.json();
  })
  .then(function(products) {
    const grid = document.querySelector('.products-grid');
    grid.innerHTML = '';

    products.forEach(function(product) {
      const div = document.createElement('div');
      div.className = 'product';
      div.innerHTML = `
        <h3>${product.name}</h3>
        <p>מחיר: ₪${product.price}</p>
        <button class="btn-add">הוסף לעגלה</button>
      `;

      div.querySelector('.btn-add').addEventListener('click', function() {
        cartCount = cartCount + 1;
        cartTotal = cartTotal + product.price;
        cartCountDiv.textContent = 'עגלה: ' + cartCount + ' פריטים';
        cartTotalDiv.textContent = 'סה"כ: ₪' + cartTotal;
        const li = document.createElement('li');
        li.textContent = product.name + ' - ₪' + product.price;
        cartItemsList.appendChild(li);
      });

      grid.appendChild(div);
    });
  });

clearCartBtn.addEventListener('click', function() {
  cartCount = 0;
  cartTotal = 0;
  cartCountDiv.textContent = 'עגלה: 0 פריטים';
  cartTotalDiv.textContent = 'סה"כ: ₪0';
  cartItemsList.innerHTML = '';
});

