import { Appointment } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { isAppointmentOccupationalMedicine, isAppointmentWorkersComp, isAutoAccident } from './appointments';
import { SERVICE_CATEGORY_SYSTEM } from './constants';

const makeAppointmentWithServiceCategory = (code: string, description?: string): Appointment => ({
  resourceType: 'Appointment',
  status: 'booked',
  participant: [],
  description,
  serviceCategory: [
    {
      coding: [{ system: SERVICE_CATEGORY_SYSTEM, code }],
    },
  ],
});

describe('isAppointmentWorkersComp', () => {
  it('returns true for workers-comp service category', () => {
    const appointment = makeAppointmentWithServiceCategory('workers-comp');
    expect(isAppointmentWorkersComp(appointment)).toBe(true);
  });

  it('returns false for urgent-care service category', () => {
    const appointment = makeAppointmentWithServiceCategory('urgent-care');
    expect(isAppointmentWorkersComp(appointment)).toBe(false);
  });

  it('returns false for occupational-medicine service category', () => {
    const appointment = makeAppointmentWithServiceCategory('occupational-medicine');
    expect(isAppointmentWorkersComp(appointment)).toBe(false);
  });

  it('returns false when serviceCategory is missing', () => {
    const appointment: Appointment = {
      resourceType: 'Appointment',
      status: 'booked',
      participant: [],
    };
    expect(isAppointmentWorkersComp(appointment)).toBe(false);
  });
});

describe('isAppointmentOccupationalMedicine', () => {
  it('returns true for occupational-medicine service category', () => {
    const appointment = makeAppointmentWithServiceCategory('occupational-medicine');
    expect(isAppointmentOccupationalMedicine(appointment)).toBe(true);
  });

  it('returns false for urgent-care service category', () => {
    const appointment = makeAppointmentWithServiceCategory('urgent-care');
    expect(isAppointmentOccupationalMedicine(appointment)).toBe(false);
  });

  it('returns false for workers-comp service category', () => {
    const appointment = makeAppointmentWithServiceCategory('workers-comp');
    expect(isAppointmentOccupationalMedicine(appointment)).toBe(false);
  });

  it('returns false when serviceCategory is missing', () => {
    const appointment: Appointment = {
      resourceType: 'Appointment',
      status: 'booked',
      participant: [],
    };
    expect(isAppointmentOccupationalMedicine(appointment)).toBe(false);
  });
});

describe('isAutoAccident', () => {
  it('returns true for urgent-care with Auto accident reason', () => {
    const appointment = makeAppointmentWithServiceCategory('urgent-care', 'Auto accident');
    expect(isAutoAccident(appointment)).toBe(true);
  });

  it('returns true when Auto accident is part of a longer description', () => {
    const appointment = makeAppointmentWithServiceCategory('urgent-care', 'Auto accident - neck pain');
    expect(isAutoAccident(appointment)).toBe(true);
  });

  it('returns false for urgent-care with non-auto-accident reason', () => {
    const appointment = makeAppointmentWithServiceCategory('urgent-care', 'Cough and/or congestion');
    expect(isAutoAccident(appointment)).toBe(false);
  });

  it('returns false for workers-comp even with Auto accident description', () => {
    const appointment = makeAppointmentWithServiceCategory('workers-comp', 'Auto accident');
    expect(isAutoAccident(appointment)).toBe(false);
  });

  it('returns false for occupational-medicine even with Auto accident description', () => {
    const appointment = makeAppointmentWithServiceCategory('occupational-medicine', 'Auto accident');
    expect(isAutoAccident(appointment)).toBe(false);
  });

  it('returns false for urgent-care with no description', () => {
    const appointment = makeAppointmentWithServiceCategory('urgent-care');
    expect(isAutoAccident(appointment)).toBe(false);
  });

  it('returns false when serviceCategory is missing', () => {
    const appointment: Appointment = {
      resourceType: 'Appointment',
      status: 'booked',
      participant: [],
      description: 'Auto accident',
    };
    expect(isAutoAccident(appointment)).toBe(false);
  });
});
