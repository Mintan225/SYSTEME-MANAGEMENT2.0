
const fetch = require('node-fetch');

async function fixQRCodes() {
  try {
    console.log('🔧 Réparation des QR codes...');
    
    // D'abord, tester la connexion
    const healthResponse = await fetch('http://localhost:5000/api/health');
    if (!healthResponse.ok) {
      console.error('❌ Serveur non disponible');
      return;
    }
    
    console.log('✅ Serveur disponible');
    
    // Tester l'endpoint menu pour la table 1
    const menuResponse = await fetch('http://localhost:5000/api/menu/1');
    if (menuResponse.ok) {
      const data = await menuResponse.json();
      console.log('✅ Endpoint /api/menu/:tableNumber fonctionne');
      console.log('📊 Tables trouvées:', data.table ? `Table ${data.table.number}` : 'Aucune');
      console.log('📋 Catégories:', data.categories?.length || 0);
      console.log('🍽️ Produits:', data.products?.length || 0);
    } else {
      console.error('❌ Endpoint /api/menu/:tableNumber ne fonctionne pas');
      console.error('Status:', menuResponse.status);
      const errorText = await menuResponse.text();
      console.error('Erreur:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
  }
}

fixQRCodes();
