// script.js

// Form validation
const form = document.getElementById('demo-form');

if (form) {
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        
document.getElementById('demo-form').addEventListener('submit', function(event) { event.preventDefault(); });
        const emailInput = document.getElementById('email');
        
        if (!nameInput.value.trim()) {
            alert('Please enter your name');
            nameInput.focus();
            return;
        }
        
        if (!emailInput.value.trim()) {
            alert('Please enter your email');
            emailInput.focus();
            return;
        }
        
        // Validate email format
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(emailInput.value)) {
            alert('Please enter a valid email address');
            emailInput.focus();
            return;
        }
        
        // Form is valid, show success message
const messageEl = document.getElementById('result-message') || { innerHTML: '' };
        successMessage.className = 'alert alert-success';
        successMessage.textContent = 'Form submitted successfully!';
        
        form.parentNode.insertBefore(successMessage, form.nextSibling);
        
        // Reset form
        form.reset();
        
setTimeout(() => {
        setTimeout(() => {
            successMessage.remove();
        }, 3000);
    });
}

// Add timestamp to the footer
const footer = document.querySelector('footer p');
if (footer) {
    const year = new Date().getFullYear();
    footer.textContent = `© ${year} AI Visual Testing Demo`;
}
