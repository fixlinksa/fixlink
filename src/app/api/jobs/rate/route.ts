import { NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/lib/firebase-admin';
import { sendReviewReceivedEmail } from '@/lib/email';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    // Auth Check
    const authHeader = req.headers.get('Authorization');
    console.log('--- Auth Diagnostics ---');
    console.log('Auth Header exists:', !!authHeader);
    
    if (!authHeader) {
      console.error('Rating API: Missing Authorization Header');
      return NextResponse.json({ error: 'Unauthorized: Missing Header' }, { status: 401 });
    }

    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      console.error('Rating API: Invalid Authorization Format');
      return NextResponse.json({ error: 'Unauthorized: Invalid Format' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'undefined' || token === 'null') {
      console.error('Rating API: Empty or stringified null/undefined token');
      return NextResponse.json({ error: 'Unauthorized: Empty Token' }, { status: 401 });
    }

    let decodedToken;
    try {
      console.log('Verifying token (length):', token.length);
      decodedToken = await adminAuth.verifyIdToken(token);
      console.log('Token verified successfully for UID:', decodedToken.uid);
    } catch (authError: any) {
      console.error('Token verification failed:', authError.message);
      return NextResponse.json({ 
        error: 'Unauthorized: Token Verification Failed - ' + authError.message,
        code: authError.code
      }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const { jobId, rating, review = '' } = await req.json();
    console.log('Verifying mission evaluation for Job:', jobId);

    if (!jobId || typeof rating !== 'number') {
      console.error('Rating API: Missing required mission data');
      return NextResponse.json({ error: 'Incomplete mission briefing: jobId and rating required' }, { status: 400 });
    }

    // Get Job Data
    const db = adminDb.firestore;
    if (!db) {
       console.error('Rating API: Intelligence database offline');
       return NextResponse.json({ error: 'Strategic Intelligence database offline' }, { status: 503 });
    }

    const jobRef = db.collection('jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      console.error('Rating API: Target mission not found:', jobId);
      return NextResponse.json({ error: 'Mission record not found' }, { status: 404 });
    }

    const jobData = jobSnap.data();
    console.log('Mission Data acquired. Customer ID:', jobData?.customerId);

    // Verify ownership
    if (jobData?.customerId !== userId) {
      console.error('Rating API: Unauthorized operative access. Expected:', jobData?.customerId, 'Got:', userId);
      return NextResponse.json({ error: 'Unauthorized operative access detected' }, { status: 403 });
    }

    const proId = jobData?.tradesmanId;
    if (!proId) {
      console.error('Rating API: No specialist assigned to mission:', jobId);
      return NextResponse.json({ error: 'No primary specialist assigned to mission' }, { status: 400 });
    }

    const oldRating = jobData?.rating;
    const isOverride = typeof oldRating === 'number';

    console.log('Executing mission closure update...');
    // Update Job
    try {
      await jobRef.update({
        status: 'completed',
        rating,
        review,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('Mission record updated successfully');
    } catch (updateError: any) {
      console.error('Rating API: Failed to update mission record:', updateError);
      throw new Error(`Mission update protocol failure: ${updateError.message}`);
    }

    // Update Professional's average rating
    const proRef = db.collection('users').doc(proId);
    const proSnap = await proRef.get();

    if (proSnap.exists) {
      console.log('Acquiring specialist performance profile:', proId);
      const proData = proSnap.data() || {};
      const currentRating = typeof proData.rating === 'number' ? proData.rating : 5.0;
      const currentCount = typeof proData.reviewCount === 'number' ? proData.reviewCount : 0;
      
      let newCount = currentCount;
      let calculatedRating = currentRating;

      if (isOverride) {
        if (currentCount > 0) {
          calculatedRating = ((currentRating * currentCount) - oldRating + rating) / currentCount;
        } else {
          calculatedRating = rating;
          newCount = 1;
        }
      } else {
        newCount = currentCount + 1;
        calculatedRating = currentCount === 0 ? rating : ((currentRating * currentCount) + rating) / newCount;
      }

      const finalRating = Math.round(calculatedRating * 10) / 10;

      await proRef.update({
        rating: finalRating,
        reviewCount: newCount
      });
      console.log('Specialist performance metrics synchronized');

      // Notify Professional
      try {
        await db.collection('notifications').add({
          userId: proId,
          type: 'job_completed',
          title: isOverride ? 'Review Updated' : 'Mission Accomplished!',
          message: isOverride 
            ? `Customer ${jobData.customerName || 'someone'} updated their review for "${jobData.title}" to ${rating} stars.`
            : `Customer ${jobData.customerName || 'someone'} marked "${jobData.title}" as complete and gave you ${rating} stars.`,
          jobId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false
        });
        console.log('Specialist notification dispatched');
      } catch (notifError) {
        console.warn('Rating API: Non-critical notification failure:', notifError);
      }

      // Send Email
      if (proData.email) {
        try {
          await sendReviewReceivedEmail(
            proData.email,
            jobData.customerName || 'A customer',
            jobData.title,
            rating
          );
          console.log('Evaluation dispatch email sent to:', proData.email);
        } catch (emailError) {
          console.error('Failed to send review email:', emailError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('--- RATING PROTOCOL FAILURE ---');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    return NextResponse.json({ 
      error: error.message || 'Internal Protocol Failure',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
