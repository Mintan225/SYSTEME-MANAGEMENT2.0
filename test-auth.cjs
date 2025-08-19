#!/usr/bin/env node

/**
 * Script pour tester l'authentification et les endpoints protégés
 * Usage: node test-auth.cjs
 */

const https = require('https');
const querystring = require('querystring');

const BASE_URL = 'https://systeme-management2-0.onrender.com';
let authToken = null;

// Function to make HTTP requests
function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'RestoManager-Test/1.0'
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
                        data: parsed
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        data: responseData
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

async function testLogin() {
    console.log('🔐 Test de connexion...');
    
    const passwords = [
        'motdepasse_tres_secret',
        'admin', 
        'password',
        '123456'
    ];

    for (const password of passwords) {
        try {
            const response = await makeRequest('POST', '/api/auth/login', {
                username: 'admin',
                password: password
            });

            if (response.statusCode === 200 && response.data.token) {
                console.log(`✅ Connexion réussie avec le mot de passe: "${password}"`);
                authToken = response.data.token;
                console.log(`📝 Token reçu: ${authToken.substring(0, 20)}...`);
                console.log(`👤 Utilisateur: ${JSON.stringify(response.data.user, null, 2)}`);
                return true;
            } else {
                console.log(`❌ Échec avec le mot de passe: "${password}" - Status: ${response.statusCode}`);
                if (response.data.message) {
                    console.log(`   Message: ${response.data.message}`);
                }
            }
        } catch (error) {
            console.log(`❌ Erreur avec le mot de passe: "${password}" - ${error.message}`);
        }
    }
    
    return false;
}

async function testProtectedEndpoints() {
    if (!authToken) {
        console.log('❌ Aucun token disponible pour tester les endpoints protégés');
        return;
    }

    console.log('\n🔒 Test des endpoints protégés...');

    const endpoints = [
        { method: 'GET', path: '/api/tables', description: 'Récupérer les tables' },
        { method: 'GET', path: '/api/orders', description: 'Récupérer les commandes' },
        { method: 'GET', path: '/api/sales', description: 'Récupérer les ventes' },
        { method: 'GET', path: '/api/expenses', description: 'Récupérer les dépenses' }
    ];

    for (const endpoint of endpoints) {
        try {
            const response = await makeRequest(endpoint.method, endpoint.path, null, authToken);
            
            if (response.statusCode === 200) {
                console.log(`✅ ${endpoint.description}: Status ${response.statusCode}`);
                if (Array.isArray(response.data)) {
                    console.log(`   Données: ${response.data.length} éléments trouvés`);
                }
            } else {
                console.log(`❌ ${endpoint.description}: Status ${response.statusCode}`);
                if (response.data.message) {
                    console.log(`   Message: ${response.data.message}`);
                }
            }
        } catch (error) {
            console.log(`❌ ${endpoint.description}: Erreur - ${error.message}`);
        }
    }
}

async function testCreateOperations() {
    if (!authToken) {
        console.log('❌ Aucun token disponible pour tester les opérations de création');
        return;
    }

    console.log('\n🆕 Test des opérations de création...');

    // Test création d'une table
    try {
        const tableData = {
            number: 99,
            capacity: 4
        };

        const response = await makeRequest('POST', '/api/tables', tableData, authToken);
        
        if (response.statusCode === 200 || response.statusCode === 201) {
            console.log(`✅ Création de table: Status ${response.statusCode}`);
            console.log(`   Table créée: ${JSON.stringify(response.data)}`);
        } else {
            console.log(`❌ Création de table: Status ${response.statusCode}`);
            if (response.data.message) {
                console.log(`   Message: ${response.data.message}`);
            }
        }
    } catch (error) {
        console.log(`❌ Création de table: Erreur - ${error.message}`);
    }

    // Test création d'une dépense
    try {
        const expenseData = {
            description: 'Test dépense via script',
            amount: 25.50,
            category: 'fournitures'
        };

        const response = await makeRequest('POST', '/api/expenses', expenseData, authToken);
        
        if (response.statusCode === 200 || response.statusCode === 201) {
            console.log(`✅ Création de dépense: Status ${response.statusCode}`);
            console.log(`   Dépense créée: ${JSON.stringify(response.data)}`);
        } else {
            console.log(`❌ Création de dépense: Status ${response.statusCode}`);
            if (response.data.message) {
                console.log(`   Message: ${response.data.message}`);
            }
        }
    } catch (error) {
        console.log(`❌ Création de dépense: Erreur - ${error.message}`);
    }
}

async function main() {
    console.log('🚀 Démarrage des tests d\'authentification RestoManager\n');

    try {
        // Test de connexion
        const loginSuccess = await testLogin();
        
        if (loginSuccess) {
            // Test des endpoints protégés
            await testProtectedEndpoints();
            
            // Test des opérations de création
            await testCreateOperations();
        }

        console.log('\n✨ Tests terminés');
        
        if (loginSuccess) {
            console.log('\n📋 Prochaines étapes:');
            console.log('1. Les endpoints fonctionnent avec l\'authentification');
            console.log('2. Vous pouvez maintenant vous connecter à l\'interface web');
            console.log('3. Utilisez les identifiants trouvés pour vous connecter');
        } else {
            console.log('\n⚠️  Problèmes identifiés:');
            console.log('1. Impossible de se connecter avec les mots de passe testés');
            console.log('2. Vérifiez que l\'utilisateur admin existe dans la base de données');
            console.log('3. Considérez relancer le seed: npm run db:seed');
        }

    } catch (error) {
        console.error('❌ Erreur générale:', error.message);
    }
}

// Exécuter les tests
if (require.main === module) {
    main();
}

module.exports = { makeRequest, testLogin };
