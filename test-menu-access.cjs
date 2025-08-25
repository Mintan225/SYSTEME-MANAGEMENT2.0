
const fetch = require('node-fetch');

async function testMenuAccess() {
  const baseURL = 'http://localhost:5000';
  
  console.log('🧪 Test d\'accès au menu via QR codes...\n');
  
  // Test des tables 1 à 5
  for (let tableNumber = 1; tableNumber <= 5; tableNumber++) {
    try {
      console.log(`📱 Test table ${tableNumber}:`);
      
      // Test de l'API menu
      const apiResponse = await fetch(`${baseURL}/api/menu/${tableNumber}`);
      const apiData = await apiResponse.json();
      
      if (apiResponse.ok) {
        console.log(`  ✅ API: Table ${apiData.table?.number} - ${apiData.products?.length || 0} produits`);
      } else {
        console.log(`  ❌ API: ${apiData.message}`);
      }
      
      // Test de l'accès direct au menu
      const menuResponse = await fetch(`${baseURL}/menu/${tableNumber}`);
      if (menuResponse.ok) {
        console.log(`  ✅ Menu: Accès direct réussi`);
      } else {
        console.log(`  ❌ Menu: Erreur ${menuResponse.status}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Erreur table ${tableNumber}: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('🔗 URLs à tester manuellement:');
  for (let i = 1; i <= 5; i++) {
    console.log(`   ${baseURL}/menu/${i}`);
  }
}

testMenuAccess().catch(console.error);
