import { Appointment, Encounter, Reference } from 'fhir/r4b';
import { AR_STAGE, getEncounterPaymentVariantExtension, PaymentVariant, SERVICE_CATEGORY_SYSTEM } from 'utils';
import { describe, expect, it } from 'vitest';
import { determineArStage } from '../../../src/billing/create-billing-claim-from-encounter/handler';

const makeEncounter = (variant?: PaymentVariant): Encounter => ({
  resourceType: 'Encounter',
  status: 'finished',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  ...(variant ? { extension: [getEncounterPaymentVariantExtension(variant)] } : {}),
});

const makeAppointment = (serviceCategoryCode = 'urgent-care'): Appointment => ({
  resourceType: 'Appointment',
  status: 'fulfilled',
  participant: [{ status: 'accepted' }],
  serviceCategory: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: serviceCategoryCode }] }],
});

const coverageRef: Reference = { reference: 'Coverage/abc' };

// Minimal ClaimResources shape that determineArStage reads.
type DetermineArStageInput = {
  patientId: string;
  encounter: Encounter;
  appointment: Appointment;
  coverageRefs: { coverageRef: Reference; payorRef: Reference }[];
};

const resources = (over: {
  encounter?: Encounter;
  appointment?: Appointment;
  hasCoverage?: boolean;
}): DetermineArStageInput => ({
  patientId: 'p1',
  encounter: over.encounter ?? makeEncounter(),
  appointment: over.appointment ?? makeAppointment(),
  coverageRefs: over.hasCoverage ? [{ coverageRef, payorRef: coverageRef }] : [],
});

describe('determineArStage', () => {
  it('employer payment selection -> Non-insurance Payer AR', () => {
    expect(determineArStage(resources({ encounter: makeEncounter(PaymentVariant.employer) }))).toBe(
      AR_STAGE.nonInsurancePayer
    );
  });

  it('insurance payment selection -> Insurance Payer AR', () => {
    expect(determineArStage(resources({ encounter: makeEncounter(PaymentVariant.insurance) }))).toBe(
      AR_STAGE.insurancePayer
    );
  });

  it('self-pay selection -> Patient AR', () => {
    expect(determineArStage(resources({ encounter: makeEncounter(PaymentVariant.selfPay) }))).toBe(AR_STAGE.patient);
  });

  it('occupational-medicine visit (no selection) -> Non-insurance Payer AR', () => {
    expect(determineArStage(resources({ appointment: makeAppointment('occupational-medicine') }))).toBe(
      AR_STAGE.nonInsurancePayer
    );
  });

  it('payment selection takes precedence over the occ-med visit type', () => {
    expect(
      determineArStage(
        resources({
          appointment: makeAppointment('occupational-medicine'),
          encounter: makeEncounter(PaymentVariant.selfPay),
        })
      )
    ).toBe(AR_STAGE.patient);
  });

  it('no selection with coverage -> Insurance Payer AR (workers-comp falls out here too)', () => {
    expect(determineArStage(resources({ hasCoverage: true }))).toBe(AR_STAGE.insurancePayer);
  });

  it('no selection and no coverage -> Patient AR', () => {
    expect(determineArStage(resources({ hasCoverage: false }))).toBe(AR_STAGE.patient);
  });
});
