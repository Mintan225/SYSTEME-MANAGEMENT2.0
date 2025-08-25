
const fetch = require('node-fetch');

async function testQRRedirection() {
  const baseURL = 'http://localhost:5000';
  
  console.log('🧪 Test de redirection des QR codes...\n');
  
  // Test 1: Vérifier que /table/1 redirige vers /menu/1
  try {
    const response = await fetch(`${baseURL}/table/1`, {
      redirect: 'manual'
    });
    
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get('location');
      console.log(`✅ Redirection fonctionne: /table/1 → ${location}`);
    } else {
      console.log(`❌ Pas de redirection détectée pour /table/1`);
    }
  } catch (error) {
    console.log(`❌ Erreur lors du test de redirection: ${error.message}`);
  }
  
  // Test 2: Vérifier que l'API menu fonctionne
  try {
    const response = await fetch(`${baseURL}/api/menu/1`);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ API menu fonctionne: Table ${data.table?.number} trouvée`);
      console.log(`   - ${data.products?.length || 0} produits disponibles`);
      console.log(`   - ${data.categories?.length || 0} catégories`);
    } else {
      console.log(`❌ API menu échoue: ${data.message}`);
    }
  } catch (error) {
    console.log(`❌ Erreur API menu: ${error.message}`);
  }
  
  console.log('\n🔗 Pour tester manuellement:');
  console.log(`   ${baseURL}/table/1`);
  console.log(`   ${baseURL}/menu/1`);
}

testQRRedirection().catch(console.error);
