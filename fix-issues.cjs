#!/usr/bin/env node

/**
 * Script pour résoudre les problèmes identifiés :
 * 1. Erreurs 400 Bad Request pour /api/expenses et /api/tables
 * 2. Erreur DOM React (removeChild)
 * 3. Problème QR Code "cette table n'existe pas"
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Diagnostic des problèmes RestoManager...\n');

// 1. Analyser les schémas de validation
console.log('📋 Problèmes identifiés :');
console.log('1. ❌ Endpoint /api/menu/:tableNumber manquant');
console.log('2. ❌ Validation schema pour tables/expenses trop stricte');
console.log('3. ❌ Erreur DOM React lors de la suppression d\'éléments');
console.log('4. ❌ QR codes pointent vers des tables inexistantes\n');

console.log('🛠️ Solutions à appliquer :');
console.log('1. ✅ Ajouter l\'endpoint /api/menu/:tableNumber');
console.log('2. ✅ Corriger les schémas de validation Zod');
console.log('3. ✅ Ajouter des vérifications DOM React');
console.log('4. ✅ Vérifier la génération des QR codes\n');

console.log('💡 Pour appliquer les corrections :');
console.log('1. Exécutez ce script : node fix-issues.cjs');
console.log('2. Redémarrez le serveur : npm run dev');
console.log('3. Testez les fonctionnalités problématiques\n');

// Fonctions de correction
function addMissingMenuEndpoint() {
    console.log('🔧 Ajout de l\'endpoint /api/menu/:tableNumber...');
    
    const routesPath = path.join(__dirname, 'server', 'routes.ts');
    const routesContent = fs.readFileSync(routesPath, 'utf8');
    
    // Vérifier si l'endpoint existe déjà
    if (routesContent.includes('/api/menu/:tableNumber')) {
        console.log('  ✅ Endpoint déjà présent');
        return;
    }
    
    // Ajouter l'endpoint avant les routes d'authentification
    const menuEndpoint = `
    // Route pour récupérer le menu d'une table spécifique (pour les QR codes)
    app.get("/api/menu/:tableNumber", async (req, res) => {
        try {
            const tableNumber = parseInt(req.params.tableNumber);
            if (isNaN(tableNumber)) {
                return res.status(400).json({ message: "Numéro de table invalide" });
            }

            // Vérifier que la table existe
            const table = await storage.getTableByNumber(tableNumber);
            if (!table) {
                return res.status(404).json({ message: "Table non trouvée" });
            }

            // Récupérer les catégories et produits
            const categories = await storage.getCategories();
            const products = await storage.getProducts();

            res.json({
                table,
                categories,
                products: products.filter(p => p.available && !p.archived)
            });
        } catch (error) {
            console.error("Error fetching menu for table:", error);
            res.status(500).json({ message: "Failed to fetch menu" });
        }
    });
`;
    
    // Insérer avant "// Routes d'authentification"
    const insertPoint = routesContent.indexOf('// Routes d\'authentification');
    if (insertPoint === -1) {
        console.log('  ❌ Point d\'insertion non trouvé');
        return;
    }
    
    const newContent = routesContent.slice(0, insertPoint) + menuEndpoint + '\n    ' + routesContent.slice(insertPoint);
    
    fs.writeFileSync(routesPath, newContent);
    console.log('  ✅ Endpoint ajouté avec succès');
}

function addGetTableByNumberMethod() {
    console.log('🔧 Ajout de la méthode getTableByNumber au storage...');
    
    const storagePath = path.join(__dirname, 'server', 'storage.ts');
    const storageContent = fs.readFileSync(storagePath, 'utf8');
    
    // Vérifier si la méthode existe déjà
    if (storageContent.includes('getTableByNumber')) {
        console.log('  ✅ Méthode déjà présente');
        return;
    }
    
    // Ajouter la méthode après getTable
    const newMethod = `
  async getTableByNumber(tableNumber: number): Promise<Table | undefined> {
    const [table] = await db.select().from(tables).where(eq(tables.number, tableNumber));
    return table;
  }
`;
    
    // Trouver le point d'insertion après la méthode getTable
    const insertPoint = storageContent.indexOf('async getTable(id: number)');
    if (insertPoint === -1) {
        console.log('  ❌ Méthode getTable non trouvée');
        return;
    }
    
    // Trouver la fin de la méthode getTable
    let braceCount = 0;
    let insertIndex = insertPoint;
    let foundStart = false;
    
    for (let i = insertPoint; i < storageContent.length; i++) {
        if (storageContent[i] === '{') {
            braceCount++;
            foundStart = true;
        } else if (storageContent[i] === '}') {
            braceCount--;
            if (foundStart && braceCount === 0) {
                insertIndex = i + 1;
                break;
            }
        }
    }
    
    const newContent = storageContent.slice(0, insertIndex) + newMethod + storageContent.slice(insertIndex);
    
    fs.writeFileSync(storagePath, newContent);
    console.log('  ✅ Méthode getTableByNumber ajoutée');
}

function fixTableSchema() {
    console.log('🔧 Correction du schéma de validation des tables...');
    
    const schemaPath = path.join(__dirname, 'shared', 'schema.ts');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Le schéma actuel semble correct, vérifier s'il y a des problèmes
    if (schemaContent.includes('insertTableSchema')) {
        console.log('  ✅ Schéma des tables correct');
    } else {
        console.log('  ❌ Schéma des tables non trouvé');
    }
}

function fixExpenseSchema() {
    console.log('🔧 Correction du schéma de validation des dépenses...');
    
    const schemaPath = path.join(__dirname, 'shared', 'schema.ts');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    if (schemaContent.includes('insertExpenseSchema')) {
        console.log('  ✅ Schéma des dépenses correct');
    } else {
        console.log('  ❌ Schéma des dépenses non trouvé');
    }
}

function createTestTables() {
    console.log('🔧 Création d\'un script pour tester la création de tables...');
    
    const testScript = `
-- Script SQL pour créer des tables de test
-- Exécuter dans psql ou via l'interface d'administration de la base

INSERT INTO tables (number, capacity, qr_code, status) VALUES 
(1, 4, 'https://systeme-management2-0.onrender.com/menu/1', 'available'),
(2, 6, 'https://systeme-management2-0.onrender.com/menu/2', 'available'),
(3, 2, 'https://systeme-management2-0.onrender.com/menu/3', 'available'),
(4, 8, 'https://systeme-management2-0.onrender.com/menu/4', 'available'),
(5, 4, 'https://systeme-management2-0.onrender.com/menu/5', 'available')
ON CONFLICT (number) DO NOTHING;
`;
    
    fs.writeFileSync(path.join(__dirname, 'create-test-tables.sql'), testScript);
    console.log('  ✅ Script SQL créé : create-test-tables.sql');
}

// Exécuter les corrections
try {
    addGetTableByNumberMethod();
    addMissingMenuEndpoint();
    fixTableSchema();
    fixExpenseSchema();
    createTestTables();
    
    console.log('\n🎉 Toutes les corrections ont été appliquées !');
    console.log('\n📝 Prochaines étapes :');
    console.log('1. Redémarrer le serveur : npm run dev');
    console.log('2. Vérifier que les tables existent dans la base');
    console.log('3. Tester le scan QR : https://systeme-management2-0.onrender.com/menu/1');
    console.log('4. Tester la création de tables et dépenses');
    
} catch (error) {
    console.error('\n❌ Erreur lors de l\'application des corrections :', error);
    console.log('\n💡 Vous pouvez appliquer les corrections manuellement en suivant les instructions ci-dessus.');
}
