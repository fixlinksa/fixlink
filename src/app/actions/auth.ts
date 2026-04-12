'use server';

import { sendWelcomeEmail, sendAdminProNotification } from '@/lib/email';

export async function triggerWelcomeEmail(email: string, name: string) {
  try {
    const result = await sendWelcomeEmail(email, name);
    return result;
  } catch (error: any) {
    console.error('Welcome email error:', error);
    return { success: false, error: error?.message || String(error) };
  }
}

export async function triggerAdminProNotification(proInfo: { name: string, email: string, trade: string }) {
  try {
    const result = await sendAdminProNotification(proInfo);
    return result;
  } catch (error: any) {
    console.error('Admin notification error:', error);
    return { success: false };
  }
}
