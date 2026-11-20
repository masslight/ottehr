import { describe, expect, it } from 'vitest';
import manifest from './data/2026-11/manifest.json';
import fixture from './test-data/cdsi-test-cases.json';

// The CDC and AIRA downloads are not committed. What is committed is each one's file name, the URL it was
// downloaded from and its SHA-256, so the same file can be fetched again and checked.
describe('schedule data sources', () => {
  const SHA256 = /^[0-9a-f]{64}$/;

  it('records the download URL and SHA-256 of each supporting-data archive', () => {
    expect(manifest.sources.map((source) => source.file)).toEqual(['supporting-data-4.64-508.zip', 'Version 26.1.zip']);
    for (const source of manifest.sources) {
      expect(source.downloadedFrom, source.file).toMatch(/^https:\/\//);
      expect(source.sha256, source.file).toMatch(SHA256);
    }
  });

  it('records the download URL and SHA-256 of the CDC test-case workbook', () => {
    expect(fixture.source).toBe('CDSi_Healthy_Childhood_and_Adult_Test_Cases_v4.45.xlsx');
    expect(fixture.downloadedFrom).toMatch(/^https:\/\//);
    expect(fixture.sha256).toMatch(SHA256);
  });
});
