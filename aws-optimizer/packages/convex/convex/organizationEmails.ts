/**
 * Organization Email Actions
 *
 * Internal actions for sending organization-related emails via Resend.
 * Used by the Better Auth organization plugin for invitation emails.
 */

import { v } from "convex/values";
import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { internalAction, action } from "./_generated/server";

// Initialize Resend component
const resend = new Resend(components.resend, {
  testMode: process.env.NODE_ENV !== "production",
});

// Default sender email address
const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "AWS Cost Optimizer <noreply@awsoptimizer.com>";
const SITE_URL = process.env.SITE_URL || "https://placeholder.convex.site";

/**
 * Send an organization invitation email.
 * Called when a user is invited to join an organization.
 */
export const sendInvitationEmail = internalAction({
  args: {
    email: v.string(),
    invitationId: v.string(),
    organizationName: v.string(),
    inviterName: v.string(),
    role: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.string()),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const { email, invitationId, organizationName, inviterName, role } = args;
    const invitationLink = `${SITE_URL}/accept-invitation/${invitationId}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ff6b00; margin: 0;">AWS Cost Optimizer</h1>
        </div>
        
        <h2 style="color: #1a1a1a; margin-bottom: 20px;">You're invited to join ${organizationName}</h2>
        
        <p style="color: #333; line-height: 1.6; font-size: 16px;">
          <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> 
          as a <strong style="text-transform: capitalize;">${role}</strong>.
        </p>
        
        <p style="color: #333; line-height: 1.6; font-size: 16px;">
          AWS Cost Optimizer helps teams monitor and reduce their AWS spending with AI-powered insights.
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${invitationLink}" 
             style="background-color: #ff6b00; color: white; padding: 14px 32px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          If you don't want to join this organization, you can simply ignore this email.
          This invitation will expire in 7 days.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          This email was sent by AWS Cost Optimizer. If you didn't expect this invitation,
          you can safely ignore it.
        </p>
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          <a href="${invitationLink}" style="color: #999; word-break: break-all;">
            ${invitationLink}
          </a>
        </p>
      </div>
    `;

    const textContent = `
You're invited to join ${organizationName}

${inviterName} has invited you to join ${organizationName} as a ${role}.

AWS Cost Optimizer helps teams monitor and reduce their AWS spending with AI-powered insights.

Accept the invitation by visiting:
${invitationLink}

If you don't want to join this organization, you can simply ignore this email.
This invitation will expire in 7 days.

---
This email was sent by AWS Cost Optimizer.
    `;

    try {
      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_FROM_EMAIL,
        to: email,
        subject: `You're invited to join ${organizationName} on AWS Cost Optimizer`,
        html: htmlContent,
        text: textContent,
      });

      return {
        success: true,
        messageId: emailId,
        message: `Invitation email sent to ${email}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to send invitation email:", errorMessage);

      return {
        success: false,
        message: `Failed to send invitation email: ${errorMessage}`,
      };
    }
  },
});

/**
 * Send a welcome email when a user accepts an organization invitation.
 */
export const sendWelcomeEmail = internalAction({
  args: {
    email: v.string(),
    userName: v.string(),
    organizationName: v.string(),
    role: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.string()),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const { email, userName, organizationName, role } = args;
    const dashboardLink = `${SITE_URL}/dashboard`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ff6b00; margin: 0;">AWS Cost Optimizer</h1>
        </div>
        
        <h2 style="color: #1a1a1a; margin-bottom: 20px;">Welcome to ${organizationName}!</h2>
        
        <p style="color: #333; line-height: 1.6; font-size: 16px;">
          Hi ${userName},
        </p>
        
        <p style="color: #333; line-height: 1.6; font-size: 16px;">
          You've successfully joined <strong>${organizationName}</strong> as a 
          <strong style="text-transform: capitalize;">${role}</strong>.
        </p>
        
        <p style="color: #333; line-height: 1.6; font-size: 16px;">
          You now have access to the organization's AWS cost data, reports, and recommendations.
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${dashboardLink}" 
             style="background-color: #ff6b00; color: white; padding: 14px 32px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: 600; font-size: 16px;">
            Go to Dashboard
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          This email was sent by AWS Cost Optimizer.
        </p>
      </div>
    `;

    try {
      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_FROM_EMAIL,
        to: email,
        subject: `Welcome to ${organizationName} on AWS Cost Optimizer`,
        html: htmlContent,
        text: `Welcome to ${organizationName}!\n\nHi ${userName},\n\nYou've successfully joined ${organizationName} as a ${role}.\n\nGo to your dashboard: ${dashboardLink}`,
      });

      return {
        success: true,
        messageId: emailId,
        message: `Welcome email sent to ${email}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to send welcome email:", errorMessage);

      return {
        success: false,
        message: `Failed to send welcome email: ${errorMessage}`,
      };
    }
  },
});

/**
 * Public action to send invitation email (can be called from client via HTTP action).
 * This is useful when the Better Auth plugin triggers an invitation.
 */
export const triggerInvitationEmail = action({
  args: {
    email: v.string(),
    invitationId: v.string(),
    organizationName: v.string(),
    inviterName: v.string(),
    role: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const { email, invitationId, organizationName, inviterName, role } = args;
    const invitationLink = `${SITE_URL}/accept-invitation/${invitationId}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ff6b00; margin: 0;">AWS Cost Optimizer</h1>
        </div>
        
        <h2 style="color: #1a1a1a; margin-bottom: 20px;">You're invited to join ${organizationName}</h2>
        
        <p style="color: #333; line-height: 1.6; font-size: 16px;">
          <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> 
          as a <strong style="text-transform: capitalize;">${role}</strong>.
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${invitationLink}" 
             style="background-color: #ff6b00; color: white; padding: 14px 32px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          This email was sent by AWS Cost Optimizer.
        </p>
      </div>
    `;

    try {
      await resend.sendEmail(ctx, {
        from: DEFAULT_FROM_EMAIL,
        to: email,
        subject: `You're invited to join ${organizationName} on AWS Cost Optimizer`,
        html: htmlContent,
        text: `You're invited to join ${organizationName}. Accept the invitation: ${invitationLink}`,
      });

      return {
        success: true,
        message: `Invitation email sent to ${email}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        message: `Failed to send invitation email: ${errorMessage}`,
      };
    }
  },
});
