import { Location } from 'fhir/r4b';
import {
  CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
  FHIR_IDENTIFIER_CLIA,
  FHIR_IDENTIFIER_NPI,
  SaveServiceFacilityInput,
} from 'utils';
import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../../src/billing/save-billing-service-facility/validateRequestParameters';
import { applyServiceFacilityInput, mapServiceFacility } from '../../src/billing/service-facility.helpers';
import type { ZambdaInput } from '../../src/shared/types/common';

function makeInput(body: Record<string, unknown> | null): ZambdaInput {
  return {
    headers: null,
    body: body ? JSON.stringify(body) : (null as unknown as string),
    secrets: {} as ZambdaInput['secrets'],
  };
}

const validPayload: SaveServiceFacilityInput = {
  name: 'Main Street Clinic',
  addressLine1: '123 Main St',
  addressLine2: 'Suite 200',
  city: 'Boston',
  state: 'MA',
  zip: '02118',
  zipPlus4: '1234',
  npi: '1234567893',
  clia: '05D1234567',
  posCode: '11',
};

describe('save-billing-service-facility validateRequestParameters', () => {
  it('returns validated params for a fully valid payload', () => {
    const result = validateRequestParameters(makeInput({ ...validPayload }));
    expect(result).toMatchObject(validPayload);
  });

  it('accepts a minimal payload (required fields only)', () => {
    const result = validateRequestParameters(
      makeInput({
        name: 'X',
        addressLine1: '1 A St',
        city: 'Boston',
        state: 'MA',
        zip: '02118',
      })
    );
    expect(result.name).toBe('X');
    expect(result.npi).toBeUndefined();
  });

  it('rejects an NPI with an invalid check digit', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          ...validPayload,
          npi: '1234567890',
        })
      )
    ).toThrow(/NPI/);
  });

  it('rejects a malformed CLIA number', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          ...validPayload,
          clia: '05d1234567',
        })
      )
    ).toThrow(/CLIA/);
  });

  it('rejects an unknown place of service code', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          ...validPayload,
          posCode: '00',
        })
      )
    ).toThrow(/place of service/i);
  });

  it('rejects a non-5-digit ZIP', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          ...validPayload,
          zip: '021',
        })
      )
    ).toThrow(/ZIP/);
  });

  it('rejects an unknown state code', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          ...validPayload,
          state: 'California',
        })
      )
    ).toThrow(/state/i);
  });

  it('rejects a missing name', () => {
    const { name: _name, ...rest } = validPayload;
    expect(() => validateRequestParameters(makeInput(rest))).toThrow();
  });

  it('throws when secrets are missing', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: JSON.stringify(validPayload),
        secrets: null,
      } as ZambdaInput)
    ).toThrow();
  });
});

describe('applyServiceFacilityInput', () => {
  it('builds a new active Location with all fields', () => {
    const location = applyServiceFacilityInput(validPayload);
    expect(location.resourceType).toBe('Location');
    expect(location.status).toBe('active');
    expect(location.name).toBe('Main Street Clinic');
    expect(location.address?.line).toEqual(['123 Main St', 'Suite 200']);
    expect(location.address?.postalCode).toBe('02118-1234');
    expect(location.identifier).toContainEqual({
      system: FHIR_IDENTIFIER_NPI,
      value: '1234567893',
    });
    expect(location.identifier).toContainEqual({
      system: FHIR_IDENTIFIER_CLIA,
      value: '05D1234567',
    });
    expect(location.extension).toContainEqual({
      url: CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
      valueString: '11',
    });
  });

  it('omits the ZIP+4 suffix when not provided', () => {
    const location = applyServiceFacilityInput({
      ...validPayload,
      zipPlus4: undefined,
    });
    expect(location.address?.postalCode).toBe('02118');
  });

  it('leaves existing identifiers and POS extension untouched when those params are omitted', () => {
    const existing: Location = {
      resourceType: 'Location',
      id: 'loc-1',
      status: 'active',
      identifier: [
        {
          system: FHIR_IDENTIFIER_NPI,
          value: '1234567893',
        },
        {
          system: FHIR_IDENTIFIER_CLIA,
          value: '05D1234567',
        },
      ],
      extension: [
        {
          url: CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
          valueString: '11',
        },
      ],
    };
    const location = applyServiceFacilityInput(
      {
        name: 'Renamed',
        addressLine1: '1 A St',
        city: 'Boston',
        state: 'MA',
        zip: '02118',
      },
      existing
    );
    expect(location.id).toBe('loc-1');
    expect(location.name).toBe('Renamed');
    expect(location.identifier).toContainEqual({
      system: FHIR_IDENTIFIER_NPI,
      value: '1234567893',
    });
    expect(location.identifier).toContainEqual({
      system: FHIR_IDENTIFIER_CLIA,
      value: '05D1234567',
    });
    expect(location.extension).toContainEqual({
      url: CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
      valueString: '11',
    });
  });

  it('clears the NPI, CLIA, and POS extension when null is passed, leaving unrelated identifiers', () => {
    const existing: Location = {
      resourceType: 'Location',
      id: 'loc-1',
      status: 'active',
      identifier: [
        {
          system: FHIR_IDENTIFIER_NPI,
          value: '1234567893',
        },
        {
          system: FHIR_IDENTIFIER_CLIA,
          value: '05D1234567',
        },
        {
          system: 'https://example.com/other',
          value: 'keep-me',
        },
      ],
      extension: [
        {
          url: CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
          valueString: '11',
        },
      ],
    };
    const location = applyServiceFacilityInput(
      {
        ...validPayload,
        npi: null,
        clia: null,
        posCode: null,
      },
      existing
    );
    expect(location.identifier).toEqual([
      {
        system: 'https://example.com/other',
        value: 'keep-me',
      },
    ]);
    expect(location.extension).toBeUndefined();
  });

  it('accepts null for clearable fields through the schema', () => {
    const result = validateRequestParameters(
      makeInput({
        ...validPayload,
        npi: null,
        clia: null,
        posCode: null,
      })
    );
    expect(result.npi).toBeNull();
    expect(result.clia).toBeNull();
    expect(result.posCode).toBeNull();
  });

  it('replaces an existing NPI in place without duplicating it', () => {
    const existing: Location = {
      resourceType: 'Location',
      id: 'loc-1',
      status: 'active',
      identifier: [
        {
          system: FHIR_IDENTIFIER_NPI,
          value: '1234567893',
        },
      ],
    };
    const location = applyServiceFacilityInput(
      {
        ...validPayload,
        npi: '1245319599',
        clia: undefined,
      },
      existing
    );
    const updatedNpi = (location.identifier ?? []).filter((identifier) => identifier.system === FHIR_IDENTIFIER_NPI);
    expect(updatedNpi).toEqual([
      {
        system: FHIR_IDENTIFIER_NPI,
        value: '1245319599',
      },
    ]);
  });

  it('preserves unmanaged fields and non-NPI/CLIA identifiers on update', () => {
    const existing: Location = {
      resourceType: 'Location',
      id: 'loc-1',
      status: 'active',
      telecom: [
        {
          system: 'phone',
          value: '555-1234',
        },
      ],
      identifier: [
        {
          system: 'https://example.com/other',
          value: 'keep-me',
        },
      ],
    };
    const location = applyServiceFacilityInput(validPayload, existing);
    expect(location.telecom).toEqual([
      {
        system: 'phone',
        value: '555-1234',
      },
    ]);
    expect(location.identifier).toContainEqual({
      system: 'https://example.com/other',
      value: 'keep-me',
    });
    expect(location.identifier).toContainEqual({
      system: FHIR_IDENTIFIER_NPI,
      value: '1234567893',
    });
  });
});

describe('mapServiceFacility', () => {
  it('flattens a Location into the UI shape and splits the ZIP', () => {
    const location: Location = {
      resourceType: 'Location',
      id: 'loc-1',
      status: 'active',
      name: 'Main Street Clinic',
      address: {
        line: ['123 Main St', 'Suite 200'],
        city: 'Boston',
        state: 'MA',
        postalCode: '02118-1234',
      },
      identifier: [
        {
          system: FHIR_IDENTIFIER_NPI,
          value: '1234567893',
        },
        {
          system: FHIR_IDENTIFIER_CLIA,
          value: '05D1234567',
        },
      ],
      extension: [
        {
          url: CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
          valueString: '11',
        },
      ],
    };
    expect(mapServiceFacility(location)).toEqual({
      id: 'loc-1',
      name: 'Main Street Clinic',
      addressLine1: '123 Main St',
      addressLine2: 'Suite 200',
      city: 'Boston',
      state: 'MA',
      zip: '02118',
      zipPlus4: '1234',
      npi: '1234567893',
      clia: '05D1234567',
      posCode: '11',
      status: 'active',
    });
  });

  it('reports inactive status and tolerates missing optional fields', () => {
    const location: Location = {
      resourceType: 'Location',
      id: 'loc-2',
      status: 'inactive',
      name: 'Sparse',
    };
    const mapped = mapServiceFacility(location);
    expect(mapped.status).toBe('inactive');
    expect(mapped.zip).toBe('');
    expect(mapped.npi).toBe('');
    expect(mapped.posCode).toBe('');
  });
});
