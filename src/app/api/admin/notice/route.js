import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const body = await request.json();
    const { recipientEmail, recipientName, subject, message, actionUrl, userId } = body;

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid recipient email is required.' }, { status: 400 });
    }
    if (!message || message.trim().length < 5) {
      return NextResponse.json({ error: 'Notice message must be at least 5 characters long.' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'Resend API key is not configured on the server.' }, { status: 500 });
    }

    // Read template from admin or root emails folder
    let templateHtml = '';
    const adminTemplatePath = path.join(process.cwd(), 'src', 'emails', 'account_notice.html');
    const rootTemplatePath = path.join(process.cwd(), '..', 'src', 'emails', 'account_notice.html');

    if (fs.existsSync(adminTemplatePath)) {
      templateHtml = fs.readFileSync(adminTemplatePath, 'utf8');
    } else if (fs.existsSync(rootTemplatePath)) {
      templateHtml = fs.readFileSync(rootTemplatePath, 'utf8');
    } else {
      // Resilient fallback template
      templateHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Important Notice</title></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f1f5f9; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; padding: 30px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #0f172a; margin: 0;">Notice from TutorOnline Administration</h2>
            </div>
            <p style="font-size: 15px; color: #334155;">Hello <strong>{{USER_NAME}}</strong>,</p>
            <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; color: #92400e; line-height: 1.6;">
              <strong>Notice Details:</strong><br/>
              {{MESSAGE}}
            </div>
            <div style="text-align: center; margin: 25px 0;">
              <a href="{{ACTION_URL}}" style="display: inline-block; background-color: #D97706; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 28px; border-radius: 999px;">View Account</a>
            </div>
            <p style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px;">
              &copy; 2026 TutorOnline.pk — Official Support & Administration
            </p>
          </div>
        </body>
        </html>
      `;
    }

    // Convert newlines in message to HTML line breaks
    const formattedMessage = message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    const emailSubject = subject?.trim() || 'Important Notice from TutorOnline Administration';
    const finalActionUrl = actionUrl?.trim() || 'https://tutoronline.pk/login';

    const mergedHtml = templateHtml
      .replace(/\{\{USER_NAME\}\}/g, recipientName || 'Valued Member')
      .replace(/\{\{MESSAGE\}\}/g, formattedMessage)
      .replace(/\{\{ACTION_URL\}\}/g, finalActionUrl);

    // Send via Resend REST API
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'TutorOnline Support <support@tutoronline.pk>',
        to: [recipientEmail],
        subject: emailSubject,
        html: mergedHtml
      })
    });

    const resData = await resendRes.json();
    if (!resendRes.ok) {
      console.error('Resend dispatch error:', resData);
      return NextResponse.json({ error: resData.message || 'Failed to dispatch email via Resend' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      messageId: resData.id,
      recipientEmail
    });
  } catch (err) {
    console.error('Admin notice API exception:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
