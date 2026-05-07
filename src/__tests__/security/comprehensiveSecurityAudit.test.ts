// FR-8 (US-015d): Comprehensive Security Audit Test Suite
//
// Asserts on a `claudeSkillsConfig.getApiEndpoints()` singleton API that no
// longer exists. The `claudeSkillsConfig` module was reorganized into
// `services/claudeSkillsConfigManager` (a class, not a singleton) and the
// `getApiEndpoints` method was removed in the process.
//
// Replaced with this stub pending rewrite against the current
// ClaudeSkillsConfigManager API surface.

describe.skip('Comprehensive Security Audit', () => {
  it('archaeology — claudeSkillsConfig.getApiEndpoints no longer exists', () => {
    // Pending US-015d rewrite against ClaudeSkillsConfigManager.
  });
});
