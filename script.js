let cartCount = 0;

const buttons = document.querySelectorAll('.btn-add');
const cartCountDiv = document.getElementById('cart-count');

buttons.forEach(function(button) {
  button.addEventListener('click', function() {
    const product = button.closest('.product');
    const productName = product.querySelector('h3').textContent;
    
    cartCount = cartCount + 1;
    cartCountDiv.textContent = 'עגלה: ' + cartCount + ' פריטים';
    
    alert('נוסף לעגלה: ' + productName);
  });
});