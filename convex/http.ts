/**
 * Convex HTTP Router for CreativeBridge (US-002)
 *
 * Serves HTTP endpoints for features that require direct web access,
 * such as the parental consent verification page.
 *
 * These endpoints are accessible at your CONVEX_SITE_URL (e.g., https://your-project.convex.site).
 *
 * @see https://docs.convex.dev/functions/http-actions
 * @implements US-002: VPC consent verification web page
 */

import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

/**
 * GET /consent/verify?token=<consentToken>
 *
 * Renders the consent verification web page. The parent lands here after
 * clicking the link in the consent email. Shows data collection practices
 * and an "I Consent" button.
 */
http.route({
  path: '/consent/verify',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(buildErrorPage('Missing consent token.'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Look up the consent record to check status
    const record = await ctx.runQuery(
      internal.consent.getConsentRecordByToken,
      {
        consentToken: token,
      },
    );

    if (!record) {
      return new Response(
        buildErrorPage(
          'This consent link is invalid or has already been used.',
        ),
        { status: 404, headers: { 'Content-Type': 'text/html' } },
      );
    }

    if (record.status === 'granted') {
      return new Response(buildSuccessPage(), {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (record.status !== 'pending') {
      return new Response(
        buildErrorPage(
          'This consent request is no longer active. Please request a new one from the app.',
        ),
        { status: 410, headers: { 'Content-Type': 'text/html' } },
      );
    }

    if (
      record.consentTokenExpiresAt &&
      Date.now() > record.consentTokenExpiresAt
    ) {
      return new Response(
        buildErrorPage(
          'This consent link has expired. Please request a new one from the app.',
        ),
        { status: 410, headers: { 'Content-Type': 'text/html' } },
      );
    }

    // Render the consent form page
    return new Response(buildConsentPage(token), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }),
});

/**
 * POST /consent/verify
 *
 * Processes the consent form submission. Called when the parent clicks
 * "I Consent" on the consent page.
 */
http.route({
  path: '/consent/verify',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const token = params.get('token');

    if (!token) {
      return new Response(buildErrorPage('Missing consent token.'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Verify and grant consent
    const result = await ctx.runMutation(
      internal.consent.verifyAndGrantConsentInternal,
      {
        consentToken: token,
      },
    );

    if (!result.success) {
      return new Response(
        buildErrorPage(result.error || 'Failed to process consent.'),
        { status: 400, headers: { 'Content-Type': 'text/html' } },
      );
    }

    return new Response(buildSuccessPage(), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }),
});

export default http;

// ============================================================================
// HTML PAGE BUILDERS
// ============================================================================

function buildConsentPage(token: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parental Consent — CreativeBridge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      max-width: 600px;
      width: 100%;
      padding: 40px;
      margin-top: 20px;
      align-self: flex-start;
    }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo h1 { color: #6C63FF; font-size: 28px; }
    .logo p { color: #888; font-size: 14px; }
    h2 { font-size: 22px; margin-bottom: 16px; color: #1a1a1a; }
    h3 { font-size: 16px; margin: 20px 0 8px; color: #333; }
    p { line-height: 1.6; color: #555; margin-bottom: 12px; }
    ul { margin: 0 0 16px 24px; line-height: 1.8; color: #555; }
    .consent-form { text-align: center; margin-top: 32px; }
    .consent-btn {
      background: #6C63FF;
      color: white;
      border: none;
      padding: 16px 40px;
      border-radius: 10px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .consent-btn:hover { background: #5A52E0; }
    .consent-btn:active { background: #4840C0; }
    .note { color: #999; font-size: 12px; margin-top: 16px; }
    .divider { border: none; border-top: 1px solid #eee; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>CreativeBridge</h1>
      <p>AI-Powered Educational Storytelling</p>
    </div>

    <h2>Parental Consent Verification</h2>

    <p>Your child has signed up for CreativeBridge and indicated they are under 13 years old.
    Under the Children's Online Privacy Protection Act (COPPA), we need your verified consent
    before they can use the app.</p>

    <h3>Data We Collect</h3>
    <ul>
      <li><strong>Account info:</strong> Username, display name, grade level</li>
      <li><strong>Story content:</strong> Stories your child creates</li>
      <li><strong>Progress data:</strong> XP, streaks, games played (anonymized)</li>
    </ul>

    <h3>How We Use This Data</h3>
    <ul>
      <li>Generate age-appropriate AI story continuations</li>
      <li>Create story illustrations</li>
      <li>Track educational progress and gamification</li>
    </ul>

    <h3>Third-Party Services</h3>
    <p>We share limited, necessary data with: OpenAI (story AI), Replicate (image AI),
    Clerk (authentication), and Convex (database). Each is bound by data processing
    agreements prohibiting use of children's data for training or profiling.</p>

    <h3>Your Rights</h3>
    <ul>
      <li>Review all data collected about your child</li>
      <li>Request full deletion of your child's data at any time</li>
      <li>Withdraw consent at any time (disables the account)</li>
      <li>Contact us: support@creativebridge.app</li>
    </ul>

    <hr class="divider">

    <form class="consent-form" method="POST" action="/consent/verify">
      <input type="hidden" name="token" value="${token}">
      <p style="margin-bottom: 16px; color: #333;">
        By clicking below, you verify that you are the parent or legal guardian
        and you consent to the data practices described above.
      </p>
      <button type="submit" class="consent-btn">I Consent</button>
      <p class="note">This link expires 48 hours after it was sent.</p>
    </form>
  </div>
</body>
</html>`;
}

function buildSuccessPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Consent Confirmed — CreativeBridge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      max-width: 500px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .check { font-size: 64px; margin-bottom: 16px; }
    h1 { color: #16a34a; font-size: 24px; margin-bottom: 12px; }
    p { color: #555; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="check">&#10003;</div>
    <h1>Consent Confirmed</h1>
    <p>Thank you! Your child's CreativeBridge account is now active.
    They can open the app and start creating stories.</p>
    <p style="margin-top: 16px; color: #888; font-size: 14px;">
      You can withdraw consent at any time by contacting support@creativebridge.app
      or through the app's parental controls.
    </p>
  </div>
</body>
</html>`;
}

function buildErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error — CreativeBridge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      max-width: 500px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #dc2626; font-size: 22px; margin-bottom: 12px; }
    p { color: #555; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#9888;</div>
    <h1>Something went wrong</h1>
    <p>${message}</p>
    <p style="margin-top: 16px; color: #888; font-size: 14px;">
      If you need help, contact support@creativebridge.app
    </p>
  </div>
</body>
</html>`;
}
