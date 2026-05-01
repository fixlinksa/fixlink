import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const adminEmail = 'admin@fixlink.org.za';
    const adminPassword = 'Sharne2010!';
    const adminDisplayName = 'Admin';

    if (!adminAuth) {
      return NextResponse.json({ 
        error: 'Firebase Admin not initialized.', 
        details: 'Server-side admin functionality requires FIREBASE_SERVICE_ACCOUNT_KEY or application default credentials in production.',
        suggestion: 'Verify your environment variables in the Firebase Console and ensure the service account has the necessary permissions.'
      }, { status: 500 });
    }

    let userRecord;
    try {
      // Check if admin already exists in Firebase Auth
      userRecord = await adminAuth.getUserByEmail(adminEmail);
      return NextResponse.json({ message: 'Admin account already exists.' }, { status: 200 });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // Create the Admin user in Firebase Auth
        userRecord = await adminAuth.createUser({
          email: adminEmail,
          password: adminPassword,
          displayName: adminDisplayName,
        });

        // Set custom claims for admin role if needed
        await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'admin' });

        // Create the user profile in Firestore
        if (adminDb) {
          await adminDb.collection('users').doc(userRecord.uid).set({
            email: adminEmail,
            fullName: adminDisplayName,
            role: 'admin',
            onboardingCompleted: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Admin account initialized successfully in Firebase.',
          uid: userRecord.uid 
        }, { status: 201 });
      }
      throw error;
    }

  } catch (error: any) {
    console.error('Error initializing Admin:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to initialize admin.' 
    }, { status: 500 });
  }
}
