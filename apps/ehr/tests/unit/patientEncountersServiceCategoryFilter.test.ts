import { AppointmentHistoryRow, FollowUpVisitHistoryRow } from 'utils/lib/types/api/patient-visit-history.types';
import { describe, expect, it } from 'vitest';
import { filterVisitsByServiceCategory } from '../../src/components/patientEncountersFilters';

const followUp = (id: string, serviceCategory?: string): FollowUpVisitHistoryRow =>
  ({
    encounterId: id,
    serviceCategory,
    followupSubtype: 'scheduled',
  }) as FollowUpVisitHistoryRow;

const visit = (id: string, serviceCategory?: string, followUps?: FollowUpVisitHistoryRow[]): AppointmentHistoryRow =>
  ({
    appointmentId: id,
    serviceCategory,
    followUps,
  }) as AppointmentHistoryRow;

describe('filterVisitsByServiceCategory', () => {
  it('keeps a visit whose own category matches', () => {
    const visits = [visit('a', 'occupational-medicine'), visit('b', 'urgent-care')];

    expect(filterVisitsByServiceCategory(visits, 'occupational-medicine').map((v) => v.appointmentId)).toEqual(['a']);
  });

  it('keeps a non-matching parent as context when one of its follow-ups matches', () => {
    const visits = [visit('uc-parent', 'urgent-care', [followUp('om-follow-up', 'occupational-medicine')])];

    const result = filterVisitsByServiceCategory(visits, 'occupational-medicine');

    expect(result.map((v) => v.appointmentId)).toEqual(['uc-parent']);
    expect(result[0].followUps?.map((f) => f.encounterId)).toEqual(['om-follow-up']);
  });

  it('prunes follow-ups of another category from a matching parent', () => {
    const visits = [
      visit('uc-parent', 'urgent-care', [
        followUp('uc-follow-up', 'urgent-care'),
        followUp('om-follow-up', 'occupational-medicine'),
      ]),
    ];

    const result = filterVisitsByServiceCategory(visits, 'urgent-care');

    expect(result.map((v) => v.appointmentId)).toEqual(['uc-parent']);
    expect(result[0].followUps?.map((f) => f.encounterId)).toEqual(['uc-follow-up']);
  });

  it('drops a visit when neither it nor any follow-up matches', () => {
    const visits = [visit('uc-parent', 'urgent-care', [followUp('uc-follow-up', 'urgent-care')])];

    expect(filterVisitsByServiceCategory(visits, 'workers-comp')).toEqual([]);
  });

  it('does not match visits or follow-ups with no category', () => {
    const visits = [visit('no-category', undefined, [followUp('no-category-follow-up')])];

    expect(filterVisitsByServiceCategory(visits, 'urgent-care')).toEqual([]);
  });
});
