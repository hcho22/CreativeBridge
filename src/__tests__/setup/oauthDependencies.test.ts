/**
 * OAuth Dependencies Verification Tests
 *
 * These tests verify that all required OAuth dependencies are installed
 * according to Task 1.2 of the OAuth implementation plan.
 *
 * Based on: TASKS-oauth-google-apple-signin-PRD.md
 */

import { ClerkProvider } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

describe('OAuth Dependencies', () => {
  describe('@clerk/clerk-expo', () => {
    test('is installed and ClerkProvider is available', () => {
      expect(ClerkProvider).toBeDefined();
      expect(typeof ClerkProvider).toBe('function');
    });

    test('can be imported without errors', () => {
      expect(() => {
        require('@clerk/clerk-expo');
      }).not.toThrow();
    });
  });

  describe('expo-web-browser', () => {
    test('is installed and WebBrowser is available', () => {
      expect(WebBrowser).toBeDefined();
      expect(WebBrowser).toBeTruthy();
    });

    test('openAuthSessionAsync function exists', () => {
      expect(WebBrowser.openAuthSessionAsync).toBeDefined();
      expect(typeof WebBrowser.openAuthSessionAsync).toBe('function');
    });

    test('can be imported without errors', () => {
      expect(() => {
        require('expo-web-browser');
      }).not.toThrow();
    });
  });

  describe('expo-linking', () => {
    test('is installed and Linking is available', () => {
      expect(Linking).toBeDefined();
      expect(Linking).toBeTruthy();
    });

    test('openURL function exists', () => {
      expect(Linking.openURL).toBeDefined();
      expect(typeof Linking.openURL).toBe('function');
    });

    test('parse function exists', () => {
      expect(Linking.parse).toBeDefined();
      expect(typeof Linking.parse).toBe('function');
    });

    test('can be imported without errors', () => {
      expect(() => {
        require('expo-linking');
      }).not.toThrow();
    });
  });

  describe('@supabase/supabase-js', () => {
    test('is installed and can be imported', () => {
      expect(() => {
        const supabase = require('@supabase/supabase-js');
        expect(supabase).toBeDefined();
        expect(supabase.createClient).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('package.json verification', () => {
    test('package.json includes @clerk/clerk-expo', () => {
      const packageJson = require('../../../package.json');
      expect(packageJson.dependencies['@clerk/clerk-expo']).toBeDefined();
      expect(packageJson.dependencies['@clerk/clerk-expo']).toBeTruthy();
    });

    test('package.json includes expo-web-browser', () => {
      const packageJson = require('../../../package.json');
      expect(packageJson.dependencies['expo-web-browser']).toBeDefined();
      expect(packageJson.dependencies['expo-web-browser']).toBeTruthy();
    });

    test('package.json includes expo-linking', () => {
      const packageJson = require('../../../package.json');
      expect(packageJson.dependencies['expo-linking']).toBeDefined();
      expect(packageJson.dependencies['expo-linking']).toBeTruthy();
    });

    test('package.json includes @supabase/supabase-js', () => {
      const packageJson = require('../../../package.json');
      expect(packageJson.dependencies['@supabase/supabase-js']).toBeDefined();
      expect(packageJson.dependencies['@supabase/supabase-js']).toBeTruthy();
    });
  });

  describe('TypeScript types', () => {
    test('ClerkProvider has correct type', () => {
      // TypeScript will catch type errors at compile time
      // This test ensures the import works at runtime
      expect(ClerkProvider).toBeDefined();
    });

    test('WebBrowser has correct type', () => {
      expect(WebBrowser).toBeDefined();
      expect(WebBrowser.openAuthSessionAsync).toBeDefined();
    });

    test('Linking has correct type', () => {
      expect(Linking).toBeDefined();
      expect(Linking.openURL).toBeDefined();
      expect(Linking.parse).toBeDefined();
    });
  });

  describe('Dependency compatibility', () => {
    test('all dependencies can be imported together', () => {
      expect(() => {
        const Clerk = require('@clerk/clerk-expo');
        const WebBrowserModule = require('expo-web-browser');
        const LinkingModule = require('expo-linking');
        const Supabase = require('@supabase/supabase-js');

        expect(Clerk).toBeDefined();
        expect(WebBrowserModule).toBeDefined();
        expect(LinkingModule).toBeDefined();
        expect(Supabase).toBeDefined();
      }).not.toThrow();
    });
  });
});
