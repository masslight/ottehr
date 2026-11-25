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

describe('claimsListFiltersToSearchInput: tags', () => {
  it('passes included and excluded tags, and the all-tags match', () => {
    expect(claimsListFiltersToSearchInput({ tag: ['a', 'b'], tagMatch: 'all', excludeTag: ['x'] })).toEqual({
      tag: ['a', 'b'],
      tagMatch: 'all',
      excludeTag: ['x'],
    });
  });

  it('drops the match when there are no included tags', () => {
    expect(claimsListFiltersToSearchInput({ tag: [], tagMatch: 'all', excludeTag: ['x'] })).toEqual({
      excludeTag: ['x'],
    });
  });

  it("treats a missing match and 'any' as the same view", () => {
    expect(
      isSameClaimsListView(
        { filters: { tag: ['a'], tagMatch: 'any' }, layout: {} },
        { filters: { tag: ['a'] }, layout: {} }
      )
    ).toBe(true);
  });
});

describe('claimsListFiltersToSearchInput: service lines', () => {
  it('passes the CPT code, modifier and place of service filters', () => {
    expect(
      claimsListFiltersToSearchInput({ cptCode: ['99213'], modifier: ['25', 'QW'], placeOfService: ['11'] })
    ).toEqual({ cptCode: ['99213'], modifier: ['25', 'QW'], placeOfService: ['11'] });
  });

  it('leaves out empty service line filters', () => {
    expect(claimsListFiltersToSearchInput({ cptCode: [], modifier: [], placeOfService: [] })).toEqual({});
    expect(isSameClaimsListView({ filters: { cptCode: [] }, layout: {} }, { filters: {}, layout: {} })).toBe(true);
  });
});

describe('claimsListFiltersToSearchInput: plan type', () => {
  it('passes the chosen plan types and drops an empty choice', () => {
    expect(claimsListFiltersToSearchInput({ planType: ['12', 'MC'] })).toEqual({ planType: ['12', 'MC'] });
    expect(claimsListFiltersToSearchInput({ planType: [] })).toEqual({});
  });
});
