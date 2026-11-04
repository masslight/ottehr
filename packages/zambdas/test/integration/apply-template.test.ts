import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for apply-template: create a note template from an encounter charted
// with a ROS finding and a ROS comment, then apply it to that encounter and to a
// second one. The template is removed afterwards.
describe('apply-template integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let target: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;
  let templateName: string;
  let templateId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('apply-template.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    target = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    await oystehrZambdas.zambda.execute({
      id: 'SAVE-CHART-DATA',
      encounterId: base.encounter.id,
      rosObservations: [
        { field: 'ros-constitutional-fever-reports', label: 'Fever', value: true },
        { field: 'ros-constitutional-comment', label: 'Constitutional comment', note: 'Fever since Tuesday' },
      ],
    });
    templateName = `IT Apply ${randomUUID().slice(0, 8)}`;
    const created = await oystehrZambdas.zambda.execute({
      id: 'admin-create-template',
      encounterId: base.encounter.id,
      templateName,
    });
    templateId = (created.output as { templateId: string }).templateId;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrZambdas.zambda.execute({ id: 'admin-delete-template', templateId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('applies a template to an encounter', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'apply-template',
      templateName,
      encounterId: base.encounter.id,
    });
    expect(response.output).toBeDefined();
  });

  it('ROS overwrite recreates template ROS comments and removes comments the template lacks', async () => {
    const getRos = async (encounterId: string): Promise<ExamObservationDTO[]> =>
      ((await oystehrZambdas.zambda.execute({ id: 'GET-VISIT-NOTE', encounterId })).output as VisitNoteResponse).exam
        .rosObservations;
    const encounterId = target.encounter.id!;

    await oystehrZambdas.zambda.execute({
      id: 'SAVE-CHART-DATA',
      encounterId,
      rosObservations: [
        { field: 'ros-respiratory-comment', label: 'Respiratory comment', note: 'Mild cough' },
        { field: 'ros-constitutional-comment', label: 'Constitutional comment', note: 'Stale note' },
      ],
    });
    expect((await getRos(encounterId)).map((obs) => obs.field).sort()).toEqual([
      'ros-constitutional-comment',
      'ros-respiratory-comment',
    ]);

    await oystehrZambdas.zambda.execute({
      id: 'apply-template',
      templateName,
      encounterId,
      sectionActions: { ros: 'overwrite' },
    });

    const ros = await getRos(encounterId);
    const comments = ros.filter((obs) => obs.field.endsWith('-comment'));
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ field: 'ros-constitutional-comment', note: 'Fever since Tuesday' });
    expect(comments[0].value).toBeUndefined();
    expect(ros.find((obs) => obs.field === 'ros-constitutional-fever-reports')).toMatchObject({ value: true });
  });
});
