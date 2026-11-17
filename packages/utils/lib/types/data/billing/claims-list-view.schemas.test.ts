import { describe, expect, it } from 'vitest';
import { claimsListFiltersToSearchInput, isSameClaimsListView } from './claims-list-view.schemas';

describe('claimsListFiltersToSearchInput', () => {
  it('turns the chosen options into the ids the claim search filters by, dropping empty filters', () => {
    expect(
      claimsListFiltersToSearchInput({
        searchText: '',
        arStage: ['insurance-payer'],
        status: [],
        payers: [{ id: 'p-1', name: 'Medicaid', payerId: 'MC' }],
        nonInsuranceOrgs: [{ id: 'nio-1', name: 'FedEx' }],
        patients: [{ id: 'pt-1', name: 'Jones, Alex' }],
        serviceDateFrom: '2026-01-01',
      })
    ).toEqual({
      arStage: ['insurance-payer'],
      payerId: ['MC'],
      nonInsurancePayerId: ['nio-1'],
      patientId: ['pt-1'],
      serviceDateFrom: '2026-01-01',
    });
  });
});

describe('isSameClaimsListView', () => {
  it('ignores empty values and key order', () => {
    expect(
      isSameClaimsListView(
        { filters: { status: ['submitted'], arStage: [], searchText: '' }, layout: { columnOrder: [] } },
        { filters: { status: ['submitted'] }, layout: {} }
      )
    ).toBe(true);
  });

  it('notices a changed sort', () => {
    expect(
      isSameClaimsListView(
        { filters: {}, layout: { sort: { field: 'billed', direction: 'asc' } } },
        { filters: {}, layout: { sort: { field: 'billed', direction: 'desc' } } }
      )
    ).toBe(false);
  });
});
