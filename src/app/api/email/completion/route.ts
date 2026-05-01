import { NextResponse } from 'next/server';
import { sendMissionCompletedEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { to, proName, jobTitle } = await req.json();

    if (!to || !proName || !jobTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await sendMissionCompletedEmail(to, proName, jobTitle);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('API Error: Failed to send completion email:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
