#!/usr/bin/env node

/**
 * Script pour déboguer les erreurs 400 Bad Request spécifiques
 * Usage: node debug-400-errors.cjs
 */

const https = require('https');

const BASE_URL = 'https://systeme-management2-0.onrender.com';

// Function to make HTTP requests
function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'RestoManager-Debug/1.0'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        if (data && (method === 'POST' || method === 'PUT')) {
            const jsonData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(jsonData);
        }

        const req = https.request(url, options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({
                        statusCode: res.statusCode,
                        data: parsed,
                        headers: res.headers
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        data: responseData,
                        headers: res.headers
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data && (method === 'POST' || method === 'PUT')) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function getAuthToken() {
    console.log('🔐 Tentative d\'obtention du token d\'authentification...');
    
    // On suppose que l'utilisateur peut se connecter via l'interface web
    // Pour ce test, on va essayer quelques mots de passe courants
    const passwords = ['motdepasse_tres_secret', 'admin123', 'password', 'admin'];
    
    for (const password of passwords) {
        try {
            const response = await makeRequest('POST', '/api/auth/login', {
                username: 'admin',
                password: password
            });

            if (response.statusCode === 200 && response.data.token) {
                console.log(`✅ Connexion réussie avec le mot de passe: "${password}"`);
                return response.data.token;
            }
        } catch (error) {
            // Continue avec le mot de passe suivant
        }
    }
    
    console.log('❌ Impossible d\'obtenir un token d\'authentification');
    console.log('💡 Veuillez vous connecter manuellement dans l\'interface web et copier le token depuis les outils de développement');
    return null;
}

async function testCreateTable(token) {
    console.log('\n🔧 Test de création d\'une table...');
    
    const testCases = [
        {
            name: 'Données complètes',
            data: { number: 100, capacity: 4 }
        },
        {
            name: 'Données avec strings',
            data: { number: '101', capacity: '6' }
        },
        {
            name: 'Données minimales',
            data: { number: 102 }
        },
        {
            name: 'Données invalides',
            data: { number: 'invalid', capacity: 'invalid' }
        }
    ];

    for (const testCase of testCases) {
        try {
            console.log(`\n  📝 Test: ${testCase.name}`);
            console.log(`     Données envoyées: ${JSON.stringify(testCase.data)}`);
            
            const response = await makeRequest('POST', '/api/tables', testCase.data, token);
            
            if (response.statusCode === 200 || response.statusCode === 201) {
                console.log(`  ✅ Succès: Status ${response.statusCode}`);
                console.log(`     Réponse: ${JSON.stringify(response.data)}`);
            } else {
                console.log(`  ❌ Échec: Status ${response.statusCode}`);
                console.log(`     Erreur: ${JSON.stringify(response.data, null, 2)}`);
            }
        } catch (error) {
            console.log(`  ❌ Erreur de réseau: ${error.message}`);
        }
    }
}

async function testCreateExpense(token) {
    console.log('\n💰 Test de création d\'une dépense...');
    
    const testCases = [
        {
            name: 'Données complètes',
            data: { 
                description: 'Achat fournitures bureau',
                amount: 25.50,
                category: 'fournitures'
            }
        },
        {
            name: 'Amount en string',
            data: { 
                description: 'Réparation équipement',
                amount: '75.25',
                category: 'maintenance'
            }
        },
        {
            name: 'Données minimales',
            data: { 
                description: 'Test dépense',
                amount: 10,
                category: 'test'
            }
        },
        {
            name: 'Données invalides',
            data: { 
                description: '',
                amount: 'invalid',
                category: ''
            }
        }
    ];

    for (const testCase of testCases) {
        try {
            console.log(`\n  📝 Test: ${testCase.name}`);
            console.log(`     Données envoyées: ${JSON.stringify(testCase.data)}`);
            
            const response = await makeRequest('POST', '/api/expenses', testCase.data, token);
            
            if (response.statusCode === 200 || response.statusCode === 201) {
                console.log(`  ✅ Succès: Status ${response.statusCode}`);
                console.log(`     Réponse: ${JSON.stringify(response.data)}`);
            } else {
                console.log(`  ❌ Échec: Status ${response.statusCode}`);
                console.log(`     Erreur: ${JSON.stringify(response.data, null, 2)}`);
            }
        } catch (error) {
            console.log(`  ❌ Erreur de réseau: ${error.message}`);
        }
    }
}

async function testCreateSale(token) {
    console.log('\n💳 Test de création d\'une vente manuelle...');
    
    const testCases = [
        {
            name: 'Vente complète',
            data: { 
                amount: 50.00,
                paymentMethod: 'cash',
                description: 'Vente manuelle test'
            }
        },
        {
            name: 'Vente avec orderId',
            data: { 
                orderId: 1,
                amount: '35.75',
                paymentMethod: 'mobile_money',
                description: 'Vente liée à commande'
            }
        },
        {
            name: 'Données minimales',
            data: { 
                amount: 20,
                paymentMethod: 'cash'
            }
        },
        {
            name: 'Données invalides',
            data: { 
                amount: 'invalid',
                paymentMethod: '',
                description: null
            }
        }
    ];

    for (const testCase of testCases) {
        try {
            console.log(`\n  📝 Test: ${testCase.name}`);
            console.log(`     Données envoyées: ${JSON.stringify(testCase.data)}`);
            
            const response = await makeRequest('POST', '/api/sales', testCase.data, token);
            
            if (response.statusCode === 200 || response.statusCode === 201) {
                console.log(`  ✅ Succès: Status ${response.statusCode}`);
                console.log(`     Réponse: ${JSON.stringify(response.data)}`);
            } else {
                console.log(`  ❌ Échec: Status ${response.statusCode}`);
                console.log(`     Erreur: ${JSON.stringify(response.data, null, 2)}`);
            }
        } catch (error) {
            console.log(`  ❌ Erreur de réseau: ${error.message}`);
        }
    }
}

async function testUpdateOrder(token, orderId = 13) {
    console.log(`\n📝 Test de mise à jour de la commande ${orderId}...`);
    
    const testCases = [
        {
            name: 'Changement de statut',
            data: { status: 'preparing' }
        },
        {
            name: 'Finalisation commande',
            data: { 
                status: 'completed',
                paymentStatus: 'paid'
            }
        },
        {
            name: 'Mise à jour notes',
            data: { 
                notes: 'Commande mise à jour via test'
            }
        },
        {
            name: 'Données invalides',
            data: { 
                status: 'invalid_status',
                total: 'invalid_amount'
            }
        }
    ];

    for (const testCase of testCases) {
        try {
            console.log(`\n  📝 Test: ${testCase.name}`);
            console.log(`     Données envoyées: ${JSON.stringify(testCase.data)}`);
            
            const response = await makeRequest('PUT', `/api/orders/${orderId}`, testCase.data, token);
            
            if (response.statusCode === 200) {
                console.log(`  ✅ Succès: Status ${response.statusCode}`);
                console.log(`     Réponse: ${JSON.stringify(response.data)}`);
            } else {
                console.log(`  ❌ Échec: Status ${response.statusCode}`);
                console.log(`     Erreur: ${JSON.stringify(response.data, null, 2)}`);
            }
        } catch (error) {
            console.log(`  ❌ Erreur de réseau: ${error.message}`);
        }
    }
}

async function main() {
    console.log('🚀 Démarrage du diagnostic des erreurs 400\n');

    // Étape 1: Obtenir un token d'authentification
    const token = await getAuthToken();
    
    if (!token) {
        console.log('\n⚠️  Tests interrompus: Aucun token d\'authentification disponible');
        console.log('\n💡 Solutions possibles:');
        console.log('1. Vérifiez que l\'utilisateur admin existe dans la base');
        console.log('2. Relancez le seed: npm run db:seed');
        console.log('3. Créez manuellement un utilisateur admin');
        return;
    }

    // Étape 2: Tester chaque endpoint problématique
    console.log(`\n📊 Token obtenu: ${token.substring(0, 20)}...`);
    console.log('\n🧪 Démarrage des tests des endpoints...');

    await testCreateTable(token);
    await testCreateExpense(token);
    await testCreateSale(token);
    await testUpdateOrder(token);

    console.log('\n✨ Diagnostic terminé');
    console.log('\n📋 Analysez les erreurs ci-dessus pour identifier les problèmes de validation');
}

// Exécuter le diagnostic
if (require.main === module) {
    main();
}

module.exports = { makeRequest, testCreateTable, testCreateExpense };
