import { expect, test } from '@playwright/test';
import { Appointment, Resource } from 'fhir/r4b';
import { ResourceHandler } from '../../e2e-utils/resource-handler';

const e2eHandler = new ResourceHandler();
const integrationHandler = new ResourceHandler();

test.beforeAll(async () => {
  await Promise.all([await integrationHandler.setResourcesFast(), await e2eHandler.setResources()]);
  await Promise.all([
    e2eHandler.waitTillAppointmentPreprocessed(e2eHandler.appointment.id!),
    e2eHandler.waitTillHarvestingDone(e2eHandler.appointment.id!),
  ]);
});

test.afterAll(async () => {
  await Promise.all([integrationHandler.cleanupResources(), e2eHandler.cleanupResources()]);
});

const SKIP_ME = 'SKIP_ME_FOR_VALUE_CHECKING';

test('Ensure Resources created by generate test data -> harvest -> prefill is the same as what we create for integration testing', async () => {
  // Compare Appointment resources
  const e2eAppointment = cleanAppointment(
    await e2eHandler.apiClient.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: e2eHandler.appointment.id!,
    })
  );
  const integrationAppointment = cleanAppointment(integrationHandler.appointment);
  validateAppointment(e2eAppointment, integrationAppointment);

  // Compare Patient resources
});

const validateAppointment = (e2eAppointment: Appointment, integrationAppointment: Appointment): void => {
  Object.entries(e2eAppointment).forEach(([key, value]) => {
    expect(integrationAppointment[key], `expect appointment.${key} value to be defined`).toBeDefined();
    if (value !== SKIP_ME) {
      expect(integrationAppointment[key], `expect appointment.${key} value to be equal`).toEqual(value);
    }
  });

  Object.entries(integrationAppointment).forEach(([key, value]) => {
    expect(e2eAppointment[key], `expect appointment.${key} value to be defined`).toBeDefined();
    if (value !== SKIP_ME) {
      expect(e2eAppointment[key], `expect appointment.${key} value to be equal`).toEqual(value);
    }
  });
};

const cleanOutMetaStuff = (resource: any): Resource => {
  resource.id = SKIP_ME;
  resource.meta.versionId = SKIP_ME;
  resource.meta.lastUpdated = SKIP_ME;
  return resource;
};

const cleanAppointment = (appointment: Appointment): Appointment => {
  appointment = cleanOutMetaStuff(appointment) as Appointment;
  appointment.participant[0].actor!.reference = SKIP_ME;
  appointment.start = SKIP_ME;
  appointment.end = SKIP_ME;
  appointment.slot![0].reference = SKIP_ME;
  appointment.created = SKIP_ME;
  return appointment;
};
