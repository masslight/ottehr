import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import {
  findCurrentOrderFormDocRef,
  getReusableOrderFormUrl,
  makeOrderFormVersion,
} from '../../src/shared/order-form-version';

const SYSTEM = 'https://fhir.example/Identifier/form-version';
const version = makeOrderFormVersion(1, [{ resourceType: 'ServiceRequest', id: 'sr-1', meta: { versionId: '1' } }]);

const stored = (over: Partial<DocumentReference> = {}): DocumentReference => ({
  resourceType: 'DocumentReference',
  status: 'current',
  content: [{ attachment: { url: 'z3://forms/form.pdf' } }],
  identifier: [{ system: SYSTEM, value: version }],
  ...over,
});

describe('getReusableOrderFormUrl', () => {
  it('reuses a stored form drawn from exactly the current sources', () => {
    expect(getReusableOrderFormUrl(stored(), SYSTEM, version)).toBe('z3://forms/form.pdf');
  });

  it('draws again when any source has moved on', () => {
    expect(getReusableOrderFormUrl(stored(), SYSTEM, `${version}x`)).toBeUndefined();
  });

  it('reads only its own form type identifier, so another form version stamped on it does not count', () => {
    expect(
      getReusableOrderFormUrl(
        stored({ identifier: [{ system: 'https://fhir.example/other', value: version }] }),
        SYSTEM,
        version
      )
    ).toBeUndefined();
  });

  it('draws again when a source is unversioned, even if the stored form carries no version either', () => {
    expect(getReusableOrderFormUrl(stored({ identifier: undefined }), SYSTEM, undefined)).toBeUndefined();
  });

  it('draws again when the stored form has no file', () => {
    expect(getReusableOrderFormUrl(stored({ content: [] as never }), SYSTEM, version)).toBeUndefined();
  });

  it('draws when there is no stored form', () => {
    expect(getReusableOrderFormUrl(undefined, SYSTEM, version)).toBeUndefined();
  });
});

describe('findCurrentOrderFormDocRef', () => {
  it('takes the newest current form of the given type for the order, as racing prints can leave two', async () => {
    const newest = stored({ id: 'newest' });
    const search = vi.fn().mockResolvedValue({ unbundle: () => [newest, stored({ id: 'older' })] });

    const found = await findCurrentOrderFormDocRef({ fhir: { search } } as unknown as Oystehr, 'DeviceRequest/dr-1', {
      system: 'https://fhir.example/doc-type',
      code: 'dme-order-form',
    });

    expect(found).toBe(newest);
    expect(search).toHaveBeenCalledWith({
      resourceType: 'DocumentReference',
      params: [
        { name: 'related', value: 'DeviceRequest/dr-1' },
        { name: 'type', value: 'https://fhir.example/doc-type|dme-order-form' },
        { name: 'status', value: 'current' },
        { name: '_sort', value: '-date' },
      ],
    });
  });
});
