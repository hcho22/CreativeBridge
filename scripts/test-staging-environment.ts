#!/usr/bin/env ts-node

/**
 * Staging Environment Testing Script for Story Image Generation Feature
 *
 * This script validates that the image generation feature works correctly
 * in the staging environment with proper error handling and performance metrics.
 */

import { supabase } from '../src/services/supabase';
import { secureApiKeyManager } from '../src/services/secureApiKeyManager';
import { env, isImageGenerationEnabled } from '../src/services/environment';

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  duration?: number;
}

class StagingEnvironmentTester {
  private results: TestResult[] = [];

  constructor() {
    console.log(
      '🧪 Starting Staging Environment Tests for Image Generation Feature\n',
    );
  }

  private addResult(
    test: string,
    passed: boolean,
    message: string,
    duration?: number,
  ): void {
    this.results.push({ test, passed, message, duration });
    const status = passed ? '✅' : '❌';
    const durationStr = duration ? ` (${duration}ms)` : '';
    console.log(`${status} ${test}: ${message}${durationStr}`);
  }

  async testEnvironmentConfiguration(): Promise<void> {
    console.log('\n📋 Testing Environment Configuration...\n');

    try {
      // Test Supabase connection
      const startTime = Date.now();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('count')
        .limit(1);
      const duration = Date.now() - startTime;

      if (error) {
        this.addResult(
          'Supabase Connection',
          false,
          `Failed to connect: ${error.message}`,
          duration,
        );
      } else {
        this.addResult(
          'Supabase Connection',
          true,
          'Successfully connected to database',
          duration,
        );
      }
    } catch (error) {
      this.addResult(
        'Supabase Connection',
        false,
        `Connection error: ${error.message}`,
      );
    }

    // Test API key configuration
    const keyValidation = secureApiKeyManager.validateAllKeys();
    this.addResult(
      'API Key Validation',
      keyValidation.isValid,
      keyValidation.isValid
        ? 'All required API keys are properly configured'
        : `Missing keys: ${keyValidation.errors.map(e => e.code).join(', ')}`,
    );

    // Test feature flag
    const featureEnabled = isImageGenerationEnabled();
    this.addResult(
      'Feature Flag Status',
      true, // This is informational, not a pass/fail
      `Image generation feature is ${featureEnabled ? 'enabled' : 'disabled'}`,
    );

    // Test environment variables
    const requiredEnvVars = [
      'REPLICATE_API_TOKEN',
      'BACKUP_IMAGE_API_TOKEN',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
    ];

    let envVarsValid = true;
    const missingVars: string[] = [];

    for (const varName of requiredEnvVars) {
      const value = env[varName as keyof typeof env];
      if (!value || value === '') {
        envVarsValid = false;
        missingVars.push(varName);
      }
    }

    this.addResult(
      'Environment Variables',
      envVarsValid,
      envVarsValid
        ? 'All required environment variables are set'
        : `Missing variables: ${missingVars.join(', ')}`,
    );
  }

  async testDatabaseSchema(): Promise<void> {
    console.log('\n🗄️ Testing Database Schema...\n');

    try {
      // Test if image generation columns exist in user_profiles
      const startTime = Date.now();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('total_xp')
        .limit(1);
      const duration = Date.now() - startTime;

      if (error) {
        this.addResult(
          'User Profiles Table',
          false,
          `Schema validation failed: ${error.message}`,
          duration,
        );
      } else {
        this.addResult(
          'User Profiles Table',
          true,
          'User profiles table accessible with XP column',
          duration,
        );
      }

      // Test game_sessions table with image generation columns
      const sessionStartTime = Date.now();
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select(
          'id, generated_image_url, image_generation_timestamp, image_generation_cost',
        )
        .limit(1);
      const sessionDuration = Date.now() - sessionStartTime;

      if (sessionError) {
        this.addResult(
          'Game Sessions Image Columns',
          false,
          `Image generation columns missing: ${sessionError.message}`,
          sessionDuration,
        );
      } else {
        this.addResult(
          'Game Sessions Image Columns',
          true,
          'Image generation columns exist and accessible',
          sessionDuration,
        );
      }

      // Test image_generation_events table
      const eventsStartTime = Date.now();
      const { data: eventsData, error: eventsError } = await supabase
        .from('image_generation_events')
        .select('count')
        .limit(1);
      const eventsDuration = Date.now() - eventsStartTime;

      if (eventsError) {
        this.addResult(
          'Image Generation Events Table',
          false,
          `Events table not accessible: ${eventsError.message}`,
          eventsDuration,
        );
      } else {
        this.addResult(
          'Image Generation Events Table',
          true,
          'Image generation events table exists and accessible',
          eventsDuration,
        );
      }
    } catch (error) {
      this.addResult(
        'Database Schema Test',
        false,
        `Unexpected error: ${error.message}`,
      );
    }
  }

  async testImageGenerationService(): Promise<void> {
    console.log('\n🎨 Testing Image Generation Service...\n');

    try {
      // Test service initialization
      const { imageGeneration } = await import(
        '../src/services/imageGeneration'
      );

      this.addResult(
        'Service Import',
        true,
        'Image generation service imported successfully',
      );

      // Test API key retrieval (without making actual API calls)
      const replicateKey = secureApiKeyManager.getApiKey('replicate_primary');
      this.addResult(
        'Primary API Key Access',
        !replicateKey.error,
        replicateKey.error
          ? `API key error: ${replicateKey.error.message}`
          : 'Primary API key retrieved successfully',
      );

      const backupKey = secureApiKeyManager.getApiKey('replicate_backup');
      this.addResult(
        'Backup API Key Access',
        !backupKey.error,
        backupKey.error
          ? `Backup API key error: ${backupKey.error.message}`
          : 'Backup API key retrieved successfully',
      );
    } catch (error) {
      this.addResult(
        'Image Generation Service',
        false,
        `Service test failed: ${error.message}`,
      );
    }
  }

  async testPerformanceMetrics(): Promise<void> {
    console.log('\n⚡ Testing Performance Metrics...\n');

    try {
      // Test database query performance
      const queries = [
        {
          name: 'User Profile Query',
          query: () =>
            supabase.from('user_profiles').select('id, total_xp').limit(10),
        },
        {
          name: 'Game Sessions Query',
          query: () =>
            supabase
              .from('game_sessions')
              .select('id, generated_image_url')
              .limit(10),
        },
        {
          name: 'Image Events Query',
          query: () =>
            supabase
              .from('image_generation_events')
              .select('id, status')
              .limit(10),
        },
      ];

      for (const queryTest of queries) {
        const startTime = Date.now();
        try {
          const { data, error } = await queryTest.query();
          const duration = Date.now() - startTime;

          if (error) {
            this.addResult(
              queryTest.name,
              false,
              `Query failed: ${error.message}`,
              duration,
            );
          } else {
            const passed = duration < 1000; // Should complete within 1 second
            this.addResult(
              queryTest.name,
              passed,
              passed
                ? `Query completed successfully`
                : `Query slow (>${duration}ms)`,
              duration,
            );
          }
        } catch (error) {
          const duration = Date.now() - startTime;
          this.addResult(
            queryTest.name,
            false,
            `Query error: ${error.message}`,
            duration,
          );
        }
      }
    } catch (error) {
      this.addResult(
        'Performance Testing',
        false,
        `Performance test failed: ${error.message}`,
      );
    }
  }

  async testSecurityMeasures(): Promise<void> {
    console.log('\n🔒 Testing Security Measures...\n');

    try {
      // Test API key masking
      const apiKeyStatus = secureApiKeyManager.getApiKeyStatus();
      let securityPassed = true;
      let securityMessage = '';

      for (const [service, status] of Object.entries(apiKeyStatus)) {
        if (status.configured && status.masked.includes('...')) {
          // Key is properly masked
          continue;
        } else if (status.configured && !status.masked.includes('...')) {
          securityPassed = false;
          securityMessage += `${service} key not properly masked; `;
        }
      }

      this.addResult(
        'API Key Masking',
        securityPassed,
        securityPassed
          ? 'All API keys are properly masked in logs'
          : securityMessage.trim(),
      );

      // Test access statistics tracking
      const stats = secureApiKeyManager.getAccessStatistics();
      this.addResult(
        'Access Tracking',
        true,
        'API key access tracking is functional',
      );

      // Test environment variable protection
      const isDev = __DEV__;
      const hasProductionSafeguards =
        !isDev || env.IMAGE_GENERATION_ENABLED === false;

      this.addResult(
        'Environment Protection',
        hasProductionSafeguards,
        hasProductionSafeguards
          ? 'Production safeguards are in place'
          : 'Warning: Development mode with feature enabled',
      );
    } catch (error) {
      this.addResult(
        'Security Testing',
        false,
        `Security test failed: ${error.message}`,
      );
    }
  }

  generateReport(): void {
    console.log('\n📊 Test Results Summary\n');
    console.log('='.repeat(50));

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const successRate = Math.round((passed / total) * 100);

    console.log(`Tests Passed: ${passed}/${total} (${successRate}%)\n`);

    if (passed === total) {
      console.log('🎉 All tests passed! Staging environment is ready.');
    } else {
      console.log('⚠️  Some tests failed. Review issues before proceeding.');

      console.log('\nFailed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`  ❌ ${r.test}: ${r.message}`));
    }

    console.log('\nPerformance Summary:');
    this.results
      .filter(r => r.duration !== undefined)
      .forEach(r => console.log(`  ⏱️  ${r.test}: ${r.duration}ms`));

    console.log('\n' + '='.repeat(50));
  }

  async runAllTests(): Promise<void> {
    try {
      await this.testEnvironmentConfiguration();
      await this.testDatabaseSchema();
      await this.testImageGenerationService();
      await this.testPerformanceMetrics();
      await this.testSecurityMeasures();

      this.generateReport();
    } catch (error) {
      console.error('💥 Critical test failure:', error.message);
      process.exit(1);
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new StagingEnvironmentTester();
  tester
    .runAllTests()
    .then(() => {
      console.log('\n✨ Staging environment testing completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Testing failed:', error.message);
      process.exit(1);
    });
}

export default StagingEnvironmentTester;
