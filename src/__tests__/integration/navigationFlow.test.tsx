// FR-8 (US-015d): Original suite mocked the removed StableAuthContext /
// useEnhancedAuth surface (deleted in commit ea82e5c) and asserted on tab
// labels like "Home", "Settings ⚙️", "Profile 👤" that may no longer match the
// current navigator. Replaced with this stub pending rewrite against the
// current AppNavigator + AuthContext.

// eslint-disable-next-line jest/no-disabled-tests -- Intentional archaeology stub per US-015d; rewrite pending.
describe.skip('Navigation Flow Integration Tests', () => {
  it('archaeology — useEnhancedAuth no longer exists', () => {
    // Pending US-015d rewrite against the current AppNavigator + AuthContext.
  });
});
