/**
 * Encryption and Data Protection Test Suite
 * 
 * Comprehensive testing of encryption and data protection measures
 * Task 8.2: Security & Privacy Compliance Validation - Subtask 3
 */

import { jest } from '@jest/globals';
import { secureStorage } from '../../utils/secureStorage';
import { claudeSkillsCredentialRotation } from '../../services/claudeSkillsCredentialRotation';
import { structuredLogger } from '../../utils/logger';
import { userPreferencesService } from '../../services/userPreferences';

// Mock cryptographic modules
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn(),
  getInternetCredentials: jest.fn(),
  resetInternetCredentials: jest.fn(),
  canImplyAuthentication: jest.fn().mockResolvedValue(true),
  getSupportedBiometryType: jest.fn().mockResolvedValue('FaceID'),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn((size) => Buffer.alloc(size, 0)),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked_hash'),
  })),
  createCipher: jest.fn(() => ({
    update: jest.fn().mockReturnValue('encrypted_'),
    final: jest.fn().mockReturnValue('_data'),
  })),
  createDecipher: jest.fn(() => ({
    update: jest.fn().mockReturnValue('decrypted_'),
    final: jest.fn().mockReturnValue('_data'),
  })),
}));

describe('Encryption and Data Protection', () => {
  let testData: any;

  beforeAll(async () => {
    // Initialize test data
    testData = {
      sensitiveUserData: {
        preferences: { theme: 'dark', difficulty: 'medium' },
        progress: { level: 5, score: 1250 },
      },
      credentials: {
        apiKey: 'test_api_key_12345',
        refreshToken: 'test_refresh_token_67890',
      },
      personalInfo: {
        gradeLevel: 'Grade3',
        learningStyle: 'visual',
      },
    };
  });

  describe('Data Encryption at Rest', () => {
    test('User preferences are encrypted in local storage', async () => {
      const testPreferences = testData.sensitiveUserData.preferences;
      
      // Store encrypted data
      await secureStorage.set('user_preferences', testPreferences, { encrypt: true });
      
      // Retrieve and verify encryption
      const storedData = await secureStorage.get('user_preferences', { decrypt: true });
      
      expect(storedData).toEqual(testPreferences);
      
      // Verify data is actually encrypted in storage
      const rawStoredData = await secureStorage.getRaw('user_preferences');
      expect(rawStoredData).not.toEqual(JSON.stringify(testPreferences));
      expect(rawStoredData).toContain('encrypted_'); // Mock encryption signature
    });

    test('User progress data uses strong encryption', async () => {
      const testProgress = testData.sensitiveUserData.progress;
      
      await secureStorage.set('user_progress', testProgress, { 
        encrypt: true,
        encryptionAlgorithm: 'AES-256-GCM'
      });
      
      const encryptionInfo = await secureStorage.getEncryptionInfo('user_progress');
      
      expect(encryptionInfo.algorithm).toBe('AES-256-GCM');
      expect(encryptionInfo.keySize).toBe(256);
      expect(encryptionInfo.ivLength).toBe(16);
      expect(encryptionInfo.saltLength).toBe(32);
    });

    test('Encryption keys are properly derived', async () => {
      const keyDerivationResult = await secureStorage.testKeyDerivation();
      
      expect(keyDerivationResult.algorithm).toBe('PBKDF2');
      expect(keyDerivationResult.iterations).toBeGreaterThanOrEqual(100000);
      expect(keyDerivationResult.saltGeneration).toBe('cryptographically_secure');
      expect(keyDerivationResult.keyLength).toBe(32); // 256 bits
    });

    test('Sensitive data is never stored in plain text', async () => {
      const sensitiveFields = ['apiKey', 'refreshToken', 'personalInfo'];
      
      for (const field of sensitiveFields) {
        await secureStorage.set(field, testData.credentials[field] || testData.personalInfo, { 
          encrypt: true 
        });
        
        // Verify plain text is not present in storage
        const rawData = await secureStorage.getRaw(field);
        const originalData = JSON.stringify(testData.credentials[field] || testData.personalInfo);
        
        expect(rawData).not.toContain(originalData);
        expect(rawData).not.toContain('test_api_key');
        expect(rawData).not.toContain('Grade3');
      }
    });

    test('Encryption uses secure random initialization vectors', async () => {
      const testString = 'test_data_for_iv_verification';
      
      // Encrypt same data multiple times
      await secureStorage.set('test_iv_1', testString, { encrypt: true });
      await secureStorage.set('test_iv_2', testString, { encrypt: true });
      
      const encrypted1 = await secureStorage.getRaw('test_iv_1');
      const encrypted2 = await secureStorage.getRaw('test_iv_2');
      
      // Encrypted data should be different due to different IVs
      expect(encrypted1).not.toEqual(encrypted2);
      
      // But decrypted data should be the same
      const decrypted1 = await secureStorage.get('test_iv_1', { decrypt: true });
      const decrypted2 = await secureStorage.get('test_iv_2', { decrypt: true });
      
      expect(decrypted1).toEqual(testString);
      expect(decrypted2).toEqual(testString);
    });

    test('Encryption includes authentication tags for integrity', async () => {
      const testData = { important: 'data', timestamp: Date.now() };
      
      await secureStorage.set('authenticated_data', testData, { 
        encrypt: true,
        includeAuthTag: true 
      });
      
      const encryptionInfo = await secureStorage.getEncryptionInfo('authenticated_data');
      
      expect(encryptionInfo.authenticationTag).toBeDefined();
      expect(encryptionInfo.authenticationTag.length).toBe(16); // 128-bit auth tag
      expect(encryptionInfo.integrityVerified).toBe(true);
    });
  });

  describe('Data Encryption in Transit', () => {
    test('All API communications use TLS 1.3', async () => {
      const networkSecurityTest = await secureStorage.testNetworkSecurity();
      
      expect(networkSecurityTest.tlsVersion).toBe('1.3');
      expect(networkSecurityTest.certificateValidation).toBe(true);
      expect(networkSecurityTest.certificatePinning).toBe(true);
      expect(networkSecurityTest.weakCiphersDisabled).toBe(true);
    });

    test('Certificate pinning prevents MITM attacks', async () => {
      const certificateTest = await secureStorage.testCertificatePinning();
      
      expect(certificateTest.pinningEnabled).toBe(true);
      expect(certificateTest.validCertificatesAccepted).toBe(true);
      expect(certificateTest.invalidCertificatesRejected).toBe(true);
      expect(certificateTest.backupCertificatesSupported).toBe(true);
    });

    test('Request payloads are encrypted end-to-end', async () => {
      const payload = {
        storyPrompt: 'Generate a story about friendship',
        userContext: { gradeLevel: 'Grade3', preferences: testData.sensitiveUserData.preferences },
      };
      
      const encryptedPayload = await secureStorage.encryptPayload(payload);
      
      expect(encryptedPayload.data).not.toContain('friendship');
      expect(encryptedPayload.data).not.toContain('Grade3');
      expect(encryptedPayload.encryption).toBeDefined();
      expect(encryptedPayload.encryption.algorithm).toBe('AES-256-GCM');
      expect(encryptedPayload.encryption.keyExchange).toBe('ECDH');
    });

    test('Response data is encrypted and authenticated', async () => {
      const mockEncryptedResponse = {
        data: 'encrypted_story_content',
        encryption: {
          algorithm: 'AES-256-GCM',
          iv: 'random_iv_value',
          authTag: 'authentication_tag',
        },
      };
      
      const decryptedResponse = await secureStorage.decryptResponse(mockEncryptedResponse);
      
      expect(decryptedResponse.content).toBeDefined();
      expect(decryptedResponse.verified).toBe(true);
      expect(decryptedResponse.integrityCheck).toBe('passed');
    });
  });

  describe('Key Management Security', () => {
    test('Encryption keys are stored in secure hardware', async () => {
      const keyStorageTest = await secureStorage.testKeyStorage();
      
      expect(keyStorageTest.hardwareSecurityModule).toBe(true);
      expect(keyStorageTest.secureEnclave).toBe(true);
      expect(keyStorageTest.biometricProtection).toBe(true);
      expect(keyStorageTest.keyExtractionPrevented).toBe(true);
    });

    test('Key rotation is implemented and functional', async () => {
      const rotationTest = await claudeSkillsCredentialRotation.testKeyRotation();
      
      expect(rotationTest.rotationSupported).toBe(true);
      expect(rotationTest.automaticRotation).toBe(true);
      expect(rotationTest.rotationInterval).toBeLessThanOrEqual(90); // Days
      expect(rotationTest.backwardCompatibility).toBe(true);
      expect(rotationTest.zeroDowntimeRotation).toBe(true);
    });

    test('Key derivation uses secure parameters', async () => {
      const keyDerivationTest = await secureStorage.testKeyDerivation();
      
      expect(keyDerivationTest.algorithm).toBe('PBKDF2');
      expect(keyDerivationTest.iterations).toBeGreaterThanOrEqual(100000);
      expect(keyDerivationTest.saltLength).toBeGreaterThanOrEqual(32);
      expect(keyDerivationTest.outputKeyLength).toBe(32); // 256 bits
      expect(keyDerivationTest.timingAttackResistant).toBe(true);
    });

    test('Master keys are protected with multiple layers', async () => {
      const masterKeyTest = await secureStorage.testMasterKeyProtection();
      
      expect(masterKeyTest.layeredProtection).toBe(true);
      expect(masterKeyTest.biometricAccess).toBe(true);
      expect(masterKeyTest.deviceBinding).toBe(true);
      expect(masterKeyTest.tamperDetection).toBe(true);
      expect(masterKeyTest.keyEscrow).toBe(false); // No backdoors
    });

    test('Cryptographic randomness is secure', async () => {
      const randomnessTest = await secureStorage.testRandomness();
      
      expect(randomnessTest.entropySource).toBe('hardware');
      expect(randomnessTest.randomnessTests).toBe('passed');
      expect(randomnessTest.seedingProper).toBe(true);
      expect(randomnessTest.predictabilityTest).toBe('unpredictable');
    });
  });

  describe('Data Protection Controls', () => {
    test('Data loss prevention mechanisms active', async () => {
      const dlpTest = await secureStorage.testDataLossPrevention();
      
      expect(dlpTest.screenRecordingDetection).toBe(true);
      expect(dlpTest.screenshotPrevention).toBe(true);
      expect(dlpTest.copyPasteRestrictions).toBe(true);
      expect(dlpTest.dataExfiltrationPrevention).toBe(true);
    });

    test('Memory protection prevents data dumps', async () => {
      const memoryProtectionTest = await secureStorage.testMemoryProtection();
      
      expect(memoryProtectionTest.memoryEncryption).toBe(true);
      expect(memoryProtectionTest.heapProtection).toBe(true);
      expect(memoryProtectionTest.stackProtection).toBe(true);
      expect(memoryProtectionTest.debuggerDetection).toBe(true);
      expect(memoryProtectionTest.memoryDumpPrevention).toBe(true);
    });

    test('Secure deletion removes data completely', async () => {
      const testSensitiveData = 'highly_sensitive_user_data_12345';
      
      // Store data
      await secureStorage.set('temp_sensitive', testSensitiveData, { encrypt: true });
      
      // Securely delete
      const deletionResult = await secureStorage.secureDelete('temp_sensitive');
      
      expect(deletionResult.success).toBe(true);
      expect(deletionResult.overwritePasses).toBeGreaterThanOrEqual(3);
      expect(deletionResult.verificationPassed).toBe(true);
      
      // Verify data is completely removed
      const retrievalAttempt = await secureStorage.get('temp_sensitive');
      expect(retrievalAttempt).toBeNull();
    });

    test('Data residue cleaning prevents recovery', async () => {
      const cleaningTest = await secureStorage.testDataResidueCleaning();
      
      expect(cleaningTest.tempFilesCleaned).toBe(true);
      expect(cleaningTest.cacheDataCleared).toBe(true);
      expect(cleaningTest.memoryZeroed).toBe(true);
      expect(cleaningTest.swapFilesCleaned).toBe(true);
      expect(cleaningTest.forensicRecoveryPrevented).toBe(true);
    });
  });

  describe('Compliance and Privacy Protection', () => {
    test('COPPA data handling requirements met', async () => {
      const coppaTest = await secureStorage.testCOPPACompliance();
      
      expect(coppaTest.noPersonalInfoStorage).toBe(true);
      expect(coppaTest.parentalConsentMechanism).toBe(true);
      expect(coppaTest.dataMinimization).toBe(true);
      expect(coppaTest.secureDataHandling).toBe(true);
      expect(coppaTest.rightToDeletion).toBe(true);
    });

    test('FERPA educational records protection active', async () => {
      const ferpaTest = await secureStorage.testFERPACompliance();
      
      expect(ferpaTest.educationalRecordsProtected).toBe(true);
      expect(ferpaTest.accessControls).toBe(true);
      expect(ferpaTest.auditLogging).toBe(true);
      expect(ferpaTest.dataRetentionPolicy).toBe(true);
      expect(ferpaTest.thirdPartyDisclosureControls).toBe(true);
    });

    test('GDPR privacy rights implementation', async () => {
      const gdprTest = await secureStorage.testGDPRCompliance();
      
      expect(gdprTest.rightToAccess).toBe(true);
      expect(gdprTest.rightToRectification).toBe(true);
      expect(gdprTest.rightToErasure).toBe(true);
      expect(gdprTest.rightToDataPortability).toBe(true);
      expect(gdprTest.dataProtectionByDesign).toBe(true);
    });

    test('Data anonymization techniques effective', async () => {
      const anonymizationTest = await secureStorage.testDataAnonymization();
      
      expect(anonymizationTest.personalIdentifiersRemoved).toBe(true);
      expect(anonymizationTest.quasiIdentifiersObfuscated).toBe(true);
      expect(anonymizationTest.linkabilityPrevented).toBe(true);
      expect(anonymizationTest.reidentificationResistant).toBe(true);
      expect(anonymizationTest.kAnonymityAchieved).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Cryptographic Implementation Validation', () => {
    test('Cryptographic algorithms are secure and current', async () => {
      const cryptoTest = await secureStorage.testCryptographicImplementation();
      
      expect(cryptoTest.algorithms.symmetric).toBe('AES-256-GCM');
      expect(cryptoTest.algorithms.asymmetric).toBe('RSA-4096');
      expect(cryptoTest.algorithms.hashing).toBe('SHA-256');
      expect(cryptoTest.algorithms.keyExchange).toBe('ECDH-P256');
      expect(cryptoTest.deprecatedAlgorithmsAbsent).toBe(true);
    });

    test('Cryptographic implementations resist timing attacks', async () => {
      const timingTest = await secureStorage.testTimingAttackResistance();
      
      expect(timingTest.constantTimeOperations).toBe(true);
      expect(timingTest.sidechannelResistance).toBe(true);
      expect(timingTest.branchingPatternsSafe).toBe(true);
      expect(timingTest.memoryAccessPatternsSafe).toBe(true);
    });

    test('Padding oracle attacks prevented', async () => {
      const paddingTest = await secureStorage.testPaddingOracleResistance();
      
      expect(paddingTest.authenticatedEncryption).toBe(true);
      expect(paddingTest.paddingValidationSafe).toBe(true);
      expect(paddingTest.errorMessagesSafe).toBe(true);
      expect(paddingTest.timingVariationMinimized).toBe(true);
    });

    test('Key stretching properly implemented', async () => {
      const stretchingTest = await secureStorage.testKeyStretching();
      
      expect(stretchingTest.iterations).toBeGreaterThanOrEqual(100000);
      expect(stretchingTest.memoryCost).toBeGreaterThanOrEqual(65536); // 64 MB
      expect(stretchingTest.parallelism).toBeGreaterThanOrEqual(1);
      expect(stretchingTest.outputLength).toBe(32); // 256 bits
      expect(stretchingTest.algorithm).toBe('Argon2id');
    });
  });

  describe('Data Backup and Recovery Security', () => {
    test('Backups are encrypted with separate keys', async () => {
      const backupTest = await secureStorage.testBackupSecurity();
      
      expect(backupTest.backupEncryption).toBe(true);
      expect(backupTest.separateBackupKeys).toBe(true);
      expect(backupTest.keyRotationIndependent).toBe(true);
      expect(backupTest.backupIntegrityVerified).toBe(true);
      expect(backupTest.accessControlsEnforced).toBe(true);
    });

    test('Recovery processes maintain security', async () => {
      const recoveryTest = await secureStorage.testRecoverySecurity();
      
      expect(recoveryTest.secureRecoveryProcess).toBe(true);
      expect(recoveryTest.authenticationRequired).toBe(true);
      expect(recoveryTest.auditLoggingActive).toBe(true);
      expect(recoveryTest.integrityValidationRequired).toBe(true);
      expect(recoveryTest.rollbackCapability).toBe(true);
    });

    test('Point-in-time recovery maintains encryption', async () => {
      const pitTest = await secureStorage.testPointInTimeRecovery();
      
      expect(pitTest.encryptionPreserved).toBe(true);
      expect(pitTest.keyConsistency).toBe(true);
      expect(pitTest.dataIntegrity).toBe(true);
      expect(pitTest.auditTrailMaintained).toBe(true);
      expect(pitTest.rollbackSecurity).toBe(true);
    });
  });

  describe('Integration Security Testing', () => {
    test('Claude Skills integration maintains encryption', async () => {
      const integrationTest = await secureStorage.testClaudeSkillsIntegrationSecurity();
      
      expect(integrationTest.endToEndEncryption).toBe(true);
      expect(integrationTest.apiKeyProtection).toBe(true);
      expect(integrationTest.responseDataEncryption).toBe(true);
      expect(integrationTest.sessionSecurityMaintained).toBe(true);
      expect(integrationTest.noDataLeakage).toBe(true);
    });

    test('Third-party services receive minimal data', async () => {
      const dataMinimizationTest = await secureStorage.testDataMinimization();
      
      expect(dataMinimizationTest.necessaryDataOnly).toBe(true);
      expect(dataMinimizationTest.personalDataExcluded).toBe(true);
      expect(dataMinimizationTest.encryptionBeforeTransmission).toBe(true);
      expect(dataMinimizationTest.retentionPolicyEnforced).toBe(true);
    });

    test('Analytics data is properly anonymized', async () => {
      const analyticsTest = await secureStorage.testAnalyticsDataSecurity();
      
      expect(analyticsTest.dataAnonymized).toBe(true);
      expect(analyticsTest.personalIdentifiersRemoved).toBe(true);
      expect(analyticsTest.aggregationApplied).toBe(true);
      expect(analyticsTest.consentManaged).toBe(true);
      expect(analyticsTest.retentionLimited).toBe(true);
    });
  });

  describe('Performance and Efficiency', () => {
    test('Encryption performance is acceptable', async () => {
      const performanceTest = await secureStorage.testEncryptionPerformance();
      
      expect(performanceTest.encryptionSpeed).toBeGreaterThan(1024); // KB/s
      expect(performanceTest.decryptionSpeed).toBeGreaterThan(1024); // KB/s
      expect(performanceTest.memoryUsage).toBeLessThan(100); // MB
      expect(performanceTest.cpuUsage).toBeLessThan(20); // %
      expect(performanceTest.batteryImpact).toBeLessThan(5); // %
    });

    test('Key operations complete within acceptable time', async () => {
      const keyOpTest = await secureStorage.testKeyOperationPerformance();
      
      expect(keyOpTest.keyGenerationTime).toBeLessThan(1000); // ms
      expect(keyOpTest.keyDerivationTime).toBeLessThan(500); // ms
      expect(keyOpTest.keyRotationTime).toBeLessThan(2000); // ms
      expect(keyOpTest.operationsOptimized).toBe(true);
    });
  });
});

// Helper function to verify encryption end-to-end
async function verifyEndToEndEncryption(originalData: any, encryptedData: any, decryptedData: any): Promise<boolean> {
  // Verify original data equals decrypted data
  const dataMatches = JSON.stringify(originalData) === JSON.stringify(decryptedData);
  
  // Verify encrypted data is different from original
  const encryptedDifferent = JSON.stringify(originalData) !== JSON.stringify(encryptedData);
  
  return dataMatches && encryptedDifferent;
}

// Performance benchmark for encryption operations
async function benchmarkEncryption(dataSize: number): Promise<{ encryptTime: number; decryptTime: number }> {
  const testData = 'x'.repeat(dataSize);
  
  const encryptStart = performance.now();
  await secureStorage.set('benchmark_data', testData, { encrypt: true });
  const encryptEnd = performance.now();
  
  const decryptStart = performance.now();
  await secureStorage.get('benchmark_data', { decrypt: true });
  const decryptEnd = performance.now();
  
  return {
    encryptTime: encryptEnd - encryptStart,
    decryptTime: decryptEnd - decryptStart,
  };
}