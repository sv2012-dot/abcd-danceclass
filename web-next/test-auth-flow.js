// Test script to trace AuthContext initialization
const http = require('http');

async function testAuthFlow() {
  console.log('\n========== TESTING AUTH FLOW ==========\n');

  // Test 1: Verify backend is up
  console.log('1. Testing backend health...');
  try {
    const response = await fetch('http://localhost:5000/api/auth/me');
    console.log(`   Backend responds: ${response.status} ${response.statusText}`);
    if (response.status === 401) {
      console.log('   ✓ Backend auth middleware is working (rejects unauthenticated)');
    }
  } catch (e) {
    console.log(`   ✗ Backend error: ${e.message}`);
  }

  // Test 2: Login flow
  console.log('\n2. Testing login flow...');
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'teacher@manchq.com',
        password: 'School123!'
      })
    });
    const loginData = await loginRes.json();
    console.log(`   Login response: ${loginRes.status}`);
    console.log(`   Token: ${loginData.token ? 'YES' : 'NO'}`);
    console.log(`   User: ${loginData.user ? loginData.user.name : 'NO'}`);

    // Test 3: Use token with auth.me
    if (loginData.token) {
      console.log('\n3. Testing auth.me with token...');
      const meRes = await fetch('http://localhost:5000/api/auth/me', {
        headers: { Authorization: `Bearer ${loginData.token}` }
      });
      const meData = await meRes.json();
      console.log(`   auth.me response: ${meRes.status}`);
      console.log(`   User: ${meData.user ? meData.user.name : 'NO'}`);
      console.log(`   School: ${meData.school ? meData.school.name : 'NO'}`);
    }
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }

  // Test 4: Simulating client-side flow
  console.log('\n4. Simulating client-side initialization...');
  console.log('   The AuthContext would:');
  console.log('   - Check for token in sessionStorage/localStorage');
  console.log('   - If token exists: call auth.me()');
  console.log('   - Set user state based on response');
  console.log('   - Set loading=false');
  console.log('   - Page.tsx checks: if (!loading && !user) -> redirect to /login');

  // Test 5: Tracing the actual issue
  console.log('\n5. TRACING THE ISSUE:');
  console.log('   Scenario A: User has NO token');
  console.log('   → AuthContext sets loading=false, user=null');
  console.log('   → page.tsx sees: loading=false && user=null');
  console.log('   → page.tsx redirects to /login ✓ CORRECT');
  console.log('');
  console.log('   Scenario B: User HAS valid token');
  console.log('   → AuthContext calls auth.me()');
  console.log('   → If auth.me() succeeds: sets user state');
  console.log('   → If auth.me() fails: clears token and sets user=null');
  console.log('   → Sets loading=false');
  console.log('   → page.tsx checks state and either shows home OR redirects');
  console.log('');
  console.log('   Scenario C: PROBLEM - auth.me() is failing');
  console.log('   → The backend auth.me endpoint requires a valid token');
  console.log('   → If token is expired or invalid → 401 response');
  console.log('   → AuthContext should catch this and clear the token');
  console.log('   → User should be redirected to /login');

  console.log('\n========== END TEST ==========\n');
}

testAuthFlow().catch(console.error);
