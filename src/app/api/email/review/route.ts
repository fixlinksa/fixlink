import { NextResponse } from 'next/server';
import { sendReviewReceivedEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { to, customerName, jobTitle, rating } = await req.json();

    if (!to || !customerName || !jobTitle || rating === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await sendReviewReceivedEmail(to, customerName, jobTitle, rating);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('API Error: Failed to send review email:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
