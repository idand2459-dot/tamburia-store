let cartCount = 0;
let cartTotal = 0;

const buttons = document.querySelectorAll('.btn-add');
const cartCountDiv = document.getElementById('cart-count');
const cartItemsList = document.getElementById('cart-items');
const cartTotalDiv = document.getElementById('cart-total');
const clearCartBtn = document.getElementById('clear-cart');

buttons.forEach(function(button) {
  button.addEventListener('click', function() {
    const product = button.closest('.product');
    const productName = product.querySelector('h3').textContent;
    const productPriceText = product.querySelector('p').textContent;
    const productPrice = parseInt(productPriceText.replace('מחיר: ₪', ''));

    cartCount = cartCount + 1;
    cartTotal = cartTotal + productPrice;

    cartCountDiv.textContent = 'עגלה: ' + cartCount + ' פריטים';
    cartTotalDiv.textContent = 'סה"כ: ₪' + cartTotal;

    const li = document.createElement('li');
    li.textContent = productName + ' - ₪' + productPrice;
    cartItemsList.appendChild(li);
  });
});

clearCartBtn.addEventListener('click', function() {
  cartCount = 0;
  cartTotal = 0;
  cartCountDiv.textContent = 'עגלה: 0 פריטים';
  cartTotalDiv.textContent = 'סה"כ: ₪0';
  cartItemsList.innerHTML = '';
});