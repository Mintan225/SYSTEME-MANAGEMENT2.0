#!/usr/bin/env node

/**
 * Script pour créer des tables de test
 * Ce script va créer 5 tables avec des QR codes fonctionnels
 */

require('dotenv').config();
const { drizzle } = require('drizzle-orm/neon-http');
const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non trouvée dans les variables d\'environnement');
  process.exit(1);
}

console.log('🔧 Connexion à la base de données...');

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

async function createTestTables() {
  console.log('🏗️ Création des tables de test...');
  
  try {
    // Créer les tables directement avec SQL brut pour éviter les problèmes de schéma
    const baseUrl = 'https://systeme-management2-0.onrender.com';
    
    const tablesToCreate = [
      { number: 1, capacity: 4, qrCode: `${baseUrl}/menu/1`, status: 'available' },
      { number: 2, capacity: 6, qrCode: `${baseUrl}/menu/2`, status: 'available' },
      { number: 3, capacity: 2, qrCode: `${baseUrl}/menu/3`, status: 'available' },
      { number: 4, capacity: 8, qrCode: `${baseUrl}/menu/4`, status: 'available' },
      { number: 5, capacity: 4, qrCode: `${baseUrl}/menu/5`, status: 'available' },
      { number: 10, capacity: 6, qrCode: `${baseUrl}/menu/10`, status: 'available' },
      { number: 11, capacity: 4, qrCode: `${baseUrl}/menu/11`, status: 'available' },
      { number: 12, capacity: 8, qrCode: `${baseUrl}/menu/12`, status: 'available' },
    ];

    for (const table of tablesToCreate) {
      try {
        await sql`
          INSERT INTO tables (number, capacity, qr_code, status, created_at)
          VALUES (${table.number}, ${table.capacity}, ${table.qrCode}, ${table.status}, NOW())
          ON CONFLICT (number) 
          DO UPDATE SET 
            capacity = EXCLUDED.capacity,
            qr_code = EXCLUDED.qr_code,
            status = EXCLUDED.status
        `;
        console.log(`  ✅ Table ${table.number} créée/mise à jour`);
      } catch (error) {
        console.log(`  ⚠️ Erreur table ${table.number}:`, error.message);
      }
    }

    // Vérifier les tables créées
    const tables = await sql`SELECT number, capacity, qr_code, status FROM tables ORDER BY number`;
    
    console.log('\n📋 Tables dans la base de données :');
    tables.forEach(table => {
      console.log(`  • Table ${table.number} (${table.capacity} places) - ${table.status}`);
      console.log(`    QR: ${table.qr_code}`);
    });

    console.log('\n🎉 Tables créées avec succès !');
    console.log('\n🔗 URLs de test :');
    tables.forEach(table => {
      console.log(`  ${table.qr_code}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la création des tables:', error);
  }
}

async function createTestCategories() {
  console.log('\n🏷️ Création des catégories de test...');
  
  const categories = [
    { name: 'Boissons', description: 'Boissons chaudes et froides' },
    { name: 'Plats Principaux', description: 'Plats de résistance' },
    { name: 'Entrées', description: 'Entrées et amuse-bouches' },
    { name: 'Desserts', description: 'Desserts et sucreries' },
    { name: 'Accompagnements', description: 'Accompagnements et garnitures' },
  ];

  for (const category of categories) {
    try {
      await sql`
        INSERT INTO categories (name, description, created_at)
        VALUES (${category.name}, ${category.description}, NOW())
        ON CONFLICT (name) DO NOTHING
      `;
      console.log(`  ✅ Catégorie "${category.name}" créée`);
    } catch (error) {
      console.log(`  ⚠️ Erreur catégorie "${category.name}":`, error.message);
    }
  }
}

async function createTestProducts() {
  console.log('\n🍽️ Création des produits de test...');
  
  // D'abord récupérer les IDs des catégories
  const categories = await sql`SELECT id, name FROM categories`;
  const categoryMap = {};
  categories.forEach(cat => {
    categoryMap[cat.name] = cat.id;
  });

  const products = [
    { name: 'Café Express', description: 'Café espresso traditionnel', price: '2.50', categoryName: 'Boissons' },
    { name: 'Thé Vert', description: 'Thé vert bio', price: '3.00', categoryName: 'Boissons' },
    { name: 'Jus d\'Orange', description: 'Jus d\'orange frais pressé', price: '4.50', categoryName: 'Boissons' },
    { name: 'Salade César', description: 'Salade césar avec croûtons', price: '12.00', categoryName: 'Entrées' },
    { name: 'Soupe du Jour', description: 'Soupe fraîche du chef', price: '8.00', categoryName: 'Entrées' },
    { name: 'Steak Frites', description: 'Steak grillé avec frites maison', price: '18.50', categoryName: 'Plats Principaux' },
    { name: 'Saumon Grillé', description: 'Filet de saumon grillé', price: '22.00', categoryName: 'Plats Principaux' },
    { name: 'Pâtes Carbonara', description: 'Pâtes à la carbonara traditionnelle', price: '14.00', categoryName: 'Plats Principaux' },
    { name: 'Tiramisu', description: 'Tiramisu maison', price: '6.50', categoryName: 'Desserts' },
    { name: 'Tarte Tatin', description: 'Tarte tatin aux pommes', price: '7.00', categoryName: 'Desserts' },
  ];

  for (const product of products) {
    const categoryId = categoryMap[product.categoryName];
    if (!categoryId) {
      console.log(`  ⚠️ Catégorie "${product.categoryName}" non trouvée pour "${product.name}"`);
      continue;
    }

    try {
      await sql`
        INSERT INTO products (name, description, price, category_id, available, archived, created_at)
        VALUES (${product.name}, ${product.description}, ${product.price}, ${categoryId}, true, false, NOW())
        ON CONFLICT (name) DO NOTHING
      `;
      console.log(`  ✅ Produit "${product.name}" créé`);
    } catch (error) {
      console.log(`  ⚠️ Erreur produit "${product.name}":`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 Initialisation de la base de données de test...\n');
  
  await createTestTables();
  await createTestCategories();
  await createTestProducts();
  
  console.log('\n✨ Base de données initialisée avec succès !');
  console.log('\n🧪 Tests recommandés :');
  console.log('1. Scanner un QR code : https://systeme-management2-0.onrender.com/menu/1');
  console.log('2. Créer une nouvelle table via l\'interface admin');
  console.log('3. Créer une nouvelle dépense via l\'interface admin');
  console.log('4. Passer une commande via le menu client');
}

if (require.main === module) {
  main().catch(console.error);
}
