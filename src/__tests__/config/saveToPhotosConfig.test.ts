/**
 * US-001: CameraRoll Library Installation & iOS Permission Configuration
 * Validates that app.json and package.json are correctly configured
 * for the Save to Photos feature.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..');

describe('US-001: CameraRoll Library & iOS Permissions Config', () => {
  let appJson: any;
  let packageJson: any;

  beforeAll(() => {
    appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf-8'));
    packageJson = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'),
    );
  });

  // ── Package Dependency ──────────────────────────────────────────

  it('has @react-native-camera-roll/camera-roll in dependencies', () => {
    expect(
      packageJson.dependencies['@react-native-camera-roll/camera-roll'],
    ).toBeDefined();
  });

  // ── iOS Permissions in react-native-permissions plugin ──────────

  describe('iosPermissions array', () => {
    let iosPermissions: string[];

    beforeAll(() => {
      const rnpPlugin = appJson.plugins.find(
        (p: any) => Array.isArray(p) && p[0] === 'react-native-permissions',
      );
      iosPermissions = rnpPlugin?.[1]?.iosPermissions ?? [];
    });

    it('contains Microphone permission (existing)', () => {
      expect(iosPermissions).toContain('Microphone');
    });

    it('contains SpeechRecognition permission (existing)', () => {
      expect(iosPermissions).toContain('SpeechRecognition');
    });

    it('contains PhotoLibraryAddOnly permission (new)', () => {
      expect(iosPermissions).toContain('PhotoLibraryAddOnly');
    });

    it('has exactly 3 iOS permissions', () => {
      expect(iosPermissions).toHaveLength(3);
    });
  });

  // ── Info.plist Keys ─────────────────────────────────────────────

  describe('iOS infoPlist', () => {
    let infoPlist: Record<string, string>;

    beforeAll(() => {
      infoPlist = appJson.ios?.infoPlist ?? {};
    });

    it('has NSMicrophoneUsageDescription (existing)', () => {
      expect(infoPlist.NSMicrophoneUsageDescription).toBeDefined();
    });

    it('has NSSpeechRecognitionUsageDescription (existing)', () => {
      expect(infoPlist.NSSpeechRecognitionUsageDescription).toBeDefined();
    });

    it('has NSPhotoLibraryUsageDescription (existing)', () => {
      expect(infoPlist.NSPhotoLibraryUsageDescription).toBeDefined();
    });

    it('has NSPhotoLibraryAddUsageDescription (new)', () => {
      expect(infoPlist.NSPhotoLibraryAddUsageDescription).toBeDefined();
      expect(infoPlist.NSPhotoLibraryAddUsageDescription).toContain(
        'Photo Library',
      );
    });
  });
});
