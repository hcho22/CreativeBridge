# AI Data Policies & Training Opt-Out

**Last Updated:** 2026-03-24
**Owner:** App Operator
**PRD Reference:** US-017 in `Tasks/prd-coppa-compliance.md`
**Related:** `.agent/System/dpa-status.md` (DPA execution status)

---

## Overview

CreativeBridge transmits children's story content to AI services. COPPA requires that operators ensure third-party providers do not use children's data for secondary purposes, including model training or profiling. This document tracks the data usage policies and opt-out status for each AI provider.

---

## 1. OpenAI (GPT-4 / Moderation API)

### API Data Usage Policy (Verified 2026-03-24)

Per OpenAI's current [API Data Usage Policy](https://openai.com/enterprise-privacy):

- **API inputs and outputs are NOT used for model training** by default for API customers.
- OpenAI may retain API data for up to **30 days** for abuse and misuse monitoring, after which it is deleted.
- This policy applies to all API usage through the standard `api.openai.com` endpoint.

**Policy Source:** OpenAI Enterprise Privacy page and API Terms of Use, last verified 2026-03-24.

### Organization Header (Implemented)

All OpenAI API calls from CreativeBridge now include the `OpenAI-Organization` header (via `getOpenAIHeaders()` in `src/config/environment.ts`). This ensures:

- API requests are attributed to the correct organization
- Organization-level settings (data policies, rate limits, billing) are applied
- Any organization-level opt-outs or restrictions are enforced

**Configuration:** Set `OPENAI_ORG_ID` environment variable to the organization ID from [OpenAI Platform Settings](https://platform.openai.com/account/organization).

### Zero Data Retention (ZDR) Status

| Item                            | Status                                                                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ZDR Availability**            | OpenAI offers Zero Data Retention for eligible API customers. ZDR eliminates the 30-day abuse-monitoring retention window.                                                                                                                                              |
| **ZDR Eligibility**             | Typically requires an Enterprise agreement or specific qualification. Check with OpenAI sales.                                                                                                                                                                          |
| **CreativeBridge ZDR Status**   | ACTION REQUIRED - Operator should contact OpenAI to request ZDR for this organization, citing COPPA requirements for a children's application.                                                                                                                          |
| **Steps to Pursue**             | 1. Contact OpenAI sales/support via the platform dashboard. 2. Request ZDR agreement for the organization, referencing COPPA compliance needs. 3. If approved, verify ZDR is active in organization settings. 4. Update this document with execution date.              |
| **Fallback if ZDR Unavailable** | The default 30-day retention for abuse monitoring is acceptable under COPPA when combined with: (a) PII scrubbing before transmission (US-008), (b) an executed DPA (US-006), and (c) the default no-training policy. Document this rationale for compliance reviewers. |

### Implementation Details

- **PII Scrubbing:** All story content is scrubbed of PII before transmission to OpenAI (US-008, `src/services/piiScrubber.ts`)
- **Organization Header:** `OpenAI-Organization` header included in all API calls (US-017, `src/config/environment.ts:getOpenAIHeaders()`)
- **API Endpoints Used:**
  - `POST /v1/chat/completions` — story generation and image prompt analysis
  - `POST /v1/moderations` — image content safety moderation (US-007)

---

## 2. Replicate (Stable Diffusion 3.5)

### API Data Usage Policy (Verified 2026-03-24)

Per Replicate's current Terms of Service:

- Replicate states that customer inputs/outputs are not used for training models operated by Replicate.
- Model authors on Replicate may have their own data policies; however, Stability AI's Stable Diffusion models accessed via Replicate are served by Replicate's infrastructure and subject to Replicate's data handling terms.
- Confirm specific retention periods via DPA negotiation (US-006).

**Policy Source:** Replicate Terms of Service, last verified 2026-03-24.

### Implementation Details

- **PII Scrubbing:** Image prompts are scrubbed of PII before transmission (US-008, `src/services/imageGeneration.ts`)
- **Data Transmitted:** Only text prompts derived from story content; no user identifiers or profile data are sent to Replicate.

---

## Verification Schedule

| Task                                           | Frequency                | Next Due   |
| ---------------------------------------------- | ------------------------ | ---------- |
| Re-verify OpenAI API data usage policy         | Every 6 months           | 2026-09-24 |
| Re-verify Replicate data usage policy          | Every 6 months           | 2026-09-24 |
| Check OpenAI ZDR eligibility/status            | Quarterly until obtained | 2026-06-24 |
| Confirm org-level settings in OpenAI dashboard | Quarterly                | 2026-06-24 |

---

## Compliance Rationale

Even without ZDR, CreativeBridge's approach to AI data safety is defensible under COPPA because:

1. **No PII reaches AI providers** — Client-side PII scrubbing (US-008) removes personal information before any API call
2. **No training on children's data** — OpenAI's default API policy prohibits using API data for training
3. **Organization attribution** — The `OpenAI-Organization` header ensures org-level policies apply
4. **Limited retention** — OpenAI's 30-day abuse monitoring retention is the minimum required for safety, and data is deleted afterward
5. **DPA coverage** — Once executed (US-006), the DPA contractually prohibits secondary use of children's data
6. **Prompt sanitization** — Prompt injection protection (US-011) prevents children from inadvertently transmitting sensitive data through manipulated prompts
