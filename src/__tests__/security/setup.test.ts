// Simple test to verify security test setup
describe('Security Test Setup', () => {
  it('should have proper test environment', () => {
    expect((global as any).__DEV__).toBe(true);
  });

  it('should have access to security test utilities', () => {
    expect((global as any).securityTestUtils).toBeDefined();
    expect((global as any).securityTestUtils.generateTestIP).toBeInstanceOf(
      Function,
    );
  });

  it('should be able to generate test data', () => {
    const testIP = (global as any).securityTestUtils.generateTestIP();
    expect(testIP).toMatch(/^192\.168\.1\.\d+$/);

    const deviceFingerprint = (
      global as any
    ).securityTestUtils.generateTestDeviceFingerprint();
    expect(deviceFingerprint).toBeValidDeviceFingerprint();
  });
});
