#!/usr/bin/env node

/**
 * Comprehensive test script for API endpoints
 * Tests both table and expense creation with various scenarios
 */

require('dotenv').config();

const API_BASE_URL = 'https://systeme-management2-0.onrender.com';

class APITester {
  constructor() {
    this.authToken = null;
  }

  async login(username = 'admin', password = 'password') {
    console.log('🔐 Attempting login...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const error = await response.json();
        console.log('❌ Login failed:', error.message);
        return false;
      }

      const data = await response.json();
      this.authToken = data.token;
      console.log('✅ Login successful');
      return true;
    } catch (error) {
      console.error('❌ Login error:', error.message);
      return false;
    }
  }

  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authToken}`
    };
  }

  async testTableCreation() {
    console.log('\n🏗️ Testing table creation...');
    
    const testCases = [
      {
        name: 'Valid table data',
        data: { number: 99, capacity: 4 },
        expectedStatus: 200,
        shouldSucceed: true
      },
      {
        name: 'String numbers (should work)',
        data: { number: "100", capacity: "6" },
        expectedStatus: 200,
        shouldSucceed: true
      },
      {
        name: 'Missing capacity',
        data: { number: 101 },
        expectedStatus: 400,
        shouldSucceed: false
      },
      {
        name: 'Invalid number format',
        data: { number: "abc", capacity: 4 },
        expectedStatus: 400,
        shouldSucceed: false
      },
      {
        name: 'Negative values',
        data: { number: -1, capacity: -2 },
        expectedStatus: 400,
        shouldSucceed: false
      }
    ];

    const results = [];

    for (const testCase of testCases) {
      console.log(`\n  Testing: ${testCase.name}`);
      console.log(`  Data: ${JSON.stringify(testCase.data)}`);
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/tables`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(testCase.data)
        });

        const responseData = await response.json();
        const success = response.ok === testCase.shouldSucceed;
        
        console.log(`  Status: ${response.status} (expected: ${testCase.expectedStatus})`);
        
        if (success) {
          console.log(`  ✅ ${testCase.name} - PASSED`);
        } else {
          console.log(`  ❌ ${testCase.name} - FAILED`);
          console.log(`  Response:`, JSON.stringify(responseData, null, 2));
        }

        results.push({
          testCase: testCase.name,
          passed: success,
          status: response.status,
          response: responseData
        });

        // Clean up successful table creations
        if (response.ok && responseData.id) {
          try {
            await fetch(`${API_BASE_URL}/api/tables/${responseData.id}`, {
              method: 'DELETE',
              headers: this.getAuthHeaders()
            });
          } catch (cleanupError) {
            console.log(`  ⚠️ Cleanup failed for table ${responseData.id}`);
          }
        }

      } catch (error) {
        console.log(`  ❌ ${testCase.name} - ERROR: ${error.message}`);
        results.push({
          testCase: testCase.name,
          passed: false,
          error: error.message
        });
      }
    }

    return results;
  }

  async testExpenseCreation() {
    console.log('\n💰 Testing expense creation...');
    
    const testCases = [
      {
        name: 'Valid expense data',
        data: { 
          description: 'Test expense', 
          amount: 100.50, 
          category: 'Autre' 
        },
        expectedStatus: 200,
        shouldSucceed: true
      },
      {
        name: 'String amount (should work)',
        data: { 
          description: 'Test expense 2', 
          amount: "75.25", 
          category: 'Transport' 
        },
        expectedStatus: 200,
        shouldSucceed: true
      },
      {
        name: 'With receipt URL',
        data: { 
          description: 'Test expense with receipt', 
          amount: 50, 
          category: 'Équipement',
          receiptUrl: 'https://example.com/receipt.jpg'
        },
        expectedStatus: 200,
        shouldSucceed: true
      },
      {
        name: 'Missing description',
        data: { 
          amount: 100, 
          category: 'Autre' 
        },
        expectedStatus: 400,
        shouldSucceed: false
      },
      {
        name: 'Missing category',
        data: { 
          description: 'Test expense', 
          amount: 100 
        },
        expectedStatus: 400,
        shouldSucceed: false
      },
      {
        name: 'Invalid amount (negative)',
        data: { 
          description: 'Test expense', 
          amount: -50, 
          category: 'Autre' 
        },
        expectedStatus: 400,
        shouldSucceed: false
      },
      {
        name: 'Invalid amount (not a number)',
        data: { 
          description: 'Test expense', 
          amount: "not-a-number", 
          category: 'Autre' 
        },
        expectedStatus: 400,
        shouldSucceed: false
      }
    ];

    const results = [];

    for (const testCase of testCases) {
      console.log(`\n  Testing: ${testCase.name}`);
      console.log(`  Data: ${JSON.stringify(testCase.data)}`);
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/expenses`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(testCase.data)
        });

        const responseData = await response.json();
        const success = response.ok === testCase.shouldSucceed;
        
        console.log(`  Status: ${response.status} (expected: ${testCase.expectedStatus})`);
        
        if (success) {
          console.log(`  ✅ ${testCase.name} - PASSED`);
        } else {
          console.log(`  ❌ ${testCase.name} - FAILED`);
          console.log(`  Response:`, JSON.stringify(responseData, null, 2));
        }

        results.push({
          testCase: testCase.name,
          passed: success,
          status: response.status,
          response: responseData
        });

        // Clean up successful expense creations
        if (response.ok && responseData.id) {
          try {
            await fetch(`${API_BASE_URL}/api/expenses/${responseData.id}`, {
              method: 'DELETE',
              headers: this.getAuthHeaders()
            });
          } catch (cleanupError) {
            console.log(`  ⚠️ Cleanup failed for expense ${responseData.id}`);
          }
        }

      } catch (error) {
        console.log(`  ❌ ${testCase.name} - ERROR: ${error.message}`);
        results.push({
          testCase: testCase.name,
          passed: false,
          error: error.message
        });
      }
    }

    return results;
  }

  async runAllTests() {
    console.log('🧪 Starting comprehensive API endpoint tests...\n');
    
    // First login
    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log('\n❌ Cannot proceed without login. Please check credentials.');
      return;
    }

    // Test table creation
    const tableResults = await this.testTableCreation();
    
    // Test expense creation
    const expenseResults = await this.testExpenseCreation();

    // Summary
    console.log('\n📊 Test Summary');
    console.log('================');

    const allResults = [...tableResults, ...expenseResults];
    const passed = allResults.filter(r => r.passed).length;
    const total = allResults.length;

    console.log(`\nTotal tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`);

    // Failed tests details
    const failed = allResults.filter(r => !r.passed);
    if (failed.length > 0) {
      console.log('\n❌ Failed tests:');
      failed.forEach(test => {
        console.log(`  - ${test.testCase}`);
        if (test.response?.message) {
          console.log(`    Error: ${test.response.message}`);
        }
        if (test.response?.details) {
          console.log(`    Details: ${test.response.details}`);
        }
      });
    }

    console.log('\n🏁 Tests completed!');
  }
}

// Quick health check
async function healthCheck() {
  console.log('🏥 Checking API health...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API is healthy');
      console.log(`  Status: ${data.status}`);
      console.log(`  Version: ${data.version}`);
      return true;
    } else {
      console.log('❌ API health check failed');
      return false;
    }
  } catch (error) {
    console.log('❌ API is not reachable:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 RestoManager API Endpoint Tests\n');
  
  // Health check first
  const isHealthy = await healthCheck();
  if (!isHealthy) {
    console.log('\n💡 Make sure the server is running and accessible');
    console.log(`   Server URL: ${API_BASE_URL}`);
    return;
  }

  // Run comprehensive tests
  const tester = new APITester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { APITester, healthCheck };
