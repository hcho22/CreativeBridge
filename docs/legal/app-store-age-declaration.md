# App Store Age Declaration Guide (US-023)

This document specifies the exact App Store Connect configuration for CreativeBridge's age rating, content descriptors, and metadata declarations.

## Decision Summary

| Setting                 | Value            | Rationale                                                                                                                   |
| ----------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Age Rating**          | **12+**          | Grade 9-12 content includes mature themes (complex emotions, moral dilemmas, sophisticated narratives) handled thoughtfully |
| **Apple Kids Category** | **Not declared** | Per Option B: full K-12 range retained, General App Store submission                                                        |
| **Primary Category**    | Education        | Core purpose is educational storytelling                                                                                    |
| **Secondary Category**  | Books            | Story creation and reading                                                                                                  |

## Age Rating Questionnaire (App Store Connect)

Answer the following in App Store Connect > App Information > Age Rating:

| Question                                         | Answer              | Notes                                                                                         |
| ------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------- |
| Cartoon or Fantasy Violence                      | None                | Content blocklist filters all violence terms                                                  |
| Realistic Violence                               | None                | Blocked by `contentBlocklist.ts` violence category                                            |
| Prolonged Graphic or Sadistic Realistic Violence | None                | Blocked                                                                                       |
| Profanity or Crude Humor                         | None                | Blocked by profanity category in content blocklist                                            |
| Mature/Suggestive Themes                         | **Infrequent/Mild** | Grade 9-12 uses "sophisticated" and "mature themes handled thoughtfully" in prompt generation |
| Horror/Fear Themes                               | None                | Not present in any grade level                                                                |
| Medical/Treatment Information                    | None                | Not applicable                                                                                |
| Alcohol, Tobacco, or Drug Use or References      | None                | Blocked by substances category in content blocklist                                           |
| Simulated Gambling                               | None                | XP system is earned, not gambled                                                              |
| Sexual Content or Nudity                         | None                | Blocked by sexual_content category                                                            |
| Graphic Sexual Content and Nudity                | None                | Blocked                                                                                       |
| Unrestricted Web Access                          | No                  | App does not include a web browser                                                            |
| Gambling with Real Currency                      | No                  | No in-app purchases or real currency                                                          |

**Resulting Rating: 12+** (driven by Infrequent/Mild Mature/Suggestive Themes)

## Content Descriptors

The App Store listing will display:

- **Infrequent/Mild Mature/Suggestive Themes**

This is accurate because:

1. Grade 9-12 content (`enhancedPromptGenerator.ts`) uses descriptors like "mature themes handled thoughtfully," "sophisticated conceptual abstraction," and "complex storytelling with mature themes"
2. All explicit content is blocked by the content safety service (`contentSafetyService.ts`) and blocklist (`contentBlocklist.ts`)
3. The themes are educational in nature (moral dilemmas, emotional complexity, literary analysis)

## App Description Requirements

The App Store description **must** include:

1. **Target audience statement:** "Designed for students in grades K-12 (ages 5-18)"
2. **COPPA compliance statement:** "COPPA compliant: Verifiable Parental Consent required for users under 13"
3. **Safety features:** "Content safety filters actively monitor all AI-generated content"
4. **No ads statement:** "No behavioral advertising or third-party ad networks"
5. **Privacy link:** Link to the full privacy policy

See `store.config.json` in the project root for the full description text ready for EAS Metadata.

## Category Configuration

- **Primary:** Education
- **Secondary:** Books
- **Kids Category:** NOT selected (per Option B decision — the app serves K-12, not exclusively under-13)

### Why Not Kids Category?

Per the COPPA compliance audit (Option B):

- Kids Category apps must target children exclusively and comply with stricter Apple guidelines
- CreativeBridge serves grades K-12 (ages 5-18), including young adults
- Grade 9-12 content with mature themes is incompatible with Kids Category restrictions
- COPPA protections are implemented independently of Apple Kids Category

## App Review Notes

Include the following in the App Store Connect review notes to help Apple reviewers:

> CreativeBridge is an educational storytelling app for K-12 students. For users under 13, verifiable parental consent (COPPA Email Plus method) is required before the child can access AI-generated content. Grade 9-12 content includes age-appropriate themes for young adults (e.g., complex emotions, moral dilemmas) but all content passes through automated safety filters that block explicit material. The app does NOT target the Apple Kids Category -- it serves the full K-12 age range with appropriate safeguards for younger users.

## Automation

The `store.config.json` file in the project root contains all these declarations in EAS Metadata format. To push to App Store Connect:

```bash
eas metadata:push
```

This will update the age rating, content descriptors, categories, and description text automatically.

## Verification Checklist

Before each App Store submission, verify:

- [ ] Age rating questionnaire completed in App Store Connect (or via `eas metadata:push`)
- [ ] "Mature/Suggestive Themes: Infrequent/Mild" is the only non-None content descriptor
- [ ] App description includes target audience (K-12 / ages 5-18) and COPPA language
- [ ] Kids Category is NOT selected
- [ ] Privacy policy URL is set and accessible
- [ ] Review notes explain the age range and COPPA compliance approach
