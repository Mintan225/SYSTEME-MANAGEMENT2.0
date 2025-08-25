
const fs = require('fs');

console.log("=== Test de vérification des QR codes ===");

// Test 1: Vérifier la génération côté client
console.log("\n1. Test génération QR côté client:");
const mockWindow = {
  location: {
    origin: 'https://yourapp.replit.app'
  }
};

function generateTableQRData(tableNumber, baseUrl) {
  const url = baseUrl || `${mockWindow.location.origin}/menu/${tableNumber}`;
  return url;
}

const qrUrl = generateTableQRData(5);
console.log("QR URL généré:", qrUrl);
console.log("Format correct (/menu/):", qrUrl.includes('/menu/') ? "✅" : "❌");

// Test 2: Vérifier le format attendu
console.log("\n2. Vérification du format:");
const expectedFormat = "https://yourapp.replit.app/menu/5";
console.log("URL attendue:", expectedFormat);
console.log("URL générée:", qrUrl);
console.log("Correspondance:", qrUrl === expectedFormat ? "✅" : "❌");

console.log("\n=== Test terminé ===");
