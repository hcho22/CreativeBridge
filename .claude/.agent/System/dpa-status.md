# Data Processing Agreement (DPA) Status

**Last Updated:** 2026-03-24
**Owner:** App Operator
**Audit Reference:** `audits/coppa-audit-2026-03-23.md`
**PRD Reference:** US-006 in `Tasks/prd-coppa-compliance.md`

---

## Overview

COPPA requires that operators take "reasonable measures" to ensure third-party service providers handling children's data maintain confidentiality, security, and integrity of that data. Data Processing Agreements (DPAs) formalize these obligations contractually.

CreativeBridge transmits children's data to five third-party services. Each must have a signed DPA specifying:

1. Data types shared
2. Purpose limitation
3. Prohibition on using children's data for training/profiling
4. Deletion obligations
5. Breach notification requirements

---

## DPA Status by Vendor

### 1. OpenAI

| Field                    | Details                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Service**              | GPT-4 API (story generation)                                                                                                                                                                             |
| **Data Shared**          | Story content text (PII-scrubbed before transmission)                                                                                                                                                    |
| **Purpose**              | AI-powered story continuation for educational storytelling                                                                                                                                               |
| **DPA Status**           | ACTION REQUIRED                                                                                                                                                                                          |
| **DPA Available**        | OpenAI offers a standard DPA via their Trust Portal (https://trust.openai.com/)                                                                                                                          |
| **Steps to Execute**     | 1. Sign in to OpenAI platform settings. 2. Navigate to Data Processing Addendum. 3. Review and countersign the DPA. 4. Download signed copy for records.                                                 |
| **Training Opt-Out**     | Verify organization-level setting: API data is NOT used for training by default (per OpenAI API Data Usage Policy, verified 2026-03-24). Pursue Zero Data Retention (ZDR) if available. See also US-017. |
| **Deletion Obligations** | OpenAI retains API data for up to 30 days for abuse monitoring, then deletes. ZDR would reduce to zero.                                                                                                  |
| **Breach Notification**  | Covered in OpenAI's standard DPA.                                                                                                                                                                        |
| **Date Executed**        | --                                                                                                                                                                                                       |
| **Expiration**           | --                                                                                                                                                                                                       |

---

### 2. Replicate

| Field                    | Details                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Service**              | Stable Diffusion 3.5 API (image generation)                                                                                                                                                              |
| **Data Shared**          | Image generation prompts derived from story content (PII-scrubbed before transmission)                                                                                                                   |
| **Purpose**              | AI-powered illustration generation for educational storytelling                                                                                                                                          |
| **DPA Status**           | ACTION REQUIRED                                                                                                                                                                                          |
| **DPA Available**        | Replicate offers a DPA upon request via their legal/sales team.                                                                                                                                          |
| **Steps to Execute**     | 1. Contact Replicate support or legal team (support@replicate.com). 2. Request their standard DPA for COPPA-covered applications. 3. Review, negotiate if needed, and countersign. 4. Store signed copy. |
| **Training Opt-Out**     | Confirm Replicate does not use customer API inputs for model training. Document their current policy.                                                                                                    |
| **Deletion Obligations** | Confirm data retention period for API inputs/outputs and request minimization.                                                                                                                           |
| **Breach Notification**  | Must be included in DPA terms.                                                                                                                                                                           |
| **Date Executed**        | --                                                                                                                                                                                                       |
| **Expiration**           | --                                                                                                                                                                                                       |

---

### 3. Clerk

| Field                      | Details                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Service**                | Authentication (OAuth via Google/Apple)                                                                                                                                                                                                    |
| **Data Shared**            | Email addresses, OAuth profile data (name, avatar), authentication tokens, session data                                                                                                                                                    |
| **Purpose**                | User authentication and identity management                                                                                                                                                                                                |
| **DPA Status**             | ACTION REQUIRED                                                                                                                                                                                                                            |
| **DPA Available**          | Clerk offers a DPA as part of their compliance documentation (https://clerk.com/legal/dpa).                                                                                                                                                |
| **Steps to Execute**       | 1. Review Clerk's standard DPA at their legal page. 2. If on a paid plan, DPA may be auto-accepted via dashboard. 3. For free tier, contact Clerk support to request DPA execution. 4. Store signed copy.                                  |
| **Special Considerations** | Clerk processes email and OAuth profile data which includes real names. For under-13 users, the app prevents auto-population of real names into display names (US-010), but Clerk still processes the OAuth data. The DPA must cover this. |
| **Deletion Obligations**   | Clerk must delete user data when the app operator deletes a user via the Clerk API (used in US-004).                                                                                                                                       |
| **Breach Notification**    | Covered in Clerk's standard DPA.                                                                                                                                                                                                           |
| **Date Executed**          | --                                                                                                                                                                                                                                         |
| **Expiration**             | --                                                                                                                                                                                                                                         |

---

### 4. Convex

| Field                      | Details                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Service**                | Real-time database, backend functions, file storage                                                                                                                                  |
| **Data Shared**            | User profiles, story content, game statistics, generated images, consent records, onboarding data                                                                                    |
| **Purpose**                | Primary backend database and real-time data sync for the application                                                                                                                 |
| **DPA Status**             | ACTION REQUIRED                                                                                                                                                                      |
| **DPA Available**          | Convex offers a DPA for paid plans. Contact sales/legal for details.                                                                                                                 |
| **Steps to Execute**       | 1. Contact Convex team (via dashboard or support). 2. Request DPA for a COPPA-covered children's application. 3. Review, negotiate if needed, and countersign. 4. Store signed copy. |
| **Special Considerations** | Convex stores the most comprehensive set of children's data including consent records. DPA must explicitly cover data retention obligations and cascading deletion support.          |
| **Deletion Obligations**   | Convex must support complete data deletion when triggered by the app's `deleteAllUserData` mutation (US-004).                                                                        |
| **Breach Notification**    | Must be included in DPA terms.                                                                                                                                                       |
| **Date Executed**          | --                                                                                                                                                                                   |
| **Expiration**             | --                                                                                                                                                                                   |

---

### 5. Supabase

| Field                      | Details                                                                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Service**                | Legacy database (PostgreSQL), anonymized analytics                                                                                                                                                              |
| **Data Shared**            | Legacy user profiles (migrated accounts), anonymized analytics events, migration event logs                                                                                                                     |
| **Purpose**                | Legacy data storage for pre-migration users; anonymized analytics collection                                                                                                                                    |
| **DPA Status**             | ACTION REQUIRED                                                                                                                                                                                                 |
| **DPA Available**          | Supabase offers a standard DPA (https://supabase.com/legal/dpa).                                                                                                                                                |
| **Steps to Execute**       | 1. Review Supabase's DPA at their legal page. 2. Accept via dashboard (Pro plan) or request via support (free tier). 3. Store signed copy.                                                                      |
| **Special Considerations** | Supabase holds legacy user data including email addresses in migration events. The `migrationEvents` table emails are scrubbed after 30 days (US-015). Analytics data uses anonymized/hashed user IDs (US-013). |
| **Deletion Obligations**   | Supabase must support data deletion for the legacy cleanup process (US-004, US-015).                                                                                                                            |
| **Breach Notification**    | Covered in Supabase's standard DPA.                                                                                                                                                                             |
| **Date Executed**          | --                                                                                                                                                                                                              |
| **Expiration**             | --                                                                                                                                                                                                              |

---

## Required DPA Provisions (All Vendors)

Each executed DPA must include the following provisions per COPPA requirements:

1. **Data Types Shared** - Explicit enumeration of all personal information categories transmitted
2. **Purpose Limitation** - Data may only be used to provide the contracted service to CreativeBridge
3. **Prohibition on Secondary Use** - Vendor may not use children's data for training, profiling, advertising, or any purpose beyond service delivery
4. **Deletion Obligations** - Vendor must delete data upon operator request and upon contract termination
5. **Breach Notification** - Vendor must notify operator within 72 hours of any data breach affecting children's data
6. **Subprocessor Restrictions** - Vendor must disclose subprocessors and ensure they meet the same obligations
7. **Audit Rights** - Operator retains the right to audit vendor compliance with DPA terms

---

## Execution Timeline

| Vendor    | Target Execution Date          | Priority                           |
| --------- | ------------------------------ | ---------------------------------- |
| OpenAI    | Within 30 days of PRD approval | Critical (transmits story content) |
| Replicate | Within 30 days of PRD approval | Critical (transmits image prompts) |
| Clerk     | Within 30 days of PRD approval | Critical (processes auth data)     |
| Convex    | Within 45 days of PRD approval | Critical (stores all primary data) |
| Supabase  | Within 60 days of PRD approval | High (legacy data, analytics)      |

---

## Maintenance

- Review all DPAs annually or when vendor terms change
- Update this document when DPAs are executed, renewed, or modified
- Store signed DPA copies in a secure, access-controlled location (not in the git repository)
- Reference this document during COPPA compliance audits
