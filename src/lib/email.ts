import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'fixlinksa@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD, 
  },
});
export async function sendWelcomeEmail(to: string, name: string) {
  if (!process.env.GMAIL_APP_PASSWORD || !process.env.GMAIL_USER) {
    console.warn('EMAIL FAILURE: Missing GMAIL_APP_PASSWORD or GMAIL_USER environment variables.');
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
    subject: `${type} from ${proName} | Fix Link Secure Chat`,
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

export async function sendAdminProNotification(proInfo: { name: string, email: string, trade: string }) {
  const hasPassword = !!(process.env.GMAIL_APP_PASSWORD || 'kljbvpfjioscsqmq');
  
  if (!hasPassword) {
    console.warn('Admin notification skipped: No email credentials');
    return { success: false };
  }

  const mailOptions = {
    from: '"Fix Link Intelligence" <fixlinksa@gmail.com>',
    to: 'fixlinksa@gmail.com',
    subject: `🚨 New Professional Alert: ${proInfo.name}`,
    html: `
      <div style="font-family: sans-serif; background: #f8fafc; padding: 40px; border-radius: 30px;">
        <h2 style="color: #1E4E79; text-transform: uppercase;">Professional Onboarding Alert</h2>
        <p style="font-size: 16px;">A new professional has registered on the platform:</p>
        <div style="background: white; padding: 30px; border-radius: 20px; border: 1px solid #e2e8f0;">
          <p><strong>Name:</strong> ${proInfo.name}</p>
          <p><strong>Email:</strong> ${proInfo.email}</p>
          <p><strong>Trade:</strong> ${proInfo.trade}</p>
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #64748b;">This is an automated intelligence notification from the Fix Link Marketplace.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (err) {
    console.error('Failed to notify admin:', err);
    return { success: false };
  }
}

export async function sendMissionCompletedEmail(to: string, proName: string, jobTitle: string) {
  const hasPassword = !!(process.env.GMAIL_APP_PASSWORD || 'kljbvpfjioscsqmq');
  
  if (!hasPassword) {
    console.warn('Completion email skipped: No credentials');
    return { success: false };
  }

  const mailOptions = {
    from: '"Fix Link Intelligence" <fixlinksa@gmail.com>',
    to,
    subject: `Mission Accomplished: ${jobTitle} 🚀`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eee; border-radius: 30px; background: #fff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1E4E79; text-transform: uppercase; letter-spacing: -1px; margin-bottom: 5px;">Mission Complete</h1>
          <p style="color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Fix Link Official Transmission</p>
        </div>
        
        <p style="font-size: 16px; color: #334155; line-height: 1.6;">Hello,</p>
        <p style="font-size: 16px; color: #334155; line-height: 1.6;">Professional <strong>${proName}</strong> has marked your mission <strong>"${jobTitle}"</strong> as complete.</p>
        
        <div style="background: #f8fafc; padding: 25px; border-radius: 20px; text-align: center; margin: 30px 0; border: 1px solid #e2e8f0;">
          <p style="margin-bottom: 20px; font-weight: bold; color: #1E4E79;">Please take a moment to rate the service provided. Your feedback maintains our elite marketplace standards.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/jobs/view" style="display: inline-block; background: #1E4E79; color: white; padding: 18px 35px; text-decoration: none; border-radius: 15px; font-weight: 900; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; box-shadow: 0 10px 20px rgba(30, 78, 121, 0.2);">Rate Professional & Close Project</a>
        </div>
        
        <p style="color: #64748b; font-size: 12px; text-align: center; font-style: italic;">Thank you for using Fix Link - The Professional Choice.</p>
        
        <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; text-align: center;">
          <p style="font-weight: bold; color: #1E4E79; margin-bottom: 0;">The Fix Link Team</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Completion email sent:', info.messageId);
    return { success: true };
  } catch (err) {
    console.error('Failed to send completion email:', err);
    return { success: false };
  }
}

export async function sendReviewReceivedEmail(to: string, customerName: string, jobTitle: string, rating: number) {
  const hasPassword = !!(process.env.GMAIL_APP_PASSWORD || 'kljbvpfjioscsqmq');
  
  if (!hasPassword) {
    console.warn('Review email skipped: No credentials');
    return { success: false };
  }

  const mailOptions = {
    from: '"Fix Link Intelligence" <fixlinksa@gmail.com>',
    to,
    subject: `Mission Honor Awarded: "${jobTitle}" 🏆`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eee; border-radius: 30px; background: #fff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1E4E79; text-transform: uppercase; letter-spacing: -1px; margin-bottom: 5px;">Honor Updated</h1>
          <p style="color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Fix Link Reputation Transmission</p>
        </div>
        
        <p style="font-size: 16px; color: #334155; line-height: 1.6;">Excellent work,</p>
        <p style="font-size: 16px; color: #334155; line-height: 1.6;">Customer <strong>${customerName}</strong> has rated your mission <strong>"${jobTitle}"</strong>.</p>
        
        <div style="background: #1E4E79; padding: 30px; border-radius: 20px; text-align: center; margin: 30px 0; color: white;">
          <p style="margin-bottom: 15px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; opacity: 0.8;">Mission Rating Details</p>
          <div style="font-size: 48px; font-weight: 900; margin-bottom: 10px;">${rating} <span style="font-size: 24px; opacity: 0.5;">/ 5.0</span></div>
          <div style="font-size: 18px; color: #fbbf24;">${'★'.repeat(Math.floor(rating))}${rating % 1 !== 0 ? '½' : ''}${'☆'.repeat(5 - Math.ceil(rating))}</div>
        </div>
        
        <p style="color: #64748b; font-size: 12px; text-align: center; font-style: italic;">This rating has been integrated into your professional profile and will uplift your market standing.</p>
        
        <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; text-align: center;">
          <p style="font-weight: bold; color: #1E4E79; margin-bottom: 0;">The Fix Link Team</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Review email sent:', info.messageId);
    return { success: true };
  } catch (err) {
    console.error('Failed to send review email:', err);
    return { success: false };
  }
}
