import admin from 'firebase-admin';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Manually parse .env.local to find the key line
let serviceAccountKey = '';
try {
  const envContent = fs.readFileSync(join(__dirname, '.env.local'), 'utf8');
  // Find the exact line starting with the key
  const lines = envContent.split(/\r?\n/);
  const keyLine = lines.find(l => l.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
  
  if (keyLine) {
    // Extract everything between the single quotes
    const rawValue = keyLine.substring(keyLine.indexOf("'") + 1, keyLine.lastIndexOf("'"));
    serviceAccountKey = rawValue;
  }
} catch (err) {
  console.error('Could not read .env.local');
}

if (!serviceAccountKey) {
  console.error('ERROR: FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local');
  process.exit(1);
}

try {
  // Parse the core JSON first
  const serviceAccount = JSON.parse(serviceAccountKey);
  
  // Now fix the private_key specifically (convert literal \n to real newlines)
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();
  const auth = admin.auth();

  const adminEmail = 'admin@fixlink.co.za';
  const adminPassword = 'Abiec7808!';

  async function rescue() {
    console.log(`🚀 Starting Rescue Mission for ${adminEmail}...`);
    
    let user;
    try {
      user = await auth.getUserByEmail(adminEmail);
      console.log('✅ User found. Updating password...');
      await auth.updateUser(user.uid, {
        password: adminPassword,
        displayName: 'Administrator'
      });
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log('✨ User not found. Creating new admin user...');
        user = await auth.createUser({
          email: adminEmail,
          password: adminPassword,
          displayName: 'Administrator',
          emailVerified: true
        });
      } else {
        throw e;
      }
    }

    console.log('🛡️ Setting admin role in Firestore...');
    await db.collection('users').doc(user.uid).set({
      id: user.uid,
      email: adminEmail,
      role: 'admin',
      fullName: 'Administrator',
      onboardingCompleted: true,
      updatedAt: new Date(),
      hasSeenWelcome: true
    }, { merge: true });

    console.log('🎉 MISSION ACCOMPLISHED!');
    console.log('--------------------------');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('--------------------------');
    console.log('You can now log in.');
  }

  rescue();
} catch (error) {
  console.error('❌ Rescue failed:', error);
}
