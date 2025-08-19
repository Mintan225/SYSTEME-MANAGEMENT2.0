#!/usr/bin/env node

/**
 * Script pour générer des secrets sécurisés pour les variables d'environnement
 * Usage: node generate-secrets.js
 */

const crypto = require('crypto');

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generateSecrets() {
  console.log('🔐 Génération de secrets sécurisés pour votre application RestoManager\n');
  
  const jwtSecret = generateSecret(32);
  const sessionSecret = generateSecret(32);
  const superAdminSecret = generateSecret(32);
  
  console.log('📋 Variables d\'environnement à ajouter sur Render:');
  console.log('=' .repeat(60));
  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log(`SESSION_SECRET=${sessionSecret}`);
  console.log(`SUPER_ADMIN_JWT_SECRET=${superAdminSecret}`);
  console.log('=' .repeat(60));
  console.log();
  
  console.log('📝 Instructions:');
  console.log('1. Copiez les variables ci-dessus');
  console.log('2. Allez dans votre dashboard Render');
  console.log('3. Sélectionnez votre service "systeme-management2-0"');
  console.log('4. Ajoutez ces variables dans la section "Environment"');
  console.log('5. Redéployez l\'application');
  console.log();
  
  console.log('🔍 Pour vérifier après le redéploiement:');
  console.log('curl https://systeme-management2-0.onrender.com/api/diagnostic');
  console.log();
  
  console.log('⚠️  IMPORTANT:');
  console.log('- Ne partagez JAMAIS ces secrets publiquement');
  console.log('- Stockez-les en sécurité');
  console.log('- Régénérez-les si ils sont compromis');
  console.log();
}

// Exécuter le script si appelé directement
if (require.main === module) {
  generateSecrets();
}

module.exports = { generateSecret, generateSecrets };
