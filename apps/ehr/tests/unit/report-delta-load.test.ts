import { describe, expect, it } from 'vitest';
import { gzipSync } from 'zlib';
import { readReportDataBytes } from '../../src/features/report-builder/query/dataset-query';
import { mergeRows } from '../../src/features/report-builder/query/merge-rows';

describe('ad-hoc delta load: mergeRows', () => {
  const prev = [
    { encounterId: 'e1', patientName: 'Old name', icdCodes: ['J45'] },
    { encounterId: 'e2', patientName: 'B', icdCodes: [] },
  ];

  it('keeps the earlier layers and takes the base and the new layer from the new rows', () => {
    const next = [
      { encounterId: 'e2', patientName: 'B', temperatureF: 98.6 },
      { encounterId: 'e1', patientName: 'New name', temperatureF: 101 },
    ];
    expect(mergeRows(prev, next, 'encounterId')).toEqual([
      { encounterId: 'e2', patientName: 'B', icdCodes: [], temperatureF: 98.6 },
      { encounterId: 'e1', patientName: 'New name', icdCodes: ['J45'], temperatureF: 101 },
    ]);
  });

  it('gives up when the rows are not the same set (added, removed or unkeyed rows)', () => {
    expect(mergeRows(prev, [{ encounterId: 'e1' }], 'encounterId')).toBeNull();
    expect(mergeRows(prev, [{ encounterId: 'e1' }, { encounterId: 'e3' }], 'encounterId')).toBeNull();
    expect(mergeRows([{ encounterId: '' }], [{ encounterId: '' }], 'encounterId')).toBeNull();
    expect(mergeRows([{ id: 'a' }, { id: 'a' }], [{ id: 'a' }, { id: 'a' }], 'id')).toBeNull();
  });
});

describe('ad-hoc report data file', () => {
  const json = JSON.stringify({ encounters: [{ encounterId: 'e1' }] });

  it('inflates a gzip file', async () => {
    expect(await readReportDataBytes(new Uint8Array(gzipSync(Buffer.from(json))))).toBe(json);
  });

  it('reads a plain JSON file from an older Task as is', async () => {
    expect(await readReportDataBytes(new TextEncoder().encode(json))).toBe(json);
  });
});
