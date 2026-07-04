import nodemailer from 'nodemailer';

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Generate 6-digit OTP
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
export const sendOTPEmail = async (
  email: string,
  otp: string,
  type: 'signup' | 'login' | 'reset_password'
): Promise<boolean> => {
  const transporter = createTransporter();

  const subjects = {
    signup: 'Verify your email - NoteDrill',
    login: 'Your login code - NoteDrill',
    reset_password: 'Reset your password - NoteDrill',
  };

  const messages = {
    signup: `Welcome to NoteDrill! Your verification code is: <strong>${otp}</strong>`,
    login: `Your login verification code is: <strong>${otp}</strong>`,
    reset_password: `Your password reset code is: <strong>${otp}</strong>`,
  };

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subjects[type]}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0; font-size: 28px;">NoteDrill</h1>
          </div>

          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            ${messages[type]}
          </p>

          <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 30px 0;">
            <span style="font-size: 36px; font-weight: bold; color: #6366f1; letter-spacing: 8px;">${otp}</span>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            This code will expire in <strong>10 minutes</strong>.
          </p>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            If you didn't request this code, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} NoteDrill. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'NoteDrill <noreply@notedrill.com>',
      to: email,
      subject: subjects[type],
      html: htmlTemplate,
    });
    console.log(`OTP email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
};

/** Shared HTML wrapper matching sendOTPEmail's visual style, for the org emails below. */
function wrapEmailHtml(title: string, bodyHtml: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0; font-size: 28px;">NoteDrill</h1>
          </div>
          ${bodyHtml}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} NoteDrill. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/** Shared send helper for the templated emails below — logs and swallows transport errors. */
async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'NoteDrill <noreply@notedrill.com>',
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    return false;
  }
}

/**
 * Sends a registration confirmation to the org admin, containing their
 * School ID — this is the durable, retrievable record of that ID, since the
 * UI only ever shows it transiently.
 */
export const sendOrgWelcomeEmail = (params: {
  adminEmail: string;
  orgName: string;
  schoolId: string;
  loginUrl: string;
}): Promise<boolean> => {
  const { adminEmail, orgName, schoolId, loginUrl } = params;

  const html = wrapEmailHtml(
    'Your NoteDrill School ID',
    `
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        <strong>${orgName}</strong> is now registered on NoteDrill. Keep this School ID somewhere
        safe — you'll need it, along with your email, to sign in.
      </p>
      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 30px 0;">
        <span style="font-size: 28px; font-weight: bold; color: #6366f1; letter-spacing: 2px;">${schoolId}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        <a href="${loginUrl}" style="color: #6366f1;">Sign in to NoteDrill</a>
      </p>
    `
  );

  return sendMail(adminEmail, `Your NoteDrill School ID for ${orgName}`, html);
};

/**
 * Sends a newly-invited student their one-time sign-in code, framed as an
 * invite (school name + School ID + "no password needed") rather than the
 * generic verification email — this is the single email a student receives
 * when an admin adds them; it replaces sending a separate OTP email plus a
 * separate welcome email.
 */
export const sendOrgInviteOTPEmail = (params: {
  email: string;
  otp: string;
  firstName?: string;
  schoolName: string;
  schoolId: string;
  loginUrl: string;
}): Promise<boolean> => {
  const { email, otp, firstName, schoolName, schoolId, loginUrl } = params;
  const greeting = firstName || 'there';

  const html = wrapEmailHtml(
    'Welcome to NoteDrill',
    `
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Hi ${greeting}, <strong>${schoolName}</strong> (School ID: ${schoolId}) has added you to
        NoteDrill. You don't need a password — just enter your email and the one-time code below
        to sign in.
      </p>
      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 30px 0;">
        <span style="font-size: 36px; font-weight: bold; color: #6366f1; letter-spacing: 8px;">${otp}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        This code will expire in <strong>10 minutes</strong>.
      </p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        <a href="${loginUrl}" style="color: #6366f1;">Sign in to NoteDrill</a>
      </p>
    `
  );

  return sendMail(email, `Welcome to NoteDrill, ${greeting}!`, html);
};

/**
 * Sends the "forgot your School ID" recovery email — lists every School ID
 * registered under this admin email, since Org.adminEmail has no uniqueness
 * constraint and one admin can run multiple schools.
 */
export const sendSchoolIdRecoveryEmail = (params: {
  adminEmail: string;
  schools: { name: string; schoolId: string }[];
  loginUrl: string;
}): Promise<boolean> => {
  const { adminEmail, schools, loginUrl } = params;
  const schoolListHtml = schools
    .map((s) => `<li style="margin-bottom: 6px;"><strong>${s.name}:</strong> ${s.schoolId}</li>`)
    .join('');

  const html = wrapEmailHtml(
    'Your NoteDrill School ID',
    `
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Here ${schools.length === 1 ? 'is the School ID' : 'are the School IDs'} registered to this email:
      </p>
      <ul style="color: #1f2937; font-size: 16px; line-height: 1.8; margin: 0 0 20px; padding-left: 20px;">
        ${schoolListHtml}
      </ul>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        <a href="${loginUrl}" style="color: #6366f1;">Sign in to NoteDrill</a>
      </p>
    `
  );

  return sendMail(adminEmail, 'Your NoteDrill School ID', html);
};

// Verify SMTP connection
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('Email service connected successfully');
    return true;
  } catch (error) {
    console.error('Email service connection failed:', error);
    return false;
  }
};
