// Jest Tests for Task 1: Install Required Dependencies

// Mock react-native-document-picker for testing
jest.mock('react-native-document-picker', () => ({
  pick: jest.fn(),
  types: {
    allFiles: 'public.data',
    plainText: 'public.plain-text',
  },
}));

describe('Dependencies Setup', () => {
  it('should have react-native-document-picker package installed', () => {
    // Check that the package is listed in package.json dependencies
    const packageJson = require('../../../package.json');
    expect(
      packageJson.dependencies['react-native-document-picker'],
    ).toBeDefined();
  });

  it('should have supabase dependencies available', () => {
    expect(() => require('@supabase/supabase-js')).not.toThrow();
  });

  it('should be able to import DocumentPicker from react-native-document-picker', () => {
    const DocumentPicker = require('react-native-document-picker');
    expect(DocumentPicker).toBeDefined();
    expect(typeof DocumentPicker.pick).toBe('function');
    expect(DocumentPicker.types).toBeDefined();
  });

  it('should be able to import createClient from supabase', () => {
    const { createClient } = require('@supabase/supabase-js');
    expect(createClient).toBeDefined();
    expect(typeof createClient).toBe('function');
  });

  it('should have the correct version of react-native-document-picker', () => {
    const packageJson = require('../../../package.json');
    const version = packageJson.dependencies['react-native-document-picker'];
    expect(version).toMatch(/^\^?9\./); // Should be version 9.x
  });

  it('should have the correct version of supabase-js', () => {
    const packageJson = require('../../../package.json');
    const version = packageJson.dependencies['@supabase/supabase-js'];
    expect(version).toMatch(/^\^?2\./); // Should be version 2.x
  });
});
