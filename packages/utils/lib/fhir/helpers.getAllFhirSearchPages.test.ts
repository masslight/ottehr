import { Bundle, FhirResource, Patient } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllFhirSearchPages } from './getAllFhirSearchPages';

// Mock Oystehr SDK
const mockOystehr = {
  fhir: {
    search: vi.fn(),
  },
};

describe('getAllFhirSearchPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all resources from a single page when total matches count', async () => {
    const mockPatients: Patient[] = [
      { resourceType: 'Patient', id: '1', name: [{ family: 'Smith', given: ['John'] }] },
      { resourceType: 'Patient', id: '2', name: [{ family: 'Doe', given: ['Jane'] }] },
    ];

    const mockBundle: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 2,
      entry: mockPatients.map((patient) => ({
        resource: patient,
        search: { mode: 'match' },
      })),
      link: [{ relation: 'self', url: 'http://example.com/Patient?_count=100&_offset=0' }],
    };

    // Mock unbundle method
    (mockBundle as any).unbundle = () => mockPatients;

    mockOystehr.fhir.search.mockResolvedValueOnce(mockBundle);

    const result = await getAllFhirSearchPages<Patient>(
      {
        resourceType: 'Patient',
        params: [{ name: 'name', value: 'Smith' }],
      },
      mockOystehr as any,
      100
    );

    expect(result).toEqual(mockPatients);
    expect(mockOystehr.fhir.search).toHaveBeenCalledTimes(1);
    expect(mockOystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'Patient',
      params: expect.arrayContaining([
        { name: 'name', value: 'Smith' },
        { name: '_count', value: '100' },
        { name: '_total', value: 'accurate' },
        { name: '_offset', value: '0' },
      ]),
    });
  });

  it('should fetch all resources across multiple pages', async () => {
    const page1Patients: Patient[] = [
      { resourceType: 'Patient', id: '1', name: [{ family: 'Smith', given: ['John'] }] },
      { resourceType: 'Patient', id: '2', name: [{ family: 'Doe', given: ['Jane'] }] },
    ];

    const page2Patients: Patient[] = [
      { resourceType: 'Patient', id: '3', name: [{ family: 'Brown', given: ['Bob'] }] },
      { resourceType: 'Patient', id: '4', name: [{ family: 'White', given: ['Alice'] }] },
    ];

    const page3Patients: Patient[] = [
      { resourceType: 'Patient', id: '5', name: [{ family: 'Green', given: ['Charlie'] }] },
    ];

    const mockBundle1: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 5,
      entry: page1Patients.map((patient) => ({
        resource: patient,
        search: { mode: 'match' },
      })),
      link: [
        { relation: 'self', url: 'http://example.com/Patient?_count=2&_offset=0' },
        { relation: 'next', url: 'http://example.com/Patient?_count=2&_offset=2' },
      ],
    };

    const mockBundle2: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 5,
      entry: page2Patients.map((patient) => ({
        resource: patient,
        search: { mode: 'match' },
      })),
      link: [
        { relation: 'self', url: 'http://example.com/Patient?_count=2&_offset=2' },
        { relation: 'next', url: 'http://example.com/Patient?_count=2&_offset=4' },
      ],
    };

    const mockBundle3: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 5,
      entry: page3Patients.map((patient) => ({
        resource: patient,
        search: { mode: 'match' },
      })),
      link: [{ relation: 'self', url: 'http://example.com/Patient?_count=2&_offset=4' }],
    };

    // Mock unbundle method for each bundle
    (mockBundle1 as any).unbundle = () => page1Patients;
    (mockBundle2 as any).unbundle = () => page2Patients;
    (mockBundle3 as any).unbundle = () => page3Patients;

    mockOystehr.fhir.search
      .mockResolvedValueOnce(mockBundle1)
      .mockResolvedValueOnce(mockBundle2)
      .mockResolvedValueOnce(mockBundle3);

    const result = await getAllFhirSearchPages<Patient>(
      {
        resourceType: 'Patient',
        params: [],
      },
      mockOystehr as any,
      2
    );

    expect(result).toEqual([...page1Patients, ...page2Patients, ...page3Patients]);
    expect(mockOystehr.fhir.search).toHaveBeenCalledTimes(3);
    expect(mockOystehr.fhir.search).toHaveBeenNthCalledWith(1, {
      resourceType: 'Patient',
      params: expect.arrayContaining([
        { name: '_count', value: '2' },
        { name: '_total', value: 'accurate' },
        { name: '_offset', value: '0' },
      ]),
    });
    expect(mockOystehr.fhir.search).toHaveBeenNthCalledWith(2, {
      resourceType: 'Patient',
      params: expect.arrayContaining([
        { name: '_count', value: '2' },
        { name: '_total', value: 'accurate' },
        { name: '_offset', value: '2' },
      ]),
    });
    expect(mockOystehr.fhir.search).toHaveBeenNthCalledWith(3, {
      resourceType: 'Patient',
      params: expect.arrayContaining([
        { name: '_count', value: '2' },
        { name: '_total', value: 'accurate' },
        { name: '_offset', value: '4' },
      ]),
    });
  });

  it('should handle included resources (non-match entries)', async () => {
    const matchPatients: Patient[] = [
      { resourceType: 'Patient', id: '1', name: [{ family: 'Smith', given: ['John'] }] },
    ];

    const includedOrganization = {
      resourceType: 'Organization',
      id: 'org-1',
      name: 'Test Organization',
    };

    const mockBundle: Bundle<FhirResource> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 1,
      entry: [
        {
          resource: matchPatients[0],
          search: { mode: 'match' },
        },
        {
          resource: includedOrganization as any,
          search: { mode: 'include' },
        },
      ],
      link: [{ relation: 'self', url: 'http://example.com/Patient?_count=100&_offset=0' }],
    };

    // Mock unbundle to return all entries
    (mockBundle as any).unbundle = () => [matchPatients[0], includedOrganization];

    mockOystehr.fhir.search.mockResolvedValueOnce(mockBundle);

    const result = await getAllFhirSearchPages<FhirResource>(
      {
        resourceType: 'Patient',
        params: [{ name: '_include', value: 'Patient:organization' }],
      },
      mockOystehr as any,
      100
    );

    expect(result).toHaveLength(2);
    expect(result).toEqual([matchPatients[0], includedOrganization]);
    expect(mockOystehr.fhir.search).toHaveBeenCalledTimes(1);
  });

  it('should return empty array when no resources found', async () => {
    const mockBundle: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 0,
      entry: [],
      link: [{ relation: 'self', url: 'http://example.com/Patient?_count=100&_offset=0' }],
    };

    (mockBundle as any).unbundle = () => [];

    mockOystehr.fhir.search.mockResolvedValueOnce(mockBundle);

    const result = await getAllFhirSearchPages<Patient>(
      {
        resourceType: 'Patient',
        params: [{ name: 'identifier', value: 'non-existent' }],
      },
      mockOystehr as any,
      100
    );

    expect(result).toEqual([]);
    expect(mockOystehr.fhir.search).toHaveBeenCalledTimes(1);
  });

  it('should use custom maxMatchPerBatch parameter', async () => {
    const mockPatients: Patient[] = [
      { resourceType: 'Patient', id: '1', name: [{ family: 'Smith', given: ['John'] }] },
    ];

    const mockBundle: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 1,
      entry: mockPatients.map((patient) => ({
        resource: patient,
        search: { mode: 'match' },
      })),
      link: [{ relation: 'self', url: 'http://example.com/Patient?_count=50&_offset=0' }],
    };

    (mockBundle as any).unbundle = () => mockPatients;

    mockOystehr.fhir.search.mockResolvedValueOnce(mockBundle);

    await getAllFhirSearchPages<Patient>(
      {
        resourceType: 'Patient',
        params: [],
      },
      mockOystehr as any,
      50
    );

    expect(mockOystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'Patient',
      params: expect.arrayContaining([{ name: '_count', value: '50' }]),
    });
  });

  it('should preserve original search parameters across pagination', async () => {
    const page1Patients: Patient[] = [
      { resourceType: 'Patient', id: '1', name: [{ family: 'Smith', given: ['John'] }] },
    ];

    const page2Patients: Patient[] = [
      { resourceType: 'Patient', id: '2', name: [{ family: 'Smith', given: ['Jane'] }] },
    ];

    const mockBundle1: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 2,
      entry: page1Patients.map((patient) => ({
        resource: patient,
        search: { mode: 'match' },
      })),
      link: [
        { relation: 'self', url: 'http://example.com/Patient?_count=1&_offset=0' },
        { relation: 'next', url: 'http://example.com/Patient?_count=1&_offset=1' },
      ],
    };

    const mockBundle2: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 2,
      entry: page2Patients.map((patient) => ({
        resource: patient,
        search: { mode: 'match' },
      })),
      link: [{ relation: 'self', url: 'http://example.com/Patient?_count=1&_offset=1' }],
    };

    (mockBundle1 as any).unbundle = () => page1Patients;
    (mockBundle2 as any).unbundle = () => page2Patients;

    mockOystehr.fhir.search.mockResolvedValueOnce(mockBundle1).mockResolvedValueOnce(mockBundle2);

    await getAllFhirSearchPages<Patient>(
      {
        resourceType: 'Patient',
        params: [
          { name: 'family', value: 'Smith' },
          { name: '_sort', value: 'name' },
        ],
      },
      mockOystehr as any,
      1
    );

    expect(mockOystehr.fhir.search).toHaveBeenNthCalledWith(1, {
      resourceType: 'Patient',
      params: expect.arrayContaining([
        { name: 'family', value: 'Smith' },
        { name: '_sort', value: 'name' },
      ]),
    });

    expect(mockOystehr.fhir.search).toHaveBeenNthCalledWith(2, {
      resourceType: 'Patient',
      params: expect.arrayContaining([
        { name: 'family', value: 'Smith' },
        { name: '_sort', value: 'name' },
      ]),
    });
  });

  it('should not mutate the original params array', async () => {
    const originalParams = [{ name: 'family', value: 'Smith' }];
    const mockPatients: Patient[] = [
      { resourceType: 'Patient', id: '1', name: [{ family: 'Smith', given: ['John'] }] },
    ];

    const mockBundle: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 1,
      entry: mockPatients.map((patient) => ({
        resource: patient,
        search: { mode: 'match' },
      })),
      link: [{ relation: 'self', url: 'http://example.com/Patient?_count=100&_offset=0' }],
    };

    (mockBundle as any).unbundle = () => mockPatients;

    mockOystehr.fhir.search.mockResolvedValueOnce(mockBundle);

    await getAllFhirSearchPages<Patient>(
      {
        resourceType: 'Patient',
        params: originalParams,
      },
      mockOystehr as any,
      100
    );

    // Verify original params array was not mutated
    expect(originalParams).toEqual([{ name: 'family', value: 'Smith' }]);
    expect(originalParams.length).toBe(1);
  });

  it('should handle duplicate resources across pages', async () => {
    // Simulate pagination where the same Patient appears in multiple pages
    // This can happen with included resources
    const sharedPatient: Patient = {
      resourceType: 'Patient',
      id: 'shared-1',
      name: [{ family: 'Shared', given: ['Patient'] }],
    };

    const page1Patients: Patient[] = [
      { resourceType: 'Patient', id: '1', name: [{ family: 'Smith', given: ['John'] }] },
      sharedPatient, // Same patient in page 1
    ];

    const page2Patients: Patient[] = [
      { resourceType: 'Patient', id: '2', name: [{ family: 'Doe', given: ['Jane'] }] },
      sharedPatient, // Same patient in page 2 (duplicate)
    ];

    const mockBundle1: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 2, // Total of 2 match entries (patient 1 and patient 2)
      entry: page1Patients.map((patient) => ({
        resource: patient,
        search: { mode: patient.id === 'shared-1' ? 'include' : 'match' },
      })),
      link: [
        { relation: 'self', url: 'http://example.com/Patient?_count=2&_offset=0' },
        { relation: 'next', url: 'http://example.com/Patient?_count=2&_offset=1' },
      ],
    };

    const mockBundle2: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 2, // Total of 2 match entries (patient 1 and patient 2)
      entry: page2Patients.map((patient) => ({
        resource: patient,
        search: { mode: patient.id === 'shared-1' ? 'include' : 'match' },
      })),
      link: [{ relation: 'self', url: 'http://example.com/Patient?_count=2&_offset=1' }],
    };

    (mockBundle1 as any).unbundle = () => page1Patients;
    (mockBundle2 as any).unbundle = () => page2Patients;

    mockOystehr.fhir.search.mockResolvedValueOnce(mockBundle1).mockResolvedValueOnce(mockBundle2);

    const result = await getAllFhirSearchPages<Patient>(
      {
        resourceType: 'Patient',
        params: [{ name: '_include', value: 'Patient:organization' }],
      },
      mockOystehr as any,
      2
    );

    // Should deduplicate automatically for idempotency
    // The function now ensures that changing batch size doesn't affect the result
    expect(result).toHaveLength(3);

    // Verify each unique patient appears only once
    const patient1Occurrences = result.filter((p) => p.id === '1');
    const patient2Occurrences = result.filter((p) => p.id === '2');
    const sharedPatientOccurrences = result.filter((p) => p.id === 'shared-1');

    expect(patient1Occurrences).toHaveLength(1);
    expect(patient2Occurrences).toHaveLength(1);
    expect(sharedPatientOccurrences).toHaveLength(1);
  });
});
