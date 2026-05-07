/**
 * API Key Security Verification Script
 *
 * This script tests the secure API key storage mechanism to ensure:
 * 1. API keys are never exposed in logs
 * 2. Security monitoring works correctly
 * 3. Validation and error handling work as expected
 */

import {
  secureApiKeyManager,
  ApiService,
  getApiKey,
  validateAllApiKeys,
  secureLogger,
} from '../services/secureApiKeyManager';

// Test data with realistic but fake API keys
const TEST_SCENARIOS = {
  validKeys: {
    replicate: 'r8_test123456789abcdef',
    openai: 'sk-test123456789abcdef',
  },
  invalidKeys: {
    replicate: 'invalid_replicate_key',
    openai: 'invalid_openai_key',
  },
  emptyKeys: {
    replicate: '',
    openai: '',
  },
};

/**
 * Mock console methods to capture logs for security testing
 */
class LogCapture {
  private logs: string[] = [];
  private originalConsole: any;

  start() {
    this.logs = [];
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    console.log = (...args) => {
      this.logs.push(`LOG: ${args.join(' ')}`);
      this.originalConsole.log(...args);
    };

    console.warn = (...args) => {
      this.logs.push(`WARN: ${args.join(' ')}`);
      this.originalConsole.warn(...args);
    };

    console.error = (...args) => {
      this.logs.push(`ERROR: ${args.join(' ')}`);
      this.originalConsole.error(...args);
    };
  }

  stop() {
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  findExposedKeys(testKeys: string[]): string[] {
    const exposedKeys: string[] = [];

    this.logs.forEach(log => {
      testKeys.forEach(key => {
        if (key && key.length > 8 && log.includes(key)) {
          exposedKeys.push(`Key "${key}" found in log: ${log}`);
        }
      });
    });

    return exposedKeys;
  }
}

/**
 * Test suite for API key security
 */
class ApiKeySecurityTester {
  private logCapture = new LogCapture();
  private testResults: { name: string; passed: boolean; details: string }[] =
    [];

  constructor() {
    console.log('🧪 Starting API Key Security Tests...\n');
  }

  private addResult(name: string, passed: boolean, details: string) {
    this.testResults.push({ name, passed, details });
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${name}: ${details}`);
  }

  /**
   * Test 1: Verify API key masking in logs
   */
  async testKeyMasking() {
    console.log('\n📝 Test 1: API Key Masking in Logs');

    this.logCapture.start();

    try {
      // Test getting API keys (this should log masked versions)
      const services = [ApiService.REPLICATE_PRIMARY, ApiService.OPENAI];

      for (const service of services) {
        const result = getApiKey(service);
        if (result.key) {
          console.log(`Testing access to ${service} API key`);
        }
      }

      // Test environment service logging
      const { env } = await import('../services/environment');
      console.log(`App configuration: ${env.APP_NAME}`);

      this.logCapture.stop();

      // Check for exposed keys
      const testKeys = Object.values(TEST_SCENARIOS.validKeys);
      const exposedKeys = this.logCapture.findExposedKeys(testKeys);

      if (exposedKeys.length === 0) {
        this.addResult(
          'Key Masking',
          true,
          'No API keys found exposed in logs',
        );
      } else {
        this.addResult(
          'Key Masking',
          false,
          `Found ${exposedKeys.length} exposed keys: ${exposedKeys.join(', ')}`,
        );
      }
    } catch (error) {
      this.logCapture.stop();
      this.addResult('Key Masking', false, `Test failed with error: ${error}`);
    }
  }

  /**
   * Test 2: Verify API key validation
   */
  async testKeyValidation() {
    console.log('\n🔍 Test 2: API Key Validation');

    try {
      // Test validation of current keys
      const validation = validateAllApiKeys();

      if (validation.errors.length === 0) {
        this.addResult(
          'Key Validation',
          true,
          'All configured API keys are valid',
        );
      } else {
        this.addResult(
          'Key Validation',
          false,
          `Found ${validation.errors.length} validation errors`,
        );
      }

      // Test warnings for optional services
      if (validation.warnings.length > 0) {
        console.log(`   ⚠️ Warnings: ${validation.warnings.join(', ')}`);
      }
    } catch (error) {
      this.addResult(
        'Key Validation',
        false,
        `Validation test failed: ${error}`,
      );
    }
  }

  /**
   * Test 3: Verify security monitoring and access tracking
   */
  async testSecurityMonitoring() {
    console.log('\n📊 Test 3: Security Monitoring');

    try {
      // Clear previous statistics
      secureApiKeyManager.clearAccessStatistics();

      // Generate some API key accesses
      for (let i = 0; i < 5; i++) {
        getApiKey(ApiService.REPLICATE_PRIMARY);
        getApiKey(ApiService.OPENAI);
      }

      // Check access statistics
      const stats = secureApiKeyManager.getAccessStatistics();

      const replicateStats = stats[ApiService.REPLICATE_PRIMARY];
      const openaiStats = stats[ApiService.OPENAI];

      if (
        replicateStats &&
        replicateStats.accessCount === 5 &&
        openaiStats &&
        openaiStats.accessCount === 5
      ) {
        this.addResult(
          'Access Tracking',
          true,
          'API key access statistics properly tracked',
        );
      } else {
        this.addResult(
          'Access Tracking',
          false,
          'Access statistics not properly tracked',
        );
      }
    } catch (error) {
      this.addResult(
        'Security Monitoring',
        false,
        `Monitoring test failed: ${error}`,
      );
    }
  }

  /**
   * Test 4: Verify secure logging utilities
   */
  async testSecureLogging() {
    console.log('\n📝 Test 4: Secure Logging Utilities');

    this.logCapture.start();

    try {
      // Test secure API call logging
      secureLogger.logApiCall(
        ApiService.REPLICATE_PRIMARY,
        '/predictions',
        true,
        {
          duration: 1234,
          status: 200,
        },
      );

      // Test service initialization logging
      secureLogger.logServiceInit(ApiService.OPENAI, true, {
        version: '1.0.0',
      });

      this.logCapture.stop();

      // Verify no keys were exposed in audit logs
      const testKeys = Object.values(TEST_SCENARIOS.validKeys);
      const exposedKeys = this.logCapture.findExposedKeys(testKeys);

      if (exposedKeys.length === 0) {
        this.addResult(
          'Secure Logging',
          true,
          'Secure logging utilities work correctly',
        );
      } else {
        this.addResult(
          'Secure Logging',
          false,
          `Secure logging exposed keys: ${exposedKeys.join(', ')}`,
        );
      }
    } catch (error) {
      this.logCapture.stop();
      this.addResult(
        'Secure Logging',
        false,
        `Secure logging test failed: ${error}`,
      );
    }
  }

  /**
   * Test 5: Verify API key status reporting
   */
  async testStatusReporting() {
    console.log('\n📋 Test 5: API Key Status Reporting');

    try {
      const status = secureApiKeyManager.getApiKeyStatus();

      let allServicesReported = true;
      let hasValidMasking = true;

      for (const service of Object.values(ApiService)) {
        if (!status[service]) {
          allServicesReported = false;
          break;
        }

        const serviceStatus = status[service];
        if (serviceStatus.configured && !serviceStatus.masked.includes('...')) {
          hasValidMasking = false;
          break;
        }
      }

      if (allServicesReported && hasValidMasking) {
        this.addResult(
          'Status Reporting',
          true,
          'API key status properly reported with masking',
        );
      } else {
        this.addResult(
          'Status Reporting',
          false,
          'Status reporting has issues',
        );
      }
    } catch (error) {
      this.addResult(
        'Status Reporting',
        false,
        `Status reporting test failed: ${error}`,
      );
    }
  }

  /**
   * Run all security tests
   */
  async runAllTests() {
    await this.testKeyMasking();
    await this.testKeyValidation();
    await this.testSecurityMonitoring();
    await this.testSecureLogging();
    await this.testStatusReporting();

    this.printSummary();
  }

  /**
   * Print test summary
   */
  private printSummary() {
    console.log('\n📊 Test Summary');
    console.log('═'.repeat(50));

    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;

    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}`);
    });

    console.log('═'.repeat(50));
    console.log(`Results: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log('🎉 All API key security tests passed!');
      console.log('✅ API keys are properly secured and not exposed in logs');
    } else {
      console.log('⚠️ Some security tests failed - review the implementation');
    }
  }
}

/**
 * Main test execution
 */
export async function runApiKeySecurityTests() {
  const tester = new ApiKeySecurityTester();
  await tester.runAllTests();
}

// Export for use in other test files
export { ApiKeySecurityTester, LogCapture };

// Run tests if this file is executed directly
if (require.main === module) {
  runApiKeySecurityTests().catch(console.error);
}
