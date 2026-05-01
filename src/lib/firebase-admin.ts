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
  if (admin.apps.length) {
    return admin.apps[0];
  }

  const serviceAccountKey = process.env.SERVICE_ACCOUNT_KEY_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  // 1. Try Environment Variable
  if (serviceAccountKey) {
    try {
      console.log('Firebase Admin: Initializing via FIREBASE_SERVICE_ACCOUNT_KEY');
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
    } catch (error: any) {
      console.warn('Firebase Admin: Env init failed:', error.message);
    }
  }

  // 2. Try Local Files (only in development)
  if (process.env.NODE_ENV !== 'production') {
    const saPaths = [
      path.join(process.cwd(), 'sa.json'),
      path.join(process.cwd(), 'src', 'lib', 'sa.json'),
    ];

    console.log('Firebase Admin: Searching for sa.json in:', saPaths);

    for (const saPath of saPaths) {
      if (fs.existsSync(saPath)) {
        try {
          console.log('Firebase Admin: Found service account at', saPath);
          const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
          return admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        } catch (error: any) {
          console.error(`Firebase Admin: Error loading ${saPath}:`, error.message);
        }
      }
    }
  }

  // 3. Fallback for production
  if (process.env.NODE_ENV === 'production') {
    try {
      console.log('Firebase Admin: Falling back to applicationDefault');
      return admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    } catch (e: any) {
      console.error('Firebase Admin: applicationDefault failed:', e.message);
    }
  }

  console.error('Firebase Admin: FAILED TO INITIALIZE. No credentials found.');
  return null;
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
    const app = getInitializedApp();
    if (!app) {
      console.error('adminDb.firestore: App not initialized');
      return null;
    }
    return admin.firestore(app);
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
