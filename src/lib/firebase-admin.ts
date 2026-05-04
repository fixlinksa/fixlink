import * as admin from 'firebase-admin';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Firebase Admin Initialization
 * 
 * This module handles the initialization of the Firebase Admin SDK.
 * It attempts to load credentials from:
 * 1. FIREBASE_SERVICE_ACCOUNT_KEY environment variable (preferred for production/CI)
 * 2. Local sa.json file (preferred for local development)
 * 3. Fallback search paths
 */

function getAdminApp() {
  // If already initialized, reuse the primary instance
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  try {
    const serviceAccountKey = process.env.SERVICE_ACCOUNT_KEY_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    // 1. Production/Cloud Environment: Attempt automatic synchronization
    if (!serviceAccountKey && process.env.NODE_ENV === 'production') {
      console.log('Firebase Admin: Initiating applicationDefault protocol');
      return admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'fix-link-marketplace-928374'}.firebaseio.com`
      });
    }

    // 2. Explicit Credential Protocol (Env or Local File)
    if (serviceAccountKey) {
      console.log('Firebase Admin: Initiating explicit credential protocol');
      let sanitizedKey = serviceAccountKey.trim();
      if ((sanitizedKey.startsWith("'") && sanitizedKey.endsWith("'")) || 
          (sanitizedKey.startsWith('"') && sanitizedKey.endsWith('"'))) {
        sanitizedKey = sanitizedKey.slice(1, -1);
      }
      const serviceAccount = JSON.parse(sanitizedKey);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    // 3. Local Development Fallback
    const localSaPath = path.join(process.cwd(), 'sa.json');
    if (fs.existsSync(localSaPath)) {
      console.log('Firebase Admin: Initiating local development protocol via sa.json');
      const serviceAccount = JSON.parse(fs.readFileSync(localSaPath, 'utf8'));
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    console.warn('Firebase Admin: Initialization protocol incomplete - No credentials detected');
    return null;
  } catch (error: any) {
    console.error('Firebase Admin: Protocol failure during initialization:', error.message);
    return null;
  }
}

// Global caching for development
const globalForFirebase = global as unknown as {
  firebaseAdminApp: admin.app.App | undefined;
};

function getInitializedApp() {
  if (globalForFirebase.firebaseAdminApp) return globalForFirebase.firebaseAdminApp;
  const app = getAdminApp();
  if (app) globalForFirebase.firebaseAdminApp = app;
  return app;
}

// Fixed exports to be more reliable
export const adminDb = {
  get firestore() {
    try {
      const app = getInitializedApp();
      if (!app) {
        console.error('adminDb.firestore: FAILED - App initialization returned null');
        return null;
      }
      return admin.firestore(app);
    } catch (e: any) {
      console.error('adminDb.firestore: EXCEPTION during acquisition:', e.message);
      return null;
    }
  },
  collection(collectionPath: string) {
    const db = this.firestore;
    return db ? db.collection(collectionPath) : (null as any);
  }
} as any;

export const adminAuth = {
  get auth() {
    const app = getInitializedApp();
    if (!app) {
      console.error('adminAuth.auth: App not initialized');
      return null;
    }
    return admin.auth(app);
  },
  async verifyIdToken(token: string) {
    const auth = this.auth;
    if (!auth) throw new Error('Firebase Admin Auth not initialized');
    return auth.verifyIdToken(token);
  },
  async getUser(uid: string) {
    const auth = this.auth;
    if (!auth) throw new Error('Firebase Admin Auth not initialized');
    return auth.getUser(uid);
  }
} as any;

export { admin };
