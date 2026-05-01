import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const adminEmail = 'admin@fixlink.org.za';
    const adminPassword = 'Abiec7808!';

    if (!adminAuth || !adminDb) {
      return NextResponse.json({ 
        error: 'Firebase Admin not initialized. Check FIREBASE_SERVICE_ACCOUNT_KEY.',
        details: 'The Admin SDK is required to manage roles and system-level users.',
        suggestion: 'Ensure your FIREBASE_SERVICE_ACCOUNT_KEY environment variable is set in the production dashboard.'
      }, { status: 500 });
    }

    let user;
    try {
      user = await adminAuth.getUserByEmail(adminEmail);
      // Update existing user password
      await adminAuth.updateUser(user.uid, {
        password: adminPassword,
        displayName: 'Administrator'
      });
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        // Create new user
        user = await adminAuth.createUser({
          email: adminEmail,
          password: adminPassword,
          displayName: 'Administrator',
          emailVerified: true
        });
      } else {
        throw e;
      }
    }

    // Set role in Firestore
    await adminDb.collection('users').doc(user.uid).set({
      id: user.uid,
      email: adminEmail,
      role: 'admin',
      fullName: 'Administrator',
      onboardingCompleted: true,
      createdAt: new Date(),
      hasSeenWelcome: true
    }, { merge: true });

    return NextResponse.json({ 
      success: true, 
      message: `Admin user ${adminEmail} initialized/updated successfully.` 
    });
  } catch (error: any) {
    console.error('Admin Init Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Unknown error occurred during admin init.' 
    }, { status: 500 });
  }
}
