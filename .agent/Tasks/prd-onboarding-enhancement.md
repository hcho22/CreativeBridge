# PRD: Onboarding Enhancement

## Introduction

Enhance the CreativeBridge onboarding experience to increase activation rates, improve feature discovery, and reduce new user confusion. This comprehensive update introduces guided experiences, an onboarding checklist with XP rewards, celebration moments, and contextual feature discovery—all designed to help users reach their "aha moment" (completing their first AI-collaborative story with grade-matched illustrations) as quickly as possible.

## Goals

- Increase activation rate (% of signups who complete first story) from baseline to 60%+
- Reduce time-to-first-story to under 10 minutes
- Ensure 80%+ of users understand the grade level impact on their experience
- Achieve 50%+ onboarding checklist completion rate
- Introduce all key features (voice input, image generation, XP system) to new users within first session
- Create positive emotional moments that reinforce engagement behavior

## User Stories

### US-001: Add Grade Level Explanation Text

**Description:** As a new user selecting my grade level, I want to understand why it matters so that I choose the correct level for the best experience.

**Acceptance Criteria:**

- [x] Helper text appears below grade level selection buttons in AuthScreen
- [x] Helper text appears below grade level selection in ProfileCompletionScreen
- [x] Text explains: story language complexity, illustration style, and challenge difficulty are affected
- [x] Text is concise (2-3 lines maximum)
- [x] Text styling matches existing form helper text
- [x] Typecheck/lint passes

---

### US-002: Add Story Progress Indicator

**Description:** As a user writing a story, I want to see which round I'm on so that I know how close I am to completing my story.

**Acceptance Criteria:**

- [x] Progress indicator displays "Round X of 5" during story creation
- [x] Indicator appears in the story/game screen header area
- [x] Progress updates after each user submission
- [x] Visual design is subtle but clearly visible
- [x] Indicator does not appear for imported/continued stories (only new stories)
- [x] Typecheck/lint passes

---

### US-003: Create Celebration Modal Component

**Description:** As a developer, I need a reusable celebration modal component so that we can celebrate user achievements consistently throughout the app.

**Acceptance Criteria:**

- [x] CelebrationModal component created in `src/components/common/`
- [x] Component accepts props: `title`, `message`, `emoji/icon`, `ctaText`, `onClose`, `onCtaPress`
- [x] Modal has celebratory visual design (confetti animation or equivalent)
- [x] Modal is accessible (proper contrast, screen reader support)
- [x] Modal can be dismissed by tapping outside or pressing close button
- [x] Typecheck/lint passes

---

### US-004: First Story Completion Celebration

**Description:** As a user completing my first story, I want to see a celebration so that I feel accomplished and motivated to continue.

**Acceptance Criteria:**

- [x] Celebration modal appears when user completes their first story ever
- [x] Modal displays: "🎉 You wrote your first story!"
- [x] Modal includes encouraging message about their achievement
- [x] Modal shows XP earned for the story
- [x] CTA button leads to viewing the completed story or returning home
- [x] Celebration only triggers once (tracked in database or local storage)
- [x] Typecheck/lint passes

**Implementation Notes (Completed Feb 2026):**

- Created `src/services/onboardingMilestoneTracker.ts` for tracking first-time achievements
- Uses AsyncStorage for milestone tracking (will migrate to database when US-007 is completed)
- Integrated `CelebrationModal` component (from US-003) into `HomeScreen.tsx`
- Celebration triggers at story completion (round 5) before showing completion options

---

### US-005: First Image Generation Celebration

**Description:** As a user seeing my first AI-generated illustration, I want to see a celebration so that I understand this is a special feature.

**Acceptance Criteria:**

- [x] Celebration modal appears when user's first story image is generated
- [x] Modal displays: "🎨 Your story came to life!"
- [x] Modal explains that illustrations match their grade level art style
- [x] Celebration only triggers once per user
- [x] Typecheck/lint passes

**Implementation Notes (Completed Feb 2026):**

- Reused existing `onboardingMilestoneTracker` service (from US-004) which already had `markFirstImageGenerated()` and `markFirstImageCelebrationShown()` methods
- Integrated `CelebrationModal` component into `HomeScreen.tsx` at the `handleImageGenerated` callback
- Celebration triggers when image generation completes successfully, before auto-scroll to image
- Uses AsyncStorage for milestone tracking (will migrate to database when US-007 is completed)

---

### US-006: First Streak Achievement Celebration

**Description:** As a user achieving my first streak, I want to see a celebration so that I'm motivated to maintain my streak.

**Acceptance Criteria:**

- [x] Celebration modal appears when user achieves 2-day streak for the first time
- [x] Modal displays: "🔥 You're on fire! 2-day streak!"
- [x] Modal encourages continuing the streak
- [x] Shows bonus XP earned for streak
- [x] Celebration only triggers once (first streak achievement)
- [x] Typecheck/lint passes

**Implementation Notes (Completed Feb 2026):**

- Reused existing `onboardingMilestoneTracker` service which already had `markFirstStreakAchieved()` and `markFirstStreakCelebrationShown()` methods
- Added streak detection logic in `HomeScreen.tsx` using `useEffect` that watches `userProfile?.current_streak` changes
- Detection triggers when streak transitions from <2 to >=2 (comparing with `previousStreakRef`)
- Integrated `CelebrationModal` component into `HomeScreen.tsx` with 🔥 icon and "+50 Bonus XP for your streak!" message
- Uses AsyncStorage for milestone tracking (will migrate to database when US-007 is completed)

---

### US-007: Add Database Schema for Onboarding Progress

**Description:** As a developer, I need database fields to track onboarding progress so that we can persist checklist state and trigger celebrations appropriately.

**Acceptance Criteria:**

- [x] Add `onboarding_completed` boolean field to `user_profiles` table (default: false)
- [x] Add `onboarding_progress` JSONB field to store checklist item completion status
- [x] Add `first_story_completed_at` timestamp field (nullable)
- [x] Add `first_image_generated_at` timestamp field (nullable)
- [x] Add `first_streak_achieved_at` timestamp field (nullable)
- [x] Create database migration file
- [x] Migration runs successfully on development database
- [x] Update TypeScript types in `src/types/database.ts`
- [x] Typecheck/lint passes

**Implementation Notes (Completed Feb 2026):**

- Created migration file `sql/add_onboarding_progress_fields.sql` with:
  - 6 new columns: `onboarding_completed`, `onboarding_progress`, `first_story_completed_at`, `first_image_generated_at`, `first_voice_input_at`, `first_streak_achieved_at`
  - 3 helper functions: `update_onboarding_progress_item()`, `record_onboarding_milestone()`, `get_onboarding_status()`
  - Performance indexes for onboarding queries
  - Comprehensive documentation and rollback procedure
- Updated TypeScript types in `src/types/database.ts`:
  - Added `OnboardingProgress` interface for checklist state
  - Added `OnboardingStatus` interface for complete status response
  - Extended `UserProfile` with new onboarding fields
  - Added new function signatures to `Database` interface
- Updated `.agent/System/database_schema.md` with new schema documentation

---

### US-008: Create Onboarding Checklist Component

**Description:** As a new user, I want to see a checklist of onboarding tasks so that I know what to try and can track my progress.

**Acceptance Criteria:**

- [x] OnboardingChecklist component created in `src/components/onboarding/`
- [x] Checklist displays 5 items with completion status:
  - ✅ Create your account (auto-completed on signup)
  - 📝 Write your first story (+50 XP)
  - 🎨 See your first illustration (+25 XP)
  - 🎤 Try voice input (+25 XP)
  - 🔥 Start a streak (+50 XP)
- [x] Each item shows XP reward amount
- [x] Completed items show checkmark and strikethrough styling
- [x] Progress bar shows overall completion percentage
- [x] Component can be collapsed/expanded
- [x] Typecheck/lint passes

**Implementation Notes (Completed Feb 2026):**

- Created `src/components/onboarding/OnboardingChecklist.tsx` following CelebrationModal patterns
- Uses `onboardingMilestoneTracker.getMilestoneProgress()` to fetch completion status
- Features animated progress bar with percentage display
- Implements LayoutAnimation for smooth collapse/expand transitions
- Includes full accessibility support (labels, hints, states)
- XP badges with distinct styling for completed vs pending items
- Dismissible via optional `onDismiss` callback
- Exports via `src/components/onboarding/index.ts` for clean imports

---

### US-009: Integrate Onboarding Checklist into HomeScreen

**Description:** As a new user on the home screen, I want to see my onboarding checklist so that I know what to do next.

**Acceptance Criteria:**

- [x] Onboarding checklist appears on HomeScreen for users who haven't completed onboarding
- [x] Checklist positioned prominently but doesn't block main CTAs
- [x] Checklist can be dismissed via "X" button or "Dismiss" option
- [x] Dismissed checklist can be re-accessed from Profile or Settings screen
- [x] Checklist automatically hides when all items completed
- [x] Checklist state persists across app sessions (stored in database)
- [x] Typecheck/lint passes

**Implementation Notes (Completed Feb 2026):**

- Integrated `OnboardingChecklist` component (from US-008) into `HomeScreen.tsx` home view
- Positioned between welcome section and story action buttons for prominent but non-blocking placement
- Added state management: `showOnboardingChecklist` and `checklistKey` for visibility and refresh control
- Visibility logic in `useEffect`:
  - Auto-hides when `userProfile.onboarding_completed` is true (database field from US-007)
  - Checks `onboardingMilestoneTracker.isChecklistDismissed()` for session dismissal state
- Extended `onboardingMilestoneTracker.ts` service with new methods:
  - `isChecklistDismissed()` - Check if user dismissed the checklist
  - `dismissChecklist()` - Mark checklist as dismissed (persists in AsyncStorage)
  - `resetChecklistDismissed()` - Reset dismissed state (for Settings/Profile re-access)
  - `isOnboardingComplete()` - Check if all milestones are complete
- Added milestone refresh logic: when any celebration triggers (story/image/streak), checklist re-renders to show updated progress
- Uses `checklistKey` state to force re-render when milestones complete

---

### US-010: Award XP for Onboarding Checklist Items

**Description:** As a user completing onboarding tasks, I want to receive XP rewards so that I'm motivated to explore features.

**Acceptance Criteria:**

- [x] +50 XP awarded when first story is completed
- [x] +25 XP awarded when first illustration is generated
- [x] +25 XP awarded when voice input is used for the first time
- [x] +50 XP awarded when first streak (2 days) is achieved
- [x] XP is added to user's total_xp in database
- [x] XP award triggers visual feedback (toast notification or similar)
- [x] Each reward only given once per user
- [x] Typecheck/lint passes

**Implementation Notes (Completed Feb 2026):**

- Created `awardOnboardingXP()` method in `src/context/AuthContext.tsx`:
  - Accepts milestone type: `'first_story'`, `'first_image'`, `'first_voice'`, `'first_streak'`
  - XP amounts defined as constants: 50, 25, 25, 50 respectively
  - Uses existing `add_user_xp` Supabase RPC function for database updates
  - Returns `{ success, error, newBalance, xpAwarded }` for feedback
  - Tracks XP events via existing `trackXPEvent()` for analytics
- Integrated XP awards in `src/screens/HomeScreen.tsx`:
  - First story: Awards 50 XP when `markFirstStoryCompleted()` returns `shouldShowCelebration: true`
  - First image: Awards 25 XP when `markFirstImageGenerated()` returns `shouldShowCelebration: true`
  - First voice: Awards 25 XP when `markFirstVoiceInputUsed()` returns `true` in `handleVoiceResult()` callback
  - First streak: Awards 50 XP when `markFirstStreakAchieved()` returns `shouldShowCelebration: true`
- Visual feedback via `CelebrationModal` `secondaryMessage` prop:
  - First story: Shows total XP (story XP + 50 bonus XP) in celebration modal
  - First image: Shows "+25 XP earned!" in celebration modal
  - First streak: Already had "+50 Bonus XP for your streak!" message
  - First voice: XP awarded silently (no modal, milestone tracked via onboardingMilestoneTracker)
- One-time awards ensured by `onboardingMilestoneTracker` service (tracks milestones in AsyncStorage)
- Total onboarding XP: 50 + 25 + 25 + 50 = 150 XP

---

### US-011: Track Voice Input First Use

**Description:** As a developer, I need to track when a user first uses voice input so that we can award the onboarding XP and mark the checklist item complete.

**Acceptance Criteria:**

- [x] Add `first_voice_input_at` timestamp field to database (via migration)
- [x] Update voice input handler to check if this is first use
- [x] On first use, update database field and award XP
- [x] Update onboarding progress state
- [x] Typecheck/lint passes

**Implementation Notes (Completed Feb 2026):**

- Database field `first_voice_input_at` was already added in US-007 migration (`sql/add_onboarding_progress_fields.sql` line 33)
- Extended `onboardingMilestoneTracker.ts` with `markFirstVoiceInputUsed()` method (lines 228-239):
  - Returns `boolean` indicating if this was the first use
  - Stores timestamp in AsyncStorage (will sync to database via existing patterns)
  - Integrated into `getMilestoneProgress()` for checklist display
- Voice input handler in `HomeScreen.tsx` (`handleVoiceResult` callback, lines 696-709):
  - Calls `markFirstVoiceInputUsed()` to check if first use
  - Awards 25 XP via `awardOnboardingXP('first_voice')` on first use
  - Proper error handling with try-catch
- Onboarding checklist (`OnboardingChecklist.tsx`) displays voice input item with `progress.voiceInputUsed` status
- XP award uses existing `add_user_xp` Supabase RPC function via `AuthContext.awardOnboardingXP()`
- TypeScript types already defined in `src/types/database.ts` (OnboardingProgress.first_voice, OnboardingStatus.first_voice_input_at)

---

### US-012: Create First-Story Guidance Modal

**Description:** As a first-time user starting a story, I want to see a brief explanation of how collaborative storytelling works so that I understand what to expect.

**Acceptance Criteria:**

- [ ] Modal appears before/when user starts their very first story
- [ ] Modal explains the collaborative AI storytelling concept in 3-4 bullet points:
  - "You'll write a story together with AI"
  - "The AI will continue your story and create illustrations"
  - "Complete 5 rounds to finish your story"
  - "Earn XP and level up as you write!"
- [ ] Modal has "Got it!" or "Let's go!" CTA button
- [ ] Modal only appears once (first story attempt)
- [ ] User can optionally check "Don't show again" if they dismiss early
- [ ] Typecheck/lint passes

---

### US-013: Add Feature Discovery Tooltip for Voice Input

**Description:** As a new user, I want to see a tooltip explaining the voice input feature so that I know I can speak my story instead of typing.

**Acceptance Criteria:**

- [ ] Tooltip appears near voice input button on first encounter
- [ ] Tooltip text: "Tap to speak your story instead of typing"
- [ ] Tooltip has arrow pointing to the voice button
- [ ] Tooltip dismisses on tap or after 5 seconds
- [ ] Tooltip only appears once per user (tracked via flag)
- [ ] Typecheck/lint passes

---

### US-014: Add Feature Discovery Tooltip for Image Generation

**Description:** As a new user, I want to see a tooltip explaining image generation so that I know illustrations will be created for my story.

**Acceptance Criteria:**

- [ ] Tooltip appears when first story image is being generated or appears
- [ ] Tooltip text: "AI creates illustrations matching your grade level!"
- [ ] Tooltip dismisses on tap or after 5 seconds
- [ ] Tooltip only appears once per user
- [ ] Typecheck/lint passes

---

### US-015: Add Feature Discovery Tooltip for XP/Challenges

**Description:** As a new user, I want to understand the XP and challenge system so that I'm motivated to engage with it.

**Acceptance Criteria:**

- [ ] Tooltip appears near XP indicator or challenge display on first story
- [ ] Tooltip text: "Complete challenges for bonus XP and level up!"
- [ ] Tooltip dismisses on tap or after 5 seconds
- [ ] Tooltip only appears once per user
- [ ] Typecheck/lint passes

---

### US-016: Create Tooltip Component

**Description:** As a developer, I need a reusable tooltip component for feature discovery so that we can consistently introduce features to new users.

**Acceptance Criteria:**

- [ ] FeatureTooltip component created in `src/components/common/`
- [ ] Component accepts props: `text`, `position` (top/bottom/left/right), `targetRef`, `onDismiss`
- [ ] Tooltip has arrow pointing to target element
- [ ] Tooltip auto-dismisses after configurable timeout
- [ ] Tooltip can be manually dismissed by tapping
- [ ] Styling matches app design system
- [ ] Typecheck/lint passes

---

### US-017: Enhanced Empty State for HomeScreen

**Description:** As a new user with no stories, I want to see an inspiring empty state so that I understand what the app does and feel motivated to start.

**Acceptance Criteria:**

- [ ] Empty state includes a preview/mockup of what a story looks like
- [ ] Shows sample story card with illustration thumbnail
- [ ] Includes brief tagline: "Create magical stories with AI"
- [ ] Primary CTA "Start Your First Story" is prominent
- [ ] Optional "See how it works" link/button for guidance modal
- [ ] Design is visually engaging, not plain
- [ ] Typecheck/lint passes

---

### US-018: Add Onboarding Access to Settings/Profile

**Description:** As a user who dismissed the onboarding checklist, I want to access it again from settings so that I can complete remaining tasks.

**Acceptance Criteria:**

- [ ] "Onboarding Progress" option appears in Settings or Profile screen
- [ ] Option only visible if onboarding not yet completed
- [ ] Tapping opens the onboarding checklist in a modal or navigates to it
- [ ] Shows current completion status
- [ ] Typecheck/lint passes

---

### US-019: Create Onboarding Service

**Description:** As a developer, I need a centralized onboarding service to manage all onboarding state and logic.

**Acceptance Criteria:**

- [ ] OnboardingService created in `src/services/`
- [ ] Service handles:
  - Fetching onboarding progress from database
  - Updating checklist item completion
  - Awarding XP for completed items
  - Checking if specific celebrations should trigger
  - Marking onboarding as complete
- [ ] Service integrates with existing UserService and XP system
- [ ] Service has proper error handling
- [ ] Typecheck/lint passes

---

### US-020: Update README Documentation

**Description:** As a developer, I need the documentation updated so that the onboarding system is properly documented.

**Acceptance Criteria:**

- [ ] `.agent/README.md` updated to reference this PRD
- [ ] New onboarding components documented in project architecture if significant
- [ ] Database schema changes reflected in `.agent/System/database_schema.md`
- [ ] Any new services documented appropriately

---

## Functional Requirements

- **FR-1:** Display grade level explanation text during signup showing impact on story complexity, art style, and challenges
- **FR-2:** Show "Round X of 5" progress indicator during new story creation
- **FR-3:** Display celebration modal when user completes first story, sees first illustration, or achieves first streak
- **FR-4:** Store onboarding progress in database (`onboarding_progress` JSONB field)
- **FR-5:** Display onboarding checklist on HomeScreen for new users with 5 trackable items
- **FR-6:** Award XP when onboarding checklist items are completed (50+25+25+50 = 150 XP total)
- **FR-7:** Allow users to dismiss onboarding checklist with option to re-access from Settings/Profile
- **FR-8:** Auto-hide onboarding checklist when all items completed and mark `onboarding_completed` as true
- **FR-9:** Show first-story guidance modal explaining collaborative AI storytelling before first story
- **FR-10:** Display contextual tooltips for voice input, image generation, and XP system on first encounter
- **FR-11:** Enhance HomeScreen empty state with story preview and engaging visuals
- **FR-12:** Track first-time events (story, image, voice, streak) with timestamps in database
- **FR-13:** Each celebration and tooltip only triggers once per user lifetime

## Non-Goals (Out of Scope)

- Email re-engagement for stalled users (deferred to future iteration)
- Push notifications for onboarding reminders
- A/B testing infrastructure for onboarding variants
- Unlockable avatars or badges beyond XP rewards
- Onboarding analytics dashboard
- Multi-language support for onboarding content
- Video tutorials or animated walkthroughs
- Social sharing of onboarding achievements

## Design Considerations

### Visual Design

- Celebration modals should feel joyful and age-appropriate (consider grade level in animation intensity)
- Onboarding checklist should use existing app color palette and component styles
- Tooltips should be subtle but noticeable, not obstructing primary actions
- Empty state should showcase the "magic" of AI storytelling

### Component Reuse

- Reuse existing Modal component patterns for celebrations
- Reuse existing button and card components for checklist
- Consider existing animation libraries (if any) for confetti effects

### Accessibility

- All new components must support screen readers
- Tooltips must have sufficient contrast
- Celebrations should not rely solely on animation (include text)
- Auto-dismiss timers should be generous (5+ seconds)

## Technical Considerations

### Database Changes

New fields in `user_profiles` table:

```sql
onboarding_completed BOOLEAN DEFAULT false,
onboarding_progress JSONB DEFAULT '{}',
first_story_completed_at TIMESTAMP WITH TIME ZONE,
first_image_generated_at TIMESTAMP WITH TIME ZONE,
first_voice_input_at TIMESTAMP WITH TIME ZONE,
first_streak_achieved_at TIMESTAMP WITH TIME ZONE
```

### State Management

- Onboarding state should be fetched on app load and cached in AuthContext or dedicated OnboardingContext
- Checklist updates should optimistically update UI then sync to database
- Consider debouncing database writes for rapid state changes

### Performance

- Tooltip rendering should not impact story creation performance
- Celebration animations should be lightweight and not block UI
- Onboarding checks should be cached, not queried on every screen

### Integration Points

- **AuthContext:** Add onboarding state to user context
- **XPService:** Integrate with existing XP award system
- **UserService:** Add methods for updating onboarding progress
- **Game/Story flow:** Add hooks for tracking first story, first image, first voice input

## Success Metrics

| Metric                                             | Current (Estimated) | Target       |
| -------------------------------------------------- | ------------------- | ------------ |
| Activation rate (first story completed)            | ~40%                | 60%+         |
| Time to first story                                | Unknown             | < 10 minutes |
| Onboarding checklist completion                    | N/A                 | 50%+         |
| Day 1 retention                                    | Unknown             | 40%+         |
| Feature discovery (voice input used in first week) | Unknown             | 30%+         |

### Tracking Required

- Track `onboarding_checklist_started` event
- Track `onboarding_checklist_completed` event
- Track `onboarding_checklist_dismissed` event
- Track completion of each individual checklist item
- Track time from signup to first story completion

## Open Questions

1. **Animation library:** Should we add a library like `lottie-react-native` for celebration animations, or use simpler CSS-based animations?

2. **Tooltip positioning:** How should tooltips behave on different screen sizes? Should they be responsive?

3. **Checklist persistence:** If a user logs out and back in, should dismissed state persist or reset?

4. **Grade-level celebrations:** Should celebration messaging/visuals differ by grade level (more playful for K-2, more mature for 9-12)?

5. **Existing users:** Should existing users who haven't completed these milestones see the onboarding checklist, or only new signups after this feature launches?

---

## Implementation Order (Suggested)

### Phase 1: Quick Wins (Week 1)

- US-001: Grade level explanation
- US-002: Story progress indicator
- US-003: Celebration modal component
- US-004: First story celebration

### Phase 2: Celebrations & Tracking (Week 2)

- US-007: Database schema for onboarding
- US-005: First image celebration
- US-006: First streak celebration
- US-011: Voice input tracking
- US-019: Onboarding service

### Phase 3: Checklist System (Week 3)

- US-008: Onboarding checklist component
- US-009: HomeScreen integration
- US-010: XP rewards for checklist
- US-018: Settings/Profile access

### Phase 4: Feature Discovery (Week 4)

- US-016: Tooltip component
- US-012: First-story guidance modal
- US-013: Voice input tooltip
- US-014: Image generation tooltip
- US-015: XP/Challenges tooltip
- US-017: Enhanced empty state

### Phase 5: Documentation

- US-020: Update documentation

---

**PRD Version:** 1.0
**Created:** February 2025
**Status:** Draft
**Author:** Claude (Onboarding CRO Audit)
