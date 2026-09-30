/**
 * @vitest-environment node
 */

import { VisitType } from 'config-types/config/booking';
import { Appointment } from 'fhir/r4b';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { describe, expect, it } from 'vitest';
import { getFollowupPrefill } from './followupPrefill';

const appointmentWith = ({
  module,
  bookedAs,
  serviceCategoryCode,
}: {
  module?: OTTEHR_MODULE;
  bookedAs?: string;
  serviceCategoryCode?: string;
}): Appointment => ({
  resourceType: 'Appointment',
  status: 'booked',
  participant: [],
  ...(module && { meta: { tag: [{ code: module }] } }),
  ...(bookedAs && { appointmentType: { text: bookedAs } }),
  ...(serviceCategoryCode && {
    serviceCategory: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: serviceCategoryCode }] }],
  }),
});

describe('getFollowupPrefill', () => {
  it('returns nothing when there is no parent appointment', () => {
    expect(getFollowupPrefill(undefined)).toEqual({});
  });

  it.each([
    ['walkin', OTTEHR_MODULE.IP, VisitType.InPersonWalkIn],
    ['prebook', OTTEHR_MODULE.IP, VisitType.InPersonPreBook],
    ['posttelemed', OTTEHR_MODULE.IP, VisitType.InPersonPostTelemed],
    ['walkin', OTTEHR_MODULE.TM, VisitType.VirtualOnDemand],
    ['prebook', OTTEHR_MODULE.TM, VisitType.VirtualScheduled],
  ])('maps a %s appointment tagged %s to %s', (bookedAs, module, expected) => {
    expect(getFollowupPrefill(appointmentWith({ module, bookedAs })).visitType).toBe(expected);
  });

  it('leaves the visit type unset when the module tag is missing', () => {
    // Without a module tag we can't tell in-person from virtual, and guessing would
    // put the provider one silent mis-click away from booking the wrong modality.
    expect(getFollowupPrefill(appointmentWith({ bookedAs: 'prebook' })).visitType).toBeUndefined();
  });

  it('leaves the visit type unset for a virtual post-telemed parent', () => {
    // No such visit type exists in the form — post-telemed is in-person by definition.
    expect(getFollowupPrefill(appointmentWith({ module: OTTEHR_MODULE.TM, bookedAs: 'posttelemed' })).visitType).toBe(
      undefined
    );
  });

  it('treats an untyped in-person parent as a walk-in, matching appointmentTypeForAppointment', () => {
    expect(getFollowupPrefill(appointmentWith({ module: OTTEHR_MODULE.IP })).visitType).toBe(VisitType.InPersonWalkIn);
  });

  it('carries over the service category code', () => {
    expect(getFollowupPrefill(appointmentWith({ serviceCategoryCode: 'urgent-care' })).serviceCategoryCode).toBe(
      'urgent-care'
    );
  });

  it('carries over an admin-created (FHIR-sourced) service category code', () => {
    expect(getFollowupPrefill(appointmentWith({ serviceCategoryCode: 'massage45' })).serviceCategoryCode).toBe(
      'massage45'
    );
  });

  it('leaves the service category unset when the parent carries none', () => {
    expect(getFollowupPrefill(appointmentWith({ module: OTTEHR_MODULE.IP })).serviceCategoryCode).toBeUndefined();
  });

  it('ignores a service category coded in a foreign system', () => {
    const appointment: Appointment = {
      resourceType: 'Appointment',
      status: 'booked',
      participant: [],
      serviceCategory: [{ coding: [{ system: 'http://example.com/other', code: 'urgent-care' }] }],
    };
    expect(getFollowupPrefill(appointment).serviceCategoryCode).toBeUndefined();
  });

  it('derives both facets from a fully specified parent', () => {
    expect(
      getFollowupPrefill(
        appointmentWith({ module: OTTEHR_MODULE.IP, bookedAs: 'prebook', serviceCategoryCode: 'urgent-care' })
      )
    ).toEqual({ visitType: VisitType.InPersonPreBook, serviceCategoryCode: 'urgent-care' });
  });
});
