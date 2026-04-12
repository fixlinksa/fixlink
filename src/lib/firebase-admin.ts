import * as admin from 'firebase-admin';

function getAdminApp() {
  if (!admin.apps.length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKey) {
      try {
        // Sanitize the key to handle newlines correctly, especially if passed via some env systems
        const sanitizedKey = serviceAccountKey.includes('\\n') 
          ? serviceAccountKey.replace(/\\n/g, '\n')
          : serviceAccountKey;

        const serviceAccount = JSON.parse(sanitizedKey);
        return admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } catch (error) {
        console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY (Build Warning):', error);
      }
    }

    // Fallback for build-time or restricted environments
    if (process.env.NODE_ENV === 'production') {
      try {
        // Try to use application default credentials if available (e.g. in GCP/Firebase)
        return admin.initializeApp({
          credential: admin.credential.applicationDefault()
        });
      } catch (error) {
        console.warn('Firebase Admin: No service account key and no default credentials. Admin features will be disabled.');
        return null;
      }
    }

    return null;
  }
  return admin.apps[0];
}

export const adminDb = (() => {
  const app = getAdminApp();
  return app ? admin.firestore() : null as any;
})();

export const adminAuth = (() => {
  const app = getAdminApp();
  return app ? admin.auth() : null as any;
})();

export { admin };
