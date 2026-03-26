/**
 * Convex Consent Functions for CreativeBridge (US-002, US-022)
 *
 * Implements Verifiable Parental Consent (VPC) using the "Email Plus" method
 * for COPPA compliance. When age-gating identifies a user under 13, the parent
 * must provide their email, receive a consent link, and confirm consent on a
 * web page before the child can access app features.
 *
 * Also implements annual consent renewal (US-022): at 11 months post-consent
 * a reminder email is sent, and at 12 months the account enters "renewal_required"
 * state until the parent re-consents via the same Email Plus flow.
 *
 * ## VPC Flow:
 * 1. Child signs up and age-gating identifies them as under 13
 * 2. App collects parent's email address
 * 3. System sends consent email with unique time-limited link (48h)
 * 4. Parent clicks link → consent web page explains data practices
 * 5. Parent clicks "I Consent" → consent record stored, child account activated
 * 6. If no consent within 48h → pending account data deleted
 *
 * @implements US-002: Verifiable Parental Consent (VPC) — Email Plus Method
 * @implements US-022: Annual Parental Consent Renewal
 */

import {
  query,
  mutation,
  action,
  internalMutation,
  internalQuery,
} from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { requireAuth, getClerkUserId } from './auth';
import { randomBytes } from 'crypto';

/** Consent link expiration: 48 hours in milliseconds */
const CONSENT_TOKEN_EXPIRY_MS = 48 * 60 * 60 * 1000;

/** Current privacy policy version — increment when policy changes */
const CURRENT_PRIVACY_POLICY_VERSION = '1.0.0';

/** 11 months in milliseconds — time to send renewal reminder */
const RENEWAL_REMINDER_MS = 11 * 30 * 24 * 60 * 60 * 1000; // ~11 months

/** 12 months in milliseconds — time to enforce renewal */
const RENEWAL_ENFORCE_MS = 12 * 30 * 24 * 60 * 60 * 1000; // ~12 months

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get the consent status for a child user.
 * Used by the frontend to determine whether to show pending/blocked state.
 *
 * @param clerkUserId - The child's Clerk user ID
 * @returns Consent record or null if none exists
 */
export const getConsentStatus = query({
  args: {},
  handler: async ctx => {
    const clerkUserId = await getClerkUserId(ctx);
    const record = await ctx.db
      .query('consentRecords')
      .withIndex('by_child', q => q.eq('childUserId', clerkUserId))
      .order('desc')
      .first();

    if (!record) {
      return null;
    }

    // S-2.8: Do not expose consentToken or parentEmail to the client
    return {
      status: record.status,
      consentTimestamp: record.consentTimestamp,
      consentVersion: record.consentVersion,
      tokenExpiresAt: record.consentTokenExpiresAt,
    };
  },
});

/**
 * Check if a user requires consent before accessing features.
 * Returns true if the user is under 13 and does not have granted consent.
 *
 * @param clerkUserId - The user's Clerk ID
 * @returns Whether the user is blocked pending consent
 */
export const isConsentRequired = query({
  args: {},
  handler: async ctx => {
    const clerkUserId = await getClerkUserId(ctx);
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', clerkUserId))
      .first();

    if (!profile) {
      return { required: false, reason: 'no_profile' };
    }

    // Only under_13 users require VPC
    if (profile.ageGroup !== 'under_13') {
      return { required: false, reason: 'not_under_13' };
    }

    // Check if consent has been granted
    if (profile.consentStatus === 'granted') {
      return { required: false, reason: 'consent_granted' };
    }

    // US-022: Check if consent renewal is required
    if (profile.consentStatus === 'renewal_required') {
      return {
        required: true,
        reason: 'renewal_required',
        consentStatus: profile.consentStatus,
      };
    }

    return {
      required: true,
      reason:
        profile.consentStatus === 'pending'
          ? 'consent_pending'
          : 'consent_needed',
      consentStatus: profile.consentStatus,
    };
  },
});

/**
 * Internal query: Look up a consent record by token.
 * Used by HTTP endpoints which cannot call public queries directly.
 */
export const getConsentRecordByToken = internalQuery({
  args: {
    consentToken: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('consentRecords')
      .withIndex('by_token', q => q.eq('consentToken', args.consentToken))
      .first();
  },
});

/**
 * Internal query: Get the latest pending consent record for a child user.
 * Used by getConsentUrl action to look up token server-side.
 */
export const getLatestPendingConsent = internalQuery({
  args: {
    childUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('consentRecords')
      .withIndex('by_child', q => q.eq('childUserId', args.childUserId))
      .order('desc')
      .first();
  },
});

/**
 * Internal mutation: Verify and grant consent.
 * Used by HTTP POST endpoint to process consent form submission.
 */
export const verifyAndGrantConsentInternal = internalMutation({
  args: {
    consentToken: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query('consentRecords')
      .withIndex('by_token', q => q.eq('consentToken', args.consentToken))
      .first();

    if (!record) {
      return { success: false, error: 'Invalid consent token.' };
    }

    if (record.status === 'granted') {
      return { success: true, alreadyGranted: true };
    }

    if (record.status !== 'pending') {
      return {
        success: false,
        error: 'This consent request is no longer active.',
      };
    }

    if (
      record.consentTokenExpiresAt &&
      Date.now() > record.consentTokenExpiresAt
    ) {
      await ctx.db.patch(record._id, { status: 'expired' });
      return { success: false, error: 'This consent link has expired.' };
    }

    // Grant consent
    const now = Date.now();
    await ctx.db.patch(record._id, {
      status: 'granted',
      consentTimestamp: now,
    });

    // Update child's profile consent status
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q =>
        q.eq('clerkUserId', record.childUserId),
      )
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        consentStatus: 'granted',
      });
    }

    return { success: true };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Submit a parent's email to initiate the VPC flow.
 * Creates a consent record with a unique token and sets the child's
 * consentStatus to "pending".
 *
 * @param parentEmail - The parent's email address
 * @returns The consent record ID and token expiry time
 */
export const submitParentEmail = mutation({
  args: {
    parentEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.parentEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    // Get user profile
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', clerkUserId))
      .first();

    if (!profile) {
      throw new Error('User profile not found.');
    }

    if (profile.ageGroup !== 'under_13') {
      throw new Error('Parental consent is only required for users under 13.');
    }

    // Check for existing pending consent — expire it if one exists
    const existingRecord = await ctx.db
      .query('consentRecords')
      .withIndex('by_child', q => q.eq('childUserId', clerkUserId))
      .order('desc')
      .first();

    if (existingRecord && existingRecord.status === 'pending') {
      await ctx.db.patch(existingRecord._id, { status: 'expired' });
    }

    // Generate a unique consent token (crypto-safe random via Convex)
    const token = generateConsentToken();
    const expiresAt = Date.now() + CONSENT_TOKEN_EXPIRY_MS;

    // Create the consent record
    const recordId = await ctx.db.insert('consentRecords', {
      childUserId: clerkUserId,
      parentEmail: args.parentEmail,
      consentType: 'vpc',
      consentVersion: CURRENT_PRIVACY_POLICY_VERSION,
      verificationMethod: 'email_plus',
      consentToken: token,
      consentTokenExpiresAt: expiresAt,
      status: 'pending',
    });

    // Update user profile consent status
    await ctx.db.patch(profile._id, {
      consentStatus: 'pending',
    });

    // S-2.7: Do not return consentToken to client — token only sent via email
    return {
      recordId,
      tokenExpiresAt: expiresAt,
    };
  },
});

/**
 * Verify a consent token and grant consent.
 * Called when the parent clicks "I Consent" on the consent web page.
 *
 * @param consentToken - The unique token from the consent email link
 * @returns Success status
 */
export const verifyAndGrantConsent = mutation({
  args: {
    consentToken: v.string(),
    parentEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up the consent record by token
    const record = await ctx.db
      .query('consentRecords')
      .withIndex('by_token', q => q.eq('consentToken', args.consentToken))
      .first();

    if (!record) {
      return { success: false, error: 'Invalid consent token.' };
    }

    if (record.status === 'granted') {
      return { success: true, alreadyGranted: true };
    }

    if (record.status !== 'pending') {
      return {
        success: false,
        error: 'This consent request is no longer active.',
      };
    }

    // S-2.6: Verify parent email matches the consent record
    if (record.parentEmail.toLowerCase() !== args.parentEmail.toLowerCase()) {
      return { success: false, error: 'Email verification failed.' };
    }

    // Check token expiration
    if (
      record.consentTokenExpiresAt &&
      Date.now() > record.consentTokenExpiresAt
    ) {
      await ctx.db.patch(record._id, { status: 'expired' });
      return {
        success: false,
        error:
          'This consent link has expired. Please request a new one from the app.',
      };
    }

    // Grant consent
    const now = Date.now();
    await ctx.db.patch(record._id, {
      status: 'granted',
      consentTimestamp: now,
    });

    // Update child's profile consent status
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q =>
        q.eq('clerkUserId', record.childUserId),
      )
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        consentStatus: 'granted',
      });
    }

    return { success: true };
  },
});

/**
 * Withdraw parental consent for a child account.
 * Disables the child account by setting consentStatus to "withdrawn".
 *
 * @param childUserId - The child's Clerk user ID
 */
export const withdrawConsent = mutation({
  args: {
    childUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Find the active consent record
    const record = await ctx.db
      .query('consentRecords')
      .withIndex('by_child', q => q.eq('childUserId', args.childUserId))
      .order('desc')
      .first();

    if (!record || record.status !== 'granted') {
      throw new Error('No active consent found for this user.');
    }

    // Mark consent as withdrawn
    await ctx.db.patch(record._id, {
      status: 'withdrawn',
      withdrawnAt: Date.now(),
    });

    // Update child's profile
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.childUserId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        consentStatus: 'withdrawn',
      });
    }

    return { success: true };
  },
});

/**
 * Clean up expired pending consent records and associated account data.
 * Should be called by a scheduled cron job.
 * Deletes pending accounts where consent was not granted within 48 hours.
 */
export const cleanupExpiredPendingConsent = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now();

    // Find all pending consent records that have expired
    const allRecords = await ctx.db.query('consentRecords').collect();

    const expiredRecords = allRecords.filter(
      r =>
        r.status === 'pending' &&
        r.consentTokenExpiresAt != null &&
        r.consentTokenExpiresAt < now,
    );

    let cleanedCount = 0;

    for (const record of expiredRecords) {
      // Mark consent as expired
      await ctx.db.patch(record._id, { status: 'expired' });

      // Find and delete the child's profile and associated data
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_clerk_user_id', q =>
          q.eq('clerkUserId', record.childUserId),
        )
        .first();

      if (profile && profile.consentStatus === 'pending') {
        // Delete game sessions
        const sessions = await ctx.db
          .query('gameSessions')
          .withIndex('by_clerk_user', q =>
            q.eq('clerkUserId', record.childUserId),
          )
          .collect();

        for (const session of sessions) {
          await ctx.db.delete(session._id);
        }

        // Delete the profile
        await ctx.db.delete(profile._id);
        cleanedCount++;
      }
    }

    return { cleanedCount, expiredCount: expiredRecords.length };
  },
});

/**
 * Record terms and privacy consent when a user accepts the checkbox during signup.
 * Creates two consent records: one for "terms" and one for "privacy".
 * These records are immediate (no email verification flow) and marked as "granted".
 *
 * @implements US-016: Persist Consent Records
 */
export const recordTermsConsent = mutation({
  args: {},
  handler: async (ctx, _args) => {
    const clerkUserId = await getClerkUserId(ctx);

    const now = Date.now();

    // Create consent records for both terms and privacy acceptance
    const consentTypes: Array<'terms' | 'privacy'> = ['terms', 'privacy'];
    const recordIds: string[] = [];

    for (const consentType of consentTypes) {
      // Check for existing granted record of this type to avoid duplicates
      const existing = await ctx.db
        .query('consentRecords')
        .withIndex('by_child', q => q.eq('childUserId', clerkUserId))
        .collect();

      const hasExisting = existing.some(
        r => r.consentType === consentType && r.status === 'granted',
      );

      if (!hasExisting) {
        const id = await ctx.db.insert('consentRecords', {
          childUserId: clerkUserId,
          parentEmail: '', // Not applicable for terms/privacy checkbox consent
          consentType,
          consentVersion: CURRENT_PRIVACY_POLICY_VERSION,
          consentTimestamp: now,
          verificationMethod: 'checkbox',
          status: 'granted',
        });
        recordIds.push(id);
      }
    }

    return { recorded: recordIds.length, recordIds };
  },
});

/**
 * Internal mutation to clean up consent records that are 3+ years old
 * after account deletion. COPPA requires retaining consent records for
 * 3 years after account deletion, after which they should be purged.
 *
 * @implements US-016: Consent record retention policy
 */
export const cleanupOldConsentRecords = internalMutation({
  args: {},
  handler: async ctx => {
    const threeYearsAgo = Date.now() - 3 * 365 * 24 * 60 * 60 * 1000;

    // Find consent records where account was deleted 3+ years ago
    const allRecords = await ctx.db.query('consentRecords').collect();

    const expiredRecords = allRecords.filter(
      r => r.accountDeletedAt && r.accountDeletedAt < threeYearsAgo,
    );

    let deletedCount = 0;
    for (const record of expiredRecords) {
      await ctx.db.delete(record._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});

// ============================================================================
// ANNUAL CONSENT RENEWAL (US-022)
// ============================================================================

/**
 * Check all granted VPC consent records for renewal eligibility.
 * Called by a daily cron job. For each granted VPC consent:
 * - If child has turned 13 (ageGroup no longer under_13), skip renewal and
 *   update their consent status to not_required.
 * - At 11 months post-consent: flag for reminder email (sets renewalReminderSentAt).
 * - At 12 months post-consent: set account to "renewal_required" state.
 *
 * Returns lists of users needing reminders and enforcement so the cron
 * can trigger email sending as a follow-up action.
 *
 * @implements US-022: Annual Parental Consent Renewal
 */
export const checkConsentRenewals = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now();

    // Find all granted VPC consent records
    const allRecords = await ctx.db.query('consentRecords').collect();

    const grantedVpcRecords = allRecords.filter(
      r =>
        r.status === 'granted' && r.consentType === 'vpc' && r.consentTimestamp,
    );

    const remindersNeeded: Array<{
      parentEmail: string;
      childUserId: string;
      childName: string;
    }> = [];
    let enforcedCount = 0;
    let agedOutCount = 0;

    for (const record of grantedVpcRecords) {
      const consentAge = now - (record.consentTimestamp as number);

      // Look up child profile to check current age group
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_clerk_user_id', q =>
          q.eq('clerkUserId', record.childUserId),
        )
        .first();

      if (!profile) continue;

      // Age-out check: if child has turned 13, renewal is not required
      if (profile.ageGroup !== 'under_13') {
        if (profile.consentStatus !== 'not_required') {
          await ctx.db.patch(profile._id, { consentStatus: 'not_required' });
        }
        agedOutCount++;
        continue;
      }

      // 12-month enforcement: enter renewal_required state
      if (consentAge >= RENEWAL_ENFORCE_MS) {
        await ctx.db.patch(record._id, { status: 'renewal_required' });
        await ctx.db.patch(profile._id, { consentStatus: 'renewal_required' });
        enforcedCount++;
        continue;
      }

      // 11-month reminder: send email if not already sent for this consent cycle
      if (consentAge >= RENEWAL_REMINDER_MS && !record.renewalReminderSentAt) {
        await ctx.db.patch(record._id, { renewalReminderSentAt: now });
        remindersNeeded.push({
          parentEmail: record.parentEmail,
          childUserId: record.childUserId,
          childName: profile.displayName ?? profile.username ?? 'your child',
        });
      }
    }

    return { remindersNeeded, enforcedCount, agedOutCount };
  },
});

/**
 * Initiate consent renewal for a child whose consent has expired.
 * Creates a new VPC consent record using the same Email Plus flow as US-002.
 * Called from the frontend when the parent clicks "Renew Consent".
 *
 * @implements US-022: Re-consent via Email Plus flow
 */
export const initiateConsentRenewal = mutation({
  args: {
    parentEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.parentEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    // Get user profile — must be under_13 with renewal_required status
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', clerkUserId))
      .first();

    if (!profile) {
      throw new Error('User profile not found.');
    }

    if (profile.ageGroup !== 'under_13') {
      throw new Error('Consent renewal is only required for users under 13.');
    }

    // Mark the old consent record as expired (it's being renewed)
    const existingRecord = await ctx.db
      .query('consentRecords')
      .withIndex('by_child', q => q.eq('childUserId', clerkUserId))
      .order('desc')
      .first();

    if (
      existingRecord &&
      (existingRecord.status === 'renewal_required' ||
        existingRecord.status === 'granted')
    ) {
      await ctx.db.patch(existingRecord._id, { status: 'expired' });
    }

    // Create a new consent record (same flow as submitParentEmail)
    const token = generateConsentToken();
    const expiresAt = Date.now() + CONSENT_TOKEN_EXPIRY_MS;

    const recordId = await ctx.db.insert('consentRecords', {
      childUserId: clerkUserId,
      parentEmail: args.parentEmail,
      consentType: 'vpc',
      consentVersion: CURRENT_PRIVACY_POLICY_VERSION,
      verificationMethod: 'email_plus',
      consentToken: token,
      consentTokenExpiresAt: expiresAt,
      status: 'pending',
    });

    // Update user profile to pending while renewal is in progress
    await ctx.db.patch(profile._id, {
      consentStatus: 'pending',
    });

    // S-2.7: Do not return consentToken to client — token only sent via email
    return {
      recordId,
      tokenExpiresAt: expiresAt,
    };
  },
});

// ============================================================================
// ACTIONS (for side effects like sending emails)
// ============================================================================

/**
 * Send the VPC consent email to the parent.
 * This is an action because it makes external HTTP calls.
 *
 * @param parentEmail - The parent's email address
 * @param consentToken - The unique consent verification token
 * @param childDisplayName - The child's display name (for email personalization)
 */
export const getConsentUrl = action({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }
    const clerkUserId = identity.subject;

    // Look up the user's latest pending consent record server-side
    const record: any = await ctx.runQuery(
      internal.consent.getLatestPendingConsent,
      { childUserId: clerkUserId },
    );

    if (!record || !record.consentToken) {
      throw new Error('No pending consent record found.');
    }

    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!siteUrl) {
      throw new Error(
        'CONVEX_SITE_URL environment variable is not configured.',
      );
    }
    return {
      consentUrl: `${siteUrl}/consent/verify?token=${record.consentToken}`,
      maskedEmail: record.parentEmail
        ? record.parentEmail.replace(/^(.{2}).*(@.*)$/, '$1***$2')
        : null,
    };
  },
});

export const sendConsentEmail = action({
  args: {
    parentEmail: v.string(),
    childDisplayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // S-2.7: Look up consent token server-side from authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }
    const clerkUserId = identity.subject;

    const record: any = await ctx.runQuery(
      internal.consent.getLatestPendingConsent,
      { childUserId: clerkUserId },
    );

    if (!record || !record.consentToken) {
      throw new Error('No pending consent record found.');
    }

    // Build consent verification URL
    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!siteUrl) {
      throw new Error(
        'CONVEX_SITE_URL environment variable is not configured. ' +
          'Set it to your Convex deployment URL (e.g., https://your-project.convex.site).',
      );
    }

    const consentUrl = `${siteUrl}/consent/verify?token=${record.consentToken}`;
    const childName = args.childDisplayName || 'your child';

    // Build email HTML
    const emailHtml = buildConsentEmailHtml(consentUrl, childName);
    const emailText = buildConsentEmailText(consentUrl, childName);

    // Send email via Resend API (recommended for transactional emails)
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      // Fallback: log the consent URL for development/testing
      console.log(`[VPC] Consent email would be sent to ${args.parentEmail}`);
      console.log(`[VPC] Consent URL: ${consentUrl}`);
      return {
        sent: false,
        consentUrl,
        reason: 'RESEND_API_KEY not configured',
      };
    }

    const fromAddress =
      process.env.CONSENT_EMAIL_FROM ||
      'CreativeBridge <onboarding@resend.dev>';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [args.parentEmail],
        subject: 'Parental Consent Required — CreativeBridge',
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // 403 = Resend domain not verified; fall back to share-based flow
      if (response.status === 403) {
        console.warn(
          `[VPC] Resend domain not verified. Verify a domain at resend.com/domains ` +
            `and set CONSENT_EMAIL_FROM env var. Details: ${errorText}`,
        );
        return { sent: false, consentUrl, reason: 'domain_not_verified' };
      }
      throw new Error(
        `Failed to send consent email: ${response.status} ${errorText}`,
      );
    }

    return { sent: true, consentUrl };
  },
});

/**
 * Send a consent renewal reminder email to the parent.
 * Called after checkConsentRenewals identifies records at 11 months.
 * Informs the parent that consent will expire soon and includes a
 * link to re-consent via the same Email Plus flow.
 *
 * @implements US-022: 11-month renewal reminder email
 */
export const sendRenewalReminderEmail = action({
  args: {
    parentEmail: v.string(),
    childDisplayName: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!siteUrl) {
      console.log(
        `[Renewal] CONVEX_SITE_URL not configured, skipping email to ${args.parentEmail}`,
      );
      return { sent: false, reason: 'CONVEX_SITE_URL not configured' };
    }

    const childName = args.childDisplayName || 'your child';
    const emailHtml = buildRenewalReminderEmailHtml(childName);
    const emailText = buildRenewalReminderEmailText(childName);

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.log(
        `[Renewal] Reminder email would be sent to ${args.parentEmail}`,
      );
      return { sent: false, reason: 'RESEND_API_KEY not configured' };
    }

    const fromAddress =
      process.env.CONSENT_EMAIL_FROM ||
      'CreativeBridge <onboarding@resend.dev>';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [args.parentEmail],
        subject: 'Consent Renewal Reminder — CreativeBridge',
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to send renewal reminder email: ${response.status} ${errorText}`,
      );
    }

    return { sent: true };
  },
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a cryptographically secure consent token.
 * Uses crypto.randomBytes for 256 bits of entropy, base64url-encoded.
 *
 * @implements C-06 remediation: Replace Math.random() with CSPRNG
 */
function generateConsentToken(): string {
  // 32 random bytes = 256 bits of entropy, base64url-encoded (URL-safe, no padding)
  return randomBytes(32).toString('base64url');
}

/**
 * Build the HTML email body for the VPC consent email.
 */
function buildConsentEmailHtml(consentUrl: string, childName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parental Consent — CreativeBridge</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #6C63FF; font-size: 24px;">CreativeBridge</h1>
    <p style="color: #666; font-size: 14px;">AI-Powered Educational Storytelling</p>
  </div>

  <h2 style="font-size: 20px;">Parental Consent Required</h2>

  <p>Hello,</p>

  <p>${childName} has signed up for CreativeBridge and indicated they are under 13 years old.
  Under the Children's Online Privacy Protection Act (COPPA), we need your consent before
  they can use the app.</p>

  <h3 style="font-size: 16px; margin-top: 24px;">What data we collect:</h3>
  <ul style="line-height: 1.8;">
    <li><strong>Account info:</strong> Username, display name, grade level preference</li>
    <li><strong>Story content:</strong> Stories your child creates within the app</li>
    <li><strong>Usage data:</strong> Game progress, XP points, streaks (anonymized)</li>
  </ul>

  <h3 style="font-size: 16px;">How we use this data:</h3>
  <ul style="line-height: 1.8;">
    <li>To generate age-appropriate AI story continuations (via OpenAI)</li>
    <li>To create story illustrations (via Replicate/Stable Diffusion)</li>
    <li>To track educational progress and gamification features</li>
  </ul>

  <h3 style="font-size: 16px;">Your rights as a parent:</h3>
  <ul style="line-height: 1.8;">
    <li>Review all data collected about your child</li>
    <li>Request deletion of your child's data at any time</li>
    <li>Withdraw this consent at any time (which will disable the account)</li>
  </ul>

  <h3 style="font-size: 16px;">Third-party services:</h3>
  <p>We share limited data with: OpenAI (story generation), Replicate (image generation),
  Clerk (authentication), and Convex (database). All services are bound by data processing
  agreements that prohibit using your child's data for training or profiling.</p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${consentUrl}"
       style="display: inline-block; background-color: #6C63FF; color: white; padding: 14px 32px;
              text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
      I Consent
    </a>
  </div>

  <p style="color: #999; font-size: 12px;">This link expires in 48 hours. If you did not expect
  this email or do not wish to provide consent, simply ignore it — no account will be created.</p>

  <p style="color: #999; font-size: 12px;">If you have questions, contact us at
  support@creativebridge.app</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #999; font-size: 11px; text-align: center;">
    CreativeBridge &mdash; AI-Powered Educational Storytelling for K-12
  </p>
</body>
</html>`;
}

/**
 * Build the plain-text email body for the VPC consent email.
 */
function buildConsentEmailText(consentUrl: string, childName: string): string {
  return `
Parental Consent Required — CreativeBridge

Hello,

${childName} has signed up for CreativeBridge and indicated they are under 13 years old. Under the Children's Online Privacy Protection Act (COPPA), we need your consent before they can use the app.

WHAT DATA WE COLLECT:
- Account info: Username, display name, grade level preference
- Story content: Stories your child creates within the app
- Usage data: Game progress, XP points, streaks (anonymized)

HOW WE USE THIS DATA:
- To generate age-appropriate AI story continuations (via OpenAI)
- To create story illustrations (via Replicate/Stable Diffusion)
- To track educational progress and gamification features

YOUR RIGHTS AS A PARENT:
- Review all data collected about your child
- Request deletion of your child's data at any time
- Withdraw this consent at any time (which will disable the account)

THIRD-PARTY SERVICES:
We share limited data with: OpenAI (story generation), Replicate (image generation), Clerk (authentication), and Convex (database). All services are bound by data processing agreements.

To provide consent, visit this link:
${consentUrl}

This link expires in 48 hours. If you did not expect this email, simply ignore it.

Questions? Contact support@creativebridge.app

---
CreativeBridge — AI-Powered Educational Storytelling for K-12
`.trim();
}

// ============================================================================
// RENEWAL EMAIL BUILDERS (US-022)
// ============================================================================

/**
 * Build HTML email for the 11-month consent renewal reminder.
 * This is a heads-up email — no consent link. The parent will receive
 * the actual re-consent email when the account enters renewal_required state.
 */
function buildRenewalReminderEmailHtml(childName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Consent Renewal Reminder — CreativeBridge</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #6C63FF; font-size: 24px;">CreativeBridge</h1>
    <p style="color: #666; font-size: 14px;">AI-Powered Educational Storytelling</p>
  </div>

  <h2 style="font-size: 20px;">Consent Renewal Reminder</h2>

  <p>Hello,</p>

  <p>Your parental consent for <strong>${childName}</strong> to use CreativeBridge will expire in
  approximately <strong>one month</strong>.</p>

  <p>Under the Children's Online Privacy Protection Act (COPPA), we are required to re-verify
  your consent annually. When the consent expires, ${childName}'s account will be temporarily
  limited until you re-confirm consent.</p>

  <h3 style="font-size: 16px;">What you need to do:</h3>
  <ul style="line-height: 1.8;">
    <li>No action needed right now — this is just a heads-up</li>
    <li>When consent expires, ${childName} will see a prompt in the app to request renewal</li>
    <li>You will receive a new consent email with a verification link at that time</li>
    <li>Simply click the link to renew consent and restore full access</li>
  </ul>

  <h3 style="font-size: 16px;">Your ongoing rights:</h3>
  <ul style="line-height: 1.8;">
    <li>Review all data collected about your child at any time</li>
    <li>Request deletion of your child's data</li>
    <li>Withdraw consent (which will disable the account)</li>
  </ul>

  <p style="color: #999; font-size: 12px;">If you have questions or wish to withdraw consent
  before renewal, contact us at support@creativebridge.app</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #999; font-size: 11px; text-align: center;">
    CreativeBridge &mdash; AI-Powered Educational Storytelling for K-12
  </p>
</body>
</html>`;
}

/**
 * Build plain-text email for the 11-month consent renewal reminder.
 */
function buildRenewalReminderEmailText(childName: string): string {
  return `
Consent Renewal Reminder — CreativeBridge

Hello,

Your parental consent for ${childName} to use CreativeBridge will expire in approximately one month.

Under COPPA, we are required to re-verify your consent annually. When the consent expires, ${childName}'s account will be temporarily limited until you re-confirm consent.

WHAT YOU NEED TO DO:
- No action needed right now — this is just a heads-up
- When consent expires, ${childName} will see a prompt in the app to request renewal
- You will receive a new consent email with a verification link at that time
- Simply click the link to renew consent and restore full access

YOUR ONGOING RIGHTS:
- Review all data collected about your child at any time
- Request deletion of your child's data
- Withdraw consent (which will disable the account)

Questions? Contact support@creativebridge.app

---
CreativeBridge — AI-Powered Educational Storytelling for K-12
`.trim();
}

// ============================================================================
// PARENTAL DASHBOARD (US-021)
// ============================================================================

/**
 * Get all data needed for the Parental Dashboard.
 * Returns child profile info, story count, consent status, and recent stories.
 *
 * @implements US-021: Parental Dashboard
 */
export const getParentalDashboardData = query({
  args: {},
  handler: async ctx => {
    const clerkUserId = await getClerkUserId(ctx);

    // Get user profile
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', clerkUserId))
      .first();

    if (!profile) {
      return null;
    }

    // Get consent record
    const consentRecord = await ctx.db
      .query('consentRecords')
      .withIndex('by_child', q => q.eq('childUserId', clerkUserId))
      .order('desc')
      .first();

    // Get all game sessions for story count and review
    const sessions = await ctx.db
      .query('gameSessions')
      .withIndex('by_clerk_user', q => q.eq('clerkUserId', clerkUserId))
      .order('desc')
      .collect();

    const storySummaries = sessions.map(s => ({
      id: s._id,
      gradeLevel: s.gradeLevel,
      storySource: s.storySource,
      wordsWritten: s.wordsWritten,
      completedAt: s.completedAt ?? null,
      createdAt: s._creationTime,
      contentPreview: s.storyContent
        ? s.storyContent.substring(0, 120) +
          (s.storyContent.length > 120 ? '...' : '')
        : null,
    }));

    return {
      profile: {
        displayName: profile.displayName ?? profile.username ?? 'Unknown',
        gradeLevel: profile.preferredGradeLevel ?? 'K-2',
        ageGroup: profile.ageGroup ?? null,
        createdAt: profile._creationTime,
      },
      consent: consentRecord
        ? {
            status: consentRecord.status,
            parentEmail: consentRecord.parentEmail,
            consentTimestamp: consentRecord.consentTimestamp ?? null,
            consentVersion: consentRecord.consentVersion,
          }
        : null,
      storyCount: sessions.length,
      stories: storySummaries,
    };
  },
});

/**
 * Export all child data as a JSON-serializable object.
 * Parents can request this under COPPA to review all data collected.
 *
 * @implements US-021: Full data export for parental review
 */
export const exportChildData = query({
  args: {},
  handler: async ctx => {
    const clerkUserId = await getClerkUserId(ctx);

    // Profile
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', clerkUserId))
      .first();

    if (!profile) {
      return null;
    }

    // Consent records
    const consentRecords = await ctx.db
      .query('consentRecords')
      .withIndex('by_child', q => q.eq('childUserId', clerkUserId))
      .collect();

    // Game sessions
    const sessions = await ctx.db
      .query('gameSessions')
      .withIndex('by_clerk_user', q => q.eq('clerkUserId', clerkUserId))
      .collect();

    // Story elements for each session
    const storyElements = [];
    for (const session of sessions) {
      const elements = await ctx.db
        .query('storyElements')
        .withIndex('by_story', q => q.eq('storyId', session._id))
        .collect();
      storyElements.push(...elements);
    }

    // Download history
    const downloads = await ctx.db
      .query('storyDownloadHistory')
      .withIndex('by_clerk_user', q => q.eq('clerkUserId', clerkUserId))
      .collect();

    return {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      profile: {
        displayName: profile.displayName,
        username: profile.username,
        preferredGradeLevel: profile.preferredGradeLevel,
        ageGroup: profile.ageGroup,
        totalXp: profile.totalXp,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        totalGamesPlayed: profile.totalGamesPlayed,
        totalStoriesCompleted: profile.totalStoriesCompleted,
        totalWordsWritten: profile.totalWordsWritten,
        createdAt: profile._creationTime,
      },
      consentHistory: consentRecords.map(r => ({
        type: r.consentType,
        status: r.status,
        version: r.consentVersion,
        timestamp: r.consentTimestamp,
        parentEmail: r.parentEmail,
        method: r.verificationMethod,
      })),
      stories: sessions.map(s => ({
        id: s._id,
        gradeLevel: s.gradeLevel,
        storySource: s.storySource,
        storyContent: s.storyContent ?? null,
        wordsWritten: s.wordsWritten,
        finalScore: s.finalScore,
        xpEarned: s.xpEarned,
        completedAt: s.completedAt ?? null,
        createdAt: s._creationTime,
      })),
      storyElements: storyElements.map(e => ({
        storyId: e.storyId,
        elementType: e.elementType,
        elementText: e.elementText,
        createdAt: e._creationTime,
      })),
      downloadHistory: downloads.map(d => ({
        storySessionId: d.storySessionId ?? null,
        fileName: d.fileName,
        downloadMethod: d.downloadMethod,
        createdAt: d._creationTime,
      })),
    };
  },
});
