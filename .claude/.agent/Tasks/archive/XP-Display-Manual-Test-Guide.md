# Manual Testing Guide: Story Completion XP Display (US-003)

**Feature:** XP Earned and Total XP display on story completion modal
**User Story:** US-003 - Handle Edge Cases Gracefully
**Test Date:** **\*\***\_**\*\***
**Tester:** **\*\***\_**\*\***
**Platform:** ☐ iOS ☐ Android ☐ Both

---

## Prerequisites

Before testing, ensure:

- [ ] App is built and running on device/simulator
- [ ] User account is set up and authenticated
- [ ] Database has test data for various scenarios

---

## Test Scenarios

### ✅ Scenario 1: New User with 0 Total XP

**Setup:**

1. Create a brand new user account (never completed a story before)
2. Start a new 5-round story adventure
3. Complete all 5 rounds

**Expected Results:**

- [ ] Completion modal displays with XP stats
- [ ] **💰 XP Earned:** Shows the earned amount (e.g., 150)
- [ ] **⭐ Total XP:** Shows the **same** earned amount (e.g., 150) — NOT "0"
- [ ] No "NaN", "undefined", or "null" values displayed
- [ ] Total XP = XP Earned (since starting from 0)

**Screenshot:** ☐ Attached

---

### ✅ Scenario 2: Profile Loading State

**Setup:**

1. Sign out and sign back in
2. Immediately start a story (while profile is still loading)
3. Complete the story quickly

**Expected Results:**

- [ ] While profile loads, Total XP displays: **"⭐ Total XP: Loading..."**
- [ ] XP Earned displays correctly: **"💰 XP Earned: [number]"**
- [ ] Once profile loads, Total XP updates to numeric value
- [ ] No crashes or UI glitches

**Screenshot:** ☐ Attached

---

### ✅ Scenario 3: Null/Undefined xp_earned

**Setup:**

1. Use database tools to manually set `game_sessions.xp_earned = NULL` for a test session
2. OR complete a story with 0 words written (if that triggers null XP)

**Expected Results:**

- [ ] **💰 XP Earned:** Shows "0" (NOT "null" or "undefined")
- [ ] **⭐ Total XP:** Shows previous total unchanged
- [ ] No console errors or warnings
- [ ] UI remains stable

**Screenshot:** ☐ Attached

---

### ✅ Scenario 4: NaN Prevention

**Setup:**

1. Test with various data combinations:
   - Profile exists, XP earned is 0
   - Profile is null, XP earned is 0
   - Profile has undefined total_xp, XP earned is valid
   - Both values are undefined/null

**Expected Results:**

- [ ] **Never** displays "NaN" anywhere
- [ ] Falls back to 0 or "Loading..." appropriately
- [ ] No JavaScript errors in console
- [ ] App remains functional

**Console Check:** ☐ No errors

---

### ✅ Scenario 5: Layout and Styling Consistency

**Visual Inspection:**

- [ ] XP Earned icon is 💰 (money bag emoji)
- [ ] Total XP icon is ⭐ (star emoji)
- [ ] Both stats use same font size (14px)
- [ ] Both stats use same color (#666 gray)
- [ ] Both stats use same font weight (600)
- [ ] 4px gap between stats (consistent with other stats)
- [ ] Alignment matches existing completion stats

**Order Verification:**

```
📝 Words Written: [number]
🎯 Challenges Completed: [number]
📚 Story Length: [number] characters
💰 XP Earned: [number]          ← Check this is 4th
⭐ Total XP: [number]            ← Check this is 5th
```

**Screenshot:** ☐ Attached

---

### ✅ Scenario 6: Icon Rendering (Cross-Platform)

**iOS Testing:**

- [ ] 💰 emoji renders correctly (not box/tofu)
- [ ] ⭐ emoji renders correctly (not box/tofu)
- [ ] Emojis are same size as text
- [ ] No layout shift or wrapping issues

**Android Testing:**

- [ ] 💰 emoji renders correctly (not box/tofu)
- [ ] ⭐ emoji renders correctly (not box/tofu)
- [ ] Emojis are same size as text
- [ ] No layout shift or wrapping issues

**Screenshot (Both Platforms):** ☐ Attached

---

### ✅ Scenario 7: Grade Level XP Bonuses

Test with different grade levels to verify XP calculation accuracy:

**K-2 Grade Level:**

1. Start story with K-2 selected
2. Complete 5 rounds with ~100 words
3. Complete 1 challenge

**Expected:**

- [ ] XP Earned displays correctly (base + 25 challenge + 100 completion)
- [ ] Total XP = previous + earned
- [ ] No calculation errors

**3-5 Grade Level:**

1. Start story with 3-5 selected
2. Complete 5 rounds with ~150 words
3. Complete 1 challenge

**Expected:**

- [ ] XP Earned displays correctly (base + 35 challenge + 100 completion)
- [ ] Total XP = previous + earned

**6-8 Grade Level:**

1. Start story with 6-8 selected
2. Complete 5 rounds with ~200 words
3. Complete 1 challenge

**Expected:**

- [ ] XP Earned displays correctly (base + 45 challenge + 100 completion)
- [ ] Total XP = previous + earned

**9-12 Grade Level:**

1. Start story with 9-12 selected
2. Complete 5 rounds with ~250 words
3. Complete 1 challenge

**Expected:**

- [ ] XP Earned displays correctly (base + 50 challenge + 100 completion)
- [ ] Total XP = previous + earned

**Screenshot (One grade level):** ☐ Attached

---

### ✅ Scenario 8: Database Consistency Verification

**After completing a story:**

1. Note the displayed values:

   - XP Earned: **\_\_\_**
   - Total XP: **\_\_\_**

2. Query database:

```sql
-- Check game_sessions table
SELECT xp_earned FROM game_sessions
WHERE id = '[session_id]';

-- Check user_profiles table
SELECT total_xp FROM user_profiles
WHERE id = '[user_id]';
```

**Verification:**

- [ ] `game_sessions.xp_earned` matches displayed "💰 XP Earned"
- [ ] `user_profiles.total_xp` + `game_sessions.xp_earned` = displayed "⭐ Total XP"
- [ ] No discrepancies between UI and database

---

## Edge Case Matrix

Test combinations to ensure robustness:

| UserProfile        | XP Earned | Expected XP Earned Display | Expected Total XP Display |
| ------------------ | --------- | -------------------------- | ------------------------- |
| null               | null      | 0                          | Loading...                |
| null               | 100       | 100                        | Loading...                |
| {total: 0}         | 0         | 0                          | 0                         |
| {total: 0}         | 150       | 150                        | 150                       |
| {total: 500}       | 0         | 0                          | 500                       |
| {total: 500}       | 100       | 100                        | 600                       |
| {total: undefined} | 50        | 50                         | 50                        |

**All combinations tested:** ☐ Yes

---

## Console Error Check

**During all tests:**

- [ ] No TypeScript errors
- [ ] No React warnings
- [ ] No undefined/null property access errors
- [ ] No NaN calculation errors
- [ ] No layout warnings

**Console output:** ☐ Clean

---

## Performance Verification

**Story completion flow:**

- [ ] Completion modal appears instantly after round 5
- [ ] XP values display immediately (no delay)
- [ ] No UI freezing or lag
- [ ] Smooth transitions

---

## Regression Testing

**Ensure existing features still work:**

- [ ] Words Written stat displays correctly
- [ ] Challenges Completed stat displays correctly
- [ ] Story Length stat displays correctly
- [ ] "Start New Story" button works
- [ ] "View Full Story" button works
- [ ] Navigation to ProfileScreen shows updated Total XP

---

## Sign-Off

**All US-003 Acceptance Criteria Met:**

- [ ] New user with 0 total XP: Shows correct earned amount as total
- [ ] Profile loading: Shows "Loading..." until profile available
- [ ] Null `xp_earned`: Shows 0 without breaking UI
- [ ] No NaN values displayed in any scenario
- [ ] Layout maintains 4px gap between stats
- [ ] Icons render properly on both iOS and Android
- [ ] XP bonuses work across all grade levels (K-2, 3-5, 6-8, 9-12)

**Tester Signature:** **\*\***\_\_\_**\*\***
**Date:** **\*\***\_\_\_**\*\***
**Status:** ☐ PASS ☐ FAIL (see notes below)

---

## Notes / Issues Found

_Use this space to document any bugs, edge cases, or unexpected behavior:_

```
[Notes here]
```

---

## Attachments

- [ ] iOS Screenshot (normal flow)
- [ ] Android Screenshot (normal flow)
- [ ] Edge case screenshots (loading state, 0 XP, etc.)
- [ ] Console logs (if errors found)
- [ ] Database query results
