/**
 * script.js
 * Main JavaScript file for the test application
 */

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
  // Handle form submission
  const contactForm = document.getElementById('contact');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const message = document.getElementById('message').value;
      
      // In a real app, we would send this data to a server
      // For this demo, just log to console
      console.log({
        name,
        email,
        message
      });
      
      // Show success message
      alert('Thank you for your message! This is a demo application for visual testing.');
      
      // Reset form
      contactForm.reset();
    });
  }
  
  // Add hover effect to feature cards
  const featureCards = document.querySelectorAll('.feature-card');
  featureCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      // We could add effects here, but the CSS transition handles it
    });
    
    card.addEventListener('mouseleave', function() {
      // We could add effects here, but the CSS transition handles it
    });
  });
  
  // Check server status
  fetch('/api/status')
    .then(response => response.json())
    .then(data => {
      console.log('Server status:', data);
    })
    .catch(error => {
      console.error('Error checking server status:', error);
    });
});
