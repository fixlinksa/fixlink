import { NextResponse } from 'next/server';
import { sendDocumentEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { to, proName, type, pdfBase64, filename } = await req.json();

    if (!to || !proName || !type || !pdfBase64 || !filename) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await sendDocumentEmail(to, proName, type, pdfBase64, filename);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    console.error('API Error: Failed to send document email:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
