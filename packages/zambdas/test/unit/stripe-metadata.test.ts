import { describe, expect, it } from 'vitest';
import {
  encounterIdFromStripeMetadata,
  patientIdFromStripeMetadata,
  STRIPE_METADATA_KEYS,
  stripeEncounterMetadata,
  stripeEncounterMetadataQuery,
} from '../../src/shared/stripeIntegration';

describe('encounterIdFromStripeMetadata', () => {
  it('reads the current key', () => {
    const metadata = {
      [STRIPE_METADATA_KEYS.encounterId]: 'enc-1',
    };

    expect(encounterIdFromStripeMetadata(metadata)).toBe('enc-1');
  });

  it('falls back to the legacy key older charges carry', () => {
    const metadata = {
      [STRIPE_METADATA_KEYS.legacyEncounterId]: 'enc-legacy',
    };

    expect(encounterIdFromStripeMetadata(metadata)).toBe('enc-legacy');
  });

  it('prefers the current key when both are present', () => {
    const metadata = {
      [STRIPE_METADATA_KEYS.encounterId]: 'enc-1',
      [STRIPE_METADATA_KEYS.legacyEncounterId]: 'enc-legacy',
    };

    expect(encounterIdFromStripeMetadata(metadata)).toBe('enc-1');
  });

  it('treats a cleared value as absent, since stripe stores it as an empty string', () => {
    const metadata = {
      [STRIPE_METADATA_KEYS.encounterId]: '',
      [STRIPE_METADATA_KEYS.legacyEncounterId]: 'enc-legacy',
    };

    expect(encounterIdFromStripeMetadata(metadata)).toBe('enc-legacy');
  });

  it('returns undefined for empty, null and undefined metadata', () => {
    expect(encounterIdFromStripeMetadata({})).toBeUndefined();
    expect(encounterIdFromStripeMetadata(null)).toBeUndefined();
    expect(encounterIdFromStripeMetadata(undefined)).toBeUndefined();
  });
});

describe('patientIdFromStripeMetadata', () => {
  it('reads the patient key', () => {
    const metadata = {
      [STRIPE_METADATA_KEYS.patientId]: 'pat-1',
    };

    expect(patientIdFromStripeMetadata(metadata)).toBe('pat-1');
  });

  it('returns undefined for a cleared value or missing metadata', () => {
    const metadata = {
      [STRIPE_METADATA_KEYS.patientId]: '',
    };

    expect(patientIdFromStripeMetadata(metadata)).toBeUndefined();
    expect(patientIdFromStripeMetadata(undefined)).toBeUndefined();
  });
});

describe('stripeEncounterMetadata', () => {
  it('round trips through the accessors', () => {
    const metadata = stripeEncounterMetadata({
      encounterId: 'enc-1',
      patientId: 'pat-1',
    });

    expect(metadata).toEqual({
      [STRIPE_METADATA_KEYS.patientId]: 'pat-1',
      [STRIPE_METADATA_KEYS.encounterId]: 'enc-1',
    });
    expect(encounterIdFromStripeMetadata(metadata as Record<string, string>)).toBe('enc-1');
    expect(patientIdFromStripeMetadata(metadata as Record<string, string>)).toBe('pat-1');
  });
});

describe('stripeEncounterMetadataQuery', () => {
  it('matches either encounter key', () => {
    expect(stripeEncounterMetadataQuery('enc-1')).toBe(
      `metadata['encounterId']:"enc-1" OR metadata['oystehr_encounter_id']:"enc-1"`
    );
  });
});
