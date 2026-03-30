/**
 * M-04: Device Metadata Collection Tests
 *
 * Audit finding: Verify that production code does not collect unique device
 * identifiers (IMEI, serial number, MAC address) which would constitute
 * collecting personal information from children under COPPA.
 *
 * The setupAfterEnv.ts fingerprint helper is test-only and must not be
 * imported in production code.
 *
 * @implements M-04
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

function readSourceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(PROJECT_ROOT, relativePath), 'utf-8');
}

function findAllFiles(
  dir: string,
  ext: string,
  excludeDirs: string[] = [
    '__tests__',
    'node_modules',
    '.expo',
    'build',
    'ios',
    'android',
  ],
): string[] {
  const resolvedDir = path.isAbsolute(dir)
    ? dir
    : path.resolve(PROJECT_ROOT, dir);
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(resolvedDir, entry.name);
    if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
      results.push(...findAllFiles(fullPath, ext, excludeDirs));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('M-04: Device Metadata Collection', () => {
  test('[M-04] Production services do not collect IMEI or serial number', () => {
    const serviceFiles = findAllFiles('src/services', '.ts');
    for (const file of serviceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(PROJECT_ROOT, file);
      // Must not reference unique device identifiers
      expect(content).not.toMatch(
        /\bIMEI\b|getSerialNumber|getUniqueId\(\)|DeviceInfo\.getUniqueId/,
      );
    }
  });

  test('[M-04] setupAfterEnv.ts fingerprint helper is test-only (not imported in src/)', () => {
    const srcFiles = [
      ...findAllFiles('src/services', '.ts'),
      ...findAllFiles('src/screens', '.tsx'),
      ...findAllFiles('src/components', '.tsx'),
      ...findAllFiles('src/context', '.tsx'),
    ];
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      // No production file should import setupAfterEnv or device fingerprint test helpers
      expect(content).not.toMatch(/setupAfterEnv|toBeValidDeviceFingerprint/);
    }
  });

  test('[M-04] Convex schema does not store device IMEI/serial fields', () => {
    const schemaSource = readSourceFile('convex/schema.ts');
    // Schema must not define IMEI or serial number fields
    expect(schemaSource).not.toMatch(/imei|serialNumber|deviceSerial/i);
  });
});
