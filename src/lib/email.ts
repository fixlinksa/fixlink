import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'fixlinksa@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD || 'kljbvpfjioscsqmq',
  },
});

export async function sendWelcomeEmail(to: string, name: string) {
  const hasPassword = !!(process.env.GMAIL_APP_PASSWORD || 'kljbvpfjioscsqmq');
  
  if (!hasPassword) {
    console.warn('Email skipped: GMAIL_APP_PASSWORD not configured.');
    return { success: false, error: 'Email service misconfigured' };
  }
  const mailOptions = {
    from: '"Fix Link" <fixlinksa@gmail.com>',
    to,
    subject: 'Welcome to Fix Link! 🚀',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
        <h1 style="color: #1E4E79; text-transform: uppercase;">Welcome to Fix Link, ${name}!</h1>
        <p>We're thrilled to have you join our marketplace.</p>
        <p>Whether you're looking for professional help or providing world-class services, Fix Link is here to help you connect and grow.</p>
        <div style="margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/login" style="background: #1E4E79; color: white; padding: 15px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Access Your Dashboard</a>
        </div>
        <p style="color: #666; font-size: 12px;">If you have any questions, feel free to reply to this email.</p>
        <p style="font-weight: bold; color: #1E4E79;">The Fix Link Team</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', info.messageId);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error: error?.message || String(error) };
  }
}

export async function sendDocumentEmail(to: string, proName: string, type: string, pdfBase64: string, filename: string) {
  const hasPassword = !!(process.env.GMAIL_APP_PASSWORD || 'kljbvpfjioscsqmq');
  
  if (!hasPassword) {
    console.warn('Email skipped: GMAIL_APP_PASSWORD not configured.');
    return { success: false, error: 'Email service misconfigured' };
  }

  const mailOptions = {
    from: `"Fix Link | ${proName}" <fixlinksa@gmail.com>`,
    to,
    subject: `${type} from ${proName} | Fix Link Comms`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
        <h2 style="color: #1E4E79; text-transform: uppercase;">Message from ${proName}</h2>
        <p>Please find the attached <strong>${type}</strong> for your recently discussed mission on Fix Link.</p>
        <p>You can view, accept, or pay this document directly through your Fix Link dashboard.</p>
        <div style="margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/login" style="background: #1E4E79; color: white; padding: 15px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">View in Dashboard</a>
        </div>
        <p style="color: #666; font-size: 11px; font-style: italic;">This document was generated and sent securely via the Fix Link Intelligence Platform.</p>
        <p style="font-weight: bold; color: #1E4E79;">The Fix Link Team</p>
      </div>
    `,
    attachments: [
      {
        filename: filename,
        content: pdfBase64.split('base64,')[1],
        encoding: 'base64'
      }
    ]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`${type} email sent:`, info.messageId);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to send ${type} email:`, error);
    return { success: false, error: error?.message || String(error) };
  }
}
