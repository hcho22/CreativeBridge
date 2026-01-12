# Bug Prioritization Framework

**Purpose:** Standardize how we prioritize and triage bugs discovered in production
**Last Updated:** 2026-01-09
**Owner:** Engineering Team

---

## Priority Levels

### P0 (Critical) - Fix within 4 hours
**Definition:** Blocks core functionality or affects majority of users

**Examples:**
- Database connection failures
- Authentication system down
- App crashes on launch for all users
- Data loss or corruption
- Security vulnerabilities

**Response:**
1. Page on-call engineer immediately
2. Create incident ticket
3. Start hotfix branch
4. Deploy fix ASAP with minimal testing
5. Monitor rollout closely
6. Post-mortem required

**SLA:** Fix within 4 hours, deploy within 6 hours

---

### P1 (High) - Fix within 48 hours
**Definition:** Affects many users or critical features

**Examples:**
- Image upload failures (>10% failure rate)
- Story completion not saving
- XP not being awarded correctly
- Performance degradation (>50% slower)
- Feature completely broken for subset of users

**Response:**
1. Alert engineering team
2. Create bug ticket with priority label
3. Assign to current sprint
4. Fix within 2 business days
5. Deploy in next release
6. Monitor metrics after deployment

**SLA:** Fix within 48 hours, deploy within 3 days

---

### P2 (Medium) - Fix within 1 week
**Definition:** Minor impact or affects small subset of users

**Examples:**
- UI glitches or layout issues
- Offline sync edge cases
- Retry button not working in some scenarios
- Non-critical error messages
- Performance issues (<20% degradation)

**Response:**
1. Create bug ticket
2. Add to backlog
3. Fix in next planned sprint
4. Include in regular release cycle
5. Test thoroughly before deployment

**SLA:** Fix within 1 week, deploy in next release

---

### P3 (Low) - Backlog
**Definition:** Edge cases or very low impact

**Examples:**
- Cosmetic issues
- Rare edge cases (<1% of users)
- Minor text typos
- Feature requests disguised as bugs
- Nice-to-have improvements

**Response:**
1. Create bug ticket
2. Add to backlog
3. Fix when time permits
4. Can be deferred if higher priorities exist

**SLA:** No specific SLA

---

## Prioritization Decision Tree

```
Is the app unusable for ANY user?
├─ YES → P0 (Critical)
└─ NO
   │
   Is core functionality broken for >10% of users?
   ├─ YES → P1 (High)
   └─ NO
      │
      Is a feature broken for <10% of users?
      ├─ YES → P2 (Medium)
      └─ NO → P3 (Low)
```

---

## Severity vs Priority Matrix

| Impact \ Frequency | High Frequency (>50% users) | Medium (10-50% users) | Low (<10% users) |
|-------------------|----------------------------|----------------------|------------------|
| **Critical Impact** (data loss, security) | P0 | P0 | P1 |
| **High Impact** (feature broken) | P0 | P1 | P2 |
| **Medium Impact** (degraded UX) | P1 | P2 | P3 |
| **Low Impact** (cosmetic) | P2 | P3 | P3 |

---

## Common Bug Patterns & Priorities

### Image Upload Issues
- Upload fails for all users → **P0**
- Upload fails for >10% of users → **P1**
- Upload succeeds but retry button doesn't work → **P2**
- Upload status badge rendering issue → **P3**

### Story Completion Issues
- Stories not saving at all → **P0**
- Completion timestamp incorrect → **P2**
- Round counter display issue → **P3**

### XP Management Issues
- XP not deducted (users can generate unlimited images) → **P0**
- XP not refunded on failure → **P1**
- XP display incorrect but actual value correct → **P3**

### Performance Issues
- App freezes/crashes → **P0**
- Feature takes >10s (should be <2s) → **P1**
- Minor UI lag (<1s) → **P2**

### Offline Sync Issues
- Data loss when going online → **P0**
- Sync conflicts not resolved → **P1**
- Cache not updating properly → **P2**

---

## Escalation Process

### When to Escalate
1. Bug affects more users than initially estimated
2. Fix is more complex than expected (>1 day work)
3. Requires database migration or infrastructure change
4. Multiple related bugs discovered (systemic issue)
5. User complaints/support tickets increasing

### How to Escalate
1. Update bug priority in ticket system
2. Notify engineering lead
3. Update stakeholders
4. Re-estimate fix timeline
5. Consider workaround/mitigation

---

## Bug Lifecycle

```
[Reported] → [Triaged] → [Prioritized] → [Assigned] → [In Progress] → [Fixed] → [Deployed] → [Verified] → [Closed]
```

### States Explained
- **Reported:** Bug discovered and initial ticket created
- **Triaged:** Engineering reviews and gathers more info
- **Prioritized:** P0-P3 label assigned based on framework
- **Assigned:** Engineer assigned to fix
- **In Progress:** Engineer actively working on fix
- **Fixed:** Code merged, awaiting deployment
- **Deployed:** Fix live in production
- **Verified:** QA/Reporter confirms fix works
- **Closed:** Bug resolved and documented

---

## Metrics to Track

### Bug Health Metrics
1. **Mean Time to Triage (MTTT):** Time from report to prioritization
   - Target: <2 hours
2. **Mean Time to Fix (MTTF):** Time from assignment to deployment
   - P0: <6 hours
   - P1: <48 hours
   - P2: <7 days
3. **Recurrence Rate:** % of bugs that reappear after fix
   - Target: <5%
4. **Escape Rate:** % of bugs found in production vs caught in testing
   - Target: <20%

### Weekly Bug Report
```markdown
## Week of [DATE]

### New Bugs
- P0: X
- P1: X
- P2: X
- P3: X

### Resolved Bugs
- P0: X
- P1: X
- P2: X
- P3: X

### Aging Bugs (Open >7 days)
- P1: X
- P2: X

### Top 3 Bug Patterns
1. [Pattern] - X occurrences
2. [Pattern] - X occurrences
3. [Pattern] - X occurrences
```

---

## Tools & Resources

### Bug Tracking
- GitHub Issues with priority labels
- Sentry for error tracking
- Supabase logs for database errors

### Monitoring
- `npm run monitor:errors` - Daily error report
- Supabase Dashboard - Real-time metrics
- Analytics - User impact tracking

### Communication
- Slack #engineering-alerts for P0/P1
- Email for daily error reports
- PagerDuty for critical incidents

---

## Examples from Production

### Example 1: Image Upload Timeout
**Reported:** Image uploads timing out after 10s
**Impact:** 15% of uploads failing
**Initial Priority:** P2 (only 15% affected)
**Escalated to:** P1 (affects core feature)
**Fix:** Increased timeout from 10s to 30s, added retry logic
**Outcome:** Upload success rate improved to 97%

### Example 2: UI Flicker on State Update
**Reported:** Progress indicator flickers during round updates
**Impact:** All users see brief flicker
**Priority:** P3 (cosmetic, low impact)
**Fix:** Added React.memo and optimized state updates
**Deployed:** In next release cycle

### Example 3: XP Refund Not Working
**Reported:** XP not refunded when Replicate fails
**Impact:** ~5 users per day losing XP
**Initial Priority:** P2
**Escalated to:** P1 (financial impact on users)
**Fix:** Fixed refund logic and added idempotency checks
**Deployed:** Hotfix within 24 hours

---

## Continuous Improvement

### Monthly Review
- Review bug trends and patterns
- Update prioritization criteria if needed
- Identify process improvements
- Update runbooks with new learnings

### Post-Mortem Template
For P0/P1 bugs, complete this template:
1. **What happened?**
2. **Why did it happen?** (root cause)
3. **How did we detect it?**
4. **How long did it take to fix?**
5. **What could we have done better?**
6. **What are we changing to prevent recurrence?**

---

**Remember:** When in doubt, escalate! It's better to over-prioritize and de-escalate later than to miss a critical issue.
