import Oystehr from '@oystehr/sdk';
import { Attachment, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createFilesDocumentReferences } from 'utils/lib/fhir/helpers';
import {
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_ID,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_FRONT_ID,
} from 'utils/lib/types/data/paperwork/paperwork.constants';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createDocumentResources } from '../../src/ehr/shared/harvest';

vi.mock('utils/lib/fhir/helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/fhir/helpers')>();
  return { ...original, createFilesDocumentReferences: vi.fn() };
});

const mockCreateFilesDocumentReferences = vi.mocked(createFilesDocumentReferences);
const NOW = '2026-11-09T12:00:00.000Z';

const attachment = (url: string, creation?: string): Attachment => ({
  url,
  title: url.split('/').pop(),
  contentType: 'image/jpeg',
  ...(creation !== undefined ? { creation } : {}),
});

const harvestDateFor = async (entries: { linkId: string; attachment: Attachment }[]): Promise<string> => {
  const questionnaireResponse: QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    status: 'in-progress',
    item: [
      {
        linkId: 'harvested-page',
        item: entries.map(({ linkId, attachment: valueAttachment }) => ({ linkId, answer: [{ valueAttachment }] })),
      },
    ],
  };
  await createDocumentResources(questionnaireResponse, 'pat-1', 'appt-1', {} as unknown as Oystehr, [], []);
  expect(mockCreateFilesDocumentReferences).toHaveBeenCalledTimes(1);
  return mockCreateFilesDocumentReferences.mock.calls[0][0].dateCreated;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date(NOW), toFake: ['Date'] });
  mockCreateFilesDocumentReferences.mockResolvedValue({ docRefs: [], listResources: undefined });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createDocumentResources DocumentReference date', () => {
  test('uses the harvest time when no attachment in the group has a creation time', async () => {
    const date = await harvestDateFor([
      { linkId: PHOTO_ID_FRONT_ID, attachment: attachment('z3://b/front.jpg') },
      { linkId: PHOTO_ID_BACK_ID, attachment: attachment('z3://b/back.jpg') },
    ]);
    expect(DateTime.fromISO(date).toMillis()).toBe(DateTime.fromISO(NOW).toMillis());
  });

  test.each(['', '   ', 'not-a-date'])('uses the harvest time when the only creation time is %j', async (creation) => {
    const date = await harvestDateFor([
      { linkId: INSURANCE_CARD_FRONT_ID, attachment: attachment('z3://b/front.jpg', creation) },
    ]);
    expect(DateTime.fromISO(date).toMillis()).toBe(DateTime.fromISO(NOW).toMillis());
  });

  test('uses the earliest valid creation time and skips attachments without one', async () => {
    const date = await harvestDateFor([
      { linkId: INSURANCE_CARD_FRONT_ID, attachment: attachment('z3://b/front.jpg', 'garbage') },
      { linkId: INSURANCE_CARD_BACK_ID, attachment: attachment('z3://b/back.jpg', '2026-08-01T10:00:00Z') },
    ]);
    expect(date).toBe('2026-08-01T10:00:00Z');
  });
});
