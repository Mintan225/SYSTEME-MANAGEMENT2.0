#!/usr/bin/env node

/**
 * Test script to verify the table creation endpoint
 */

require('dotenv').config();

const API_BASE_URL = 'https://systeme-management2-0.onrender.com';

async function testTableCreation() {
  console.log('🧪 Testing table creation endpoint...\n');

  try {
    // First, let's test login to get a valid token
    console.log('1. Testing login...');
    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin', // Replace with actual username
        password: 'password' // Replace with actual password
      })
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      console.log('❌ Login failed:', error);
      console.log('\n💡 Please update the username/password in the script');
      return;
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login successful');
    
    const authToken = loginData.token;
    
    // Now test table creation
    console.log('\n2. Testing table creation...');
    
    const testTable = {
      number: 99, // Use a high number to avoid conflicts
      capacity: 4,
      qrCode: `${API_BASE_URL}/table/99`
    };
    
    console.log('Sending data:', JSON.stringify(testTable, null, 2));
    
    const tableResponse = await fetch(`${API_BASE_URL}/api/tables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(testTable)
    });

    const responseText = await tableResponse.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.log('❌ Response is not valid JSON:', responseText);
      return;
    }

    console.log(`Response status: ${tableResponse.status}`);
    console.log('Response data:', JSON.stringify(responseData, null, 2));

    if (tableResponse.ok) {
      console.log('✅ Table created successfully!');
      
      // Clean up - try to delete the test table (optional)
      console.log('\n3. Cleaning up test table...');
      try {
        const deleteResponse = await fetch(`${API_BASE_URL}/api/tables/${responseData.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (deleteResponse.ok) {
          console.log('✅ Test table cleaned up');
        } else {
          console.log('⚠️ Could not clean up test table (this is okay)');
        }
      } catch (cleanupError) {
        console.log('⚠️ Cleanup failed:', cleanupError.message);
      }
      
    } else {
      console.log('❌ Table creation failed');
      
      // Detailed error analysis
      if (tableResponse.status === 400) {
        console.log('\n🔍 Bad Request Analysis:');
        if (responseData.message) console.log('Message:', responseData.message);
        if (responseData.details) console.log('Details:', responseData.details);
        if (responseData.errors) console.log('Errors:', responseData.errors);
        if (responseData.received) console.log('Server received:', responseData.received);
      } else if (tableResponse.status === 401) {
        console.log('\n🔍 Authentication issue - token may be invalid');
      } else if (tableResponse.status === 403) {
        console.log('\n🔍 Permission issue - user may not have table creation rights');
      } else if (tableResponse.status === 409) {
        console.log('\n🔍 Conflict - table number may already exist');
      }
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 Make sure the server is running and accessible');
    }
  }
}

// Test different request formats
async function testDifferentFormats() {
  console.log('\n🧪 Testing different request formats...\n');
  
  const testCases = [
    {
      name: 'Numbers as integers',
      data: { number: 100, capacity: 4 }
    },
    {
      name: 'Numbers as strings',
      data: { number: "101", capacity: "6" }
    },
    {
      name: 'With explicit qrCode',
      data: { number: 102, capacity: 2, qrCode: `${API_BASE_URL}/table/102` }
    },
    {
      name: 'Missing capacity (should fail)',
      data: { number: 103 }
    },
    {
      name: 'Invalid number format (should fail)',
      data: { number: "abc", capacity: 4 }
    }
  ];

  // We'd need a valid token for this, so just show the format
  console.log('Test cases that would be tested with a valid token:');
  testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.name}:`, JSON.stringify(testCase.data));
  });
}

if (require.main === module) {
  testTableCreation()
    .then(() => testDifferentFormats())
    .then(() => {
      console.log('\n🏁 Test completed!');
      console.log('\n💡 To run a full test:');
      console.log('1. Update username/password in this script');
      console.log('2. Run: node test-table-creation.cjs');
    })
    .catch(console.error);
}

module.exports = { testTableCreation };
