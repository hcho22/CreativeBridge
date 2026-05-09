# CreativeBridge Privacy Policy

**Effective Date:** [INSERT DATE]
**Last Updated:** [INSERT DATE]
**Version:** 1.0

---

## Introduction

CreativeBridge ("we," "us," or "our") is an AI-powered educational storytelling application designed for students in grades K-12 (approximately ages 5-18). We are committed to protecting the privacy of all users, especially children under 13. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you use the CreativeBridge application ("App").

This Privacy Policy complies with the Children's Online Privacy Protection Act ("COPPA") and is designed to inform parents and guardians about our data practices concerning children under 13.

**Operator Contact Information:**

- Name: [INSERT OPERATOR NAME]
- Email: [INSERT CONTACT EMAIL]
- Address: [INSERT MAILING ADDRESS]

---

## Information We Collect

### Information Collected from All Users

| Data Type               | How Collected                         | Purpose                                                            |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| Email address           | Sign-up (OAuth or email registration) | Account creation, authentication, communication                    |
| Display name / username | User input during profile creation    | In-app identification                                              |
| Grade level preference  | User selection                        | Personalizing story content, vocabulary, art style, and difficulty |
| Story content           | User-authored text                    | AI-assisted story continuation and image generation                |
| Game statistics         | App-generated (XP, streaks, scores)   | Gamification features                                              |
| Onboarding progress     | App-generated                         | Tracking tutorial completion                                       |

<!-- DRAFT FOR LEGAL REDLINE — H01 audit, see .claude/.agent/Tasks/H01-coppa-audit.md. Subject to legal review; do NOT publish without sign-off. -->

| Voice / audio recording | Microphone (when user taps voice input) — only while actively recording | Transcribing spoken story input into text; audio is not retained after transcription completes |

<!-- END DRAFT -->

### Information Collected Automatically

| Data Type                     | Purpose                                    |
| ----------------------------- | ------------------------------------------ |
| Analytics events (anonymized) | Understanding aggregate app usage patterns |
| App performance data          | Improving app stability and performance    |

### Information NOT Collected

- We do **not** collect precise geolocation data.
- We do **not** collect contact lists or address books.
- We do **not** collect photos or videos from your device (camera/gallery access is for saving generated illustrations only).
- We do **not** collect persistent device identifiers from children.
<!-- DRAFT FOR LEGAL REDLINE — H01 audit. The bullets below describe operational guarantees; legal must verify each claim is enforceable before publishing (e.g., OpenAI Whisper retention policy, our DPA terms, what "deleted after transcription" means in practice). -->
- We do **not** retain voice/audio recordings after transcription. Audio is sent to OpenAI Whisper, transcribed to text, and the audio is not stored on our servers.
- We do **not** use voice/audio recordings for AI model training. (Per our agreement with OpenAI, transmitted audio is not used to train Whisper or any other model.)
- We do **not** use voice biometrics to identify or authenticate users.
<!-- END DRAFT -->

---

## How We Use Information

We use the information we collect to:

1. **Provide the App's core features:** Generate AI-assisted stories and illustrations personalized to the user's grade level.
2. **Authenticate users:** Verify identity and maintain account security.
3. **Personalize content:** Adapt story vocabulary, illustration style, and challenge difficulty based on grade level.
4. **Improve the App:** Analyze aggregate, anonymized usage patterns to improve features and performance.
5. **Communicate:** Send account-related notifications (e.g., parental consent requests, password resets).

We do **not** use children's personal information for behavioral advertising, profiling, or any purpose unrelated to the App's educational function.

---

## Third-Party Services

We use the following third-party services to operate the App. We have executed Data Processing Agreements (DPAs) with each service to ensure they handle data in compliance with COPPA.

| Service            | Purpose                                 | Data Shared                                                     |
| ------------------ | --------------------------------------- | --------------------------------------------------------------- |
| **Clerk**          | Authentication (OAuth via Google/Apple) | Email, OAuth profile data, authentication tokens                |
| **Convex**         | Primary database and real-time backend  | User profiles, story content, game statistics, generated images |
| **OpenAI** (GPT-4) | AI-powered story generation             | Story content text (PII-scrubbed before transmission)           |

<!-- DRAFT FOR LEGAL REDLINE — H01 audit. Note: voice audio cannot be PII-scrubbed (the speaker's voice is itself biometric data). Legal must confirm DPA with OpenAI covers Whisper specifically and matches the no-training claim above. -->

| **OpenAI** (Whisper) | Cloud-based speech-to-text transcription of voice input | Raw audio recordings (m4a/aac/webm) — sent only while user is actively dictating; not retained after transcription |

<!-- END DRAFT -->

| **Replicate** (Stable Diffusion) | AI-powered illustration generation | Image generation prompts derived from story content (PII-scrubbed) |
| **Supabase** | Legacy database (for migrated accounts), anonymized analytics | Anonymized analytics events |

**Important:** Story content sent to OpenAI and Replicate is processed through a PII scrubber that removes personal information (names, emails, phone numbers, addresses) before transmission. We have opted out of OpenAI using transmitted data for model training.

Each third-party service is contractually prohibited from:

- Using children's data for their own purposes
- Using children's data for model training or profiling
- Retaining children's data beyond what is necessary to provide the service

---

## Children's Privacy (COPPA Compliance)

We take the privacy of children under 13 very seriously. The following protections apply specifically to users identified as under 13:

### Age Verification

- All users must provide their age or date of birth during the sign-up process.
- Users identified as under 13 are subject to additional protections.

### Verifiable Parental Consent (VPC)

- Before a child under 13 can use the App, we require verifiable parental consent using the "Email Plus" method.
- A parent or guardian must provide their email address and confirm consent via a unique, time-limited link.
- The child's account remains in a "pending" state (no data collection, no AI features) until consent is confirmed.

### Parental Rights

Parents and guardians of children under 13 have the right to:

1. **Review** their child's personal information by accessing the Parental Dashboard within the App.
2. **Request deletion** of all their child's data (see "Data Deletion" below).
3. **Withdraw consent** at any time, which will disable the child's account.
4. **Refuse further collection** of their child's information.

To exercise these rights, parents may:

- Use the Parental Dashboard within the App (accessible via a parental gate)
- Contact us at [INSERT CONTACT EMAIL]

We will respond to all parental requests within 48 hours.

### Additional Protections for Children Under 13

- Real names from OAuth providers are **not** auto-populated into display names.
- All external links require a parental gate (age-appropriate verification) before opening.
- Content is filtered through safety moderation to prevent exposure to inappropriate material.

<!-- DRAFT FOR LEGAL REDLINE — H01 audit. This subsection introduces voice handling specifically for under-13 accounts. Open questions for legal:
  1. Does the existing VPC ("Email Plus" method) cover voice/audio collection, or does the addition of voice as a new data type require renewed VPC under §312.5?
  2. For existing under-13 accounts (consented before voice was added): do we need a re-consent flow before they can continue using voice input?
  3. Should voice input be disabled by default for under-13 and require an opt-in tied to parental consent? (Path C in the audit.)
  4. Retroactive: if children have already had voice audio captured under the current cloud setup, what's the notification + retention review obligation?
-->

### Voice and Audio Data (Children Under 13)

When a child under 13 uses voice input:

- The microphone activates **only while the child is actively pressing/holding the voice input button**. We do not background-record.
- Audio is transmitted over an encrypted connection to OpenAI Whisper for transcription, then converted to text.
- The audio file is **not retained** by us after transcription completes.
- Voice/audio data is included as a category in the data types covered by parental consent. _[Legal: confirm whether existing consents cover this addition or require a re-consent flow per §312.5.]_
- A parent or guardian may withdraw consent for voice input specifically, in which case the child will use text-only input. _[Legal: confirm whether granular per-feature consent withdrawal is required, or whether withdrawing all consent is the only option.]_
<!-- END DRAFT -->

---

## Data Retention

We retain data for the following periods:

| Data Type      | Retention Period         |
| -------------- | ------------------------ |
| Story sessions | 1 year after last access |

<!-- DRAFT FOR LEGAL REDLINE — H01 audit. "Not retained" claim must match the actual implementation in convex/ai.ts:403 transcribeAudio (today: audio is sent to OpenAI per-request, not persisted to our DB; legal should confirm OpenAI's own retention is acceptable). -->

| Voice / audio recording | Not retained after transcription completes (single-request) |

<!-- END DRAFT -->

| Analytics events | 90 days |
| Image generation events | 90 days |
| Migration events | 30 days |
| Consent records | 3 years after account deletion (COPPA requirement) |
| Deleted account data | Purged immediately upon deletion |

Automated cleanup processes run daily to enforce these retention periods.

---

## Data Deletion

### In-App Deletion

Users (or parents of children under 13) can request complete account and data deletion through the "Delete Account & Data" option in App Settings. Deletion removes all data from:

- Convex (profiles, stories, images, game data, onboarding progress)
- Supabase (legacy data, analytics events)
- Clerk (authentication account)
- Convex Storage (generated images)

### Parent-Initiated Deletion

Parents may also request deletion by contacting us at [INSERT CONTACT EMAIL]. We will fulfill deletion requests within 48 hours.

Deletion is irreversible. A confirmation step is required before proceeding.

---

## Data Security

We implement reasonable security measures to protect personal information:

- Authentication via industry-standard OAuth 2.0 (Clerk)
- Sensitive data stored on-device is encrypted using secure storage
- PII scrubbing before data transmission to AI services
- Content safety moderation on AI-generated content
- Prompt injection protection on AI interactions
- Row-level security policies on database access

---

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. When we make material changes, we will:

1. Update the "Last Updated" date at the top of this document.
2. Notify parents of children under 13 via the email address on file.
3. Require re-consent from parents if changes affect how children's data is collected or used.

The current version of this Privacy Policy is always available within the App and at the URL listed below.

---

## Contact Us

If you have questions about this Privacy Policy, our data practices, or wish to exercise your parental rights under COPPA, please contact us:

- **Email:** [INSERT CONTACT EMAIL]
- **Mailing Address:** [INSERT MAILING ADDRESS]

---

## Hosted URL

This Privacy Policy is available at: https://creativebridge.app/privacy-policy
