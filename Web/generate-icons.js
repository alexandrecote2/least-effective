// Generate simple placeholder PNG icons
const fs = require('fs');

function createPNG(size) {
  // Minimal valid 1x1 PNG scaled concept - just a black square with gold "LE" text
  // For a real app you'd use a proper icon, but this makes the PWA installable
  const { createCanvas } = require('canvas');
  // Fallback: create a minimal valid PNG manually
  // This is a 1x1 black pixel PNG, enough to make manifest valid
  const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  return png1x1;
}

fs.writeFileSync('icon-192.png', createPNG(192));
fs.writeFileSync('icon-512.png', createPNG(512));
console.log('Icons created (placeholder)');
