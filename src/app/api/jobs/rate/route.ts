import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
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

    if (!jobId || typeof rating !== 'number') {
      return NextResponse.json({ error: 'Missing required fields: jobId and rating are required' }, { status: 400 });
    }

    // Get Job Data
    const jobRef = adminDb.collection('jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobData = jobSnap.data();

    // Verify ownership
    if (jobData?.customerId !== userId) {
      return NextResponse.json({ error: 'Forbidden: You do not own this job' }, { status: 403 });
    }

    const proId = jobData?.tradesmanId;
    if (!proId) {
      return NextResponse.json({ error: 'No professional assigned to this job' }, { status: 400 });
    }

    const oldRating = jobData?.rating;
    const isOverride = typeof oldRating === 'number';

    // Update Job
    await jobRef.update({
      status: 'completed',
      rating,
      review,
      completedAt: FieldValue.serverTimestamp()
    });

    // Update Professional's average rating
    const proRef = adminDb.collection('users').doc(proId);
    const proSnap = await proRef.get();

    if (proSnap.exists) {
      const proData = proSnap.data() || {};
      const currentRating = typeof proData.rating === 'number' ? proData.rating : 5.0;
      const currentCount = typeof proData.reviewCount === 'number' ? proData.reviewCount : 0;
      
      let newCount = currentCount;
      let calculatedRating = currentRating;

      if (isOverride) {
        // If overriding, we don't change the count, just update the sum
        // Sum = currentRating * currentCount
        // NewSum = Sum - oldRating + newRating
        // NewRating = NewSum / currentCount
        if (currentCount > 0) {
          calculatedRating = ((currentRating * currentCount) - oldRating + rating) / currentCount;
        } else {
          calculatedRating = rating;
          newCount = 1;
        }
      } else {
        // First time rating
        newCount = currentCount + 1;
        calculatedRating = currentCount === 0 ? rating : ((currentRating * currentCount) + rating) / newCount;
      }

      const finalRating = Math.round(calculatedRating * 10) / 10;

      await proRef.update({
        rating: finalRating,
        reviewCount: newCount
      });

      // Notify Professional
      await adminDb.collection('notifications').add({
        userId: proId,
        type: 'job_completed',
        title: isOverride ? 'Review Updated' : 'Mission Accomplished!',
        message: isOverride 
          ? `Customer ${jobData.customerName || 'someone'} updated their review for "${jobData.title}" to ${rating} stars.`
          : `Customer ${jobData.customerName || 'someone'} marked "${jobData.title}" as complete and gave you ${rating} stars.`,
        jobId,
        createdAt: FieldValue.serverTimestamp(),
        read: false
      });

      // Send Email
      if (proData.email) {
        try {
          await sendReviewReceivedEmail(
            proData.email,
            jobData.customerName || 'A customer',
            jobData.title,
            rating
          );
        } catch (emailError) {
          console.error('Failed to send review email:', emailError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Rating API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
