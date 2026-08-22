import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  MEDICAL_RECORD_EXPORT_DEADLINE_CODE,
  MEDICAL_RECORD_EXPORT_FAILURE_CODE,
  MEDICAL_RECORD_EXPORT_FILE_NAME_CODE,
  MEDICAL_RECORD_EXPORT_OUTPUT_URL_CODE,
  MEDICAL_RECORD_EXPORT_PROGRESS_CODE,
  MEDICAL_RECORD_EXPORT_TASK_CODE,
  MEDICAL_RECORD_EXPORT_TASK_SYSTEM,
} from 'utils/lib/types/data/get-patient-medical-record.types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildExportStatusResponse,
  cancelAbandonedExportTask,
  createExportTaskWriter,
  findActiveExportTask,
  isAbandonedExportTask,
  isMedicalRecordExportTask,
  patientIdFromTask,
  PROGRESS_PATCH_INTERVAL_MS,
  readExportProgress,
  STUCK_IN_PROGRESS_THRESHOLD_MS,
  STUCK_REQUESTED_THRESHOLD_MS,
  toExportStatus,
} from '../../src/shared/medical-record-export/task';

const output = (code: string, valueString: string): NonNullable<Task['output']>[number] => ({
  type: { coding: [{ system: MEDICAL_RECORD_EXPORT_TASK_SYSTEM, code }] },
  valueString,
});

const task = (overrides: Partial<Task> = {}): Task =>
  ({
    resourceType: 'Task',
    id: 'task-1',
    status: 'in-progress',
    intent: 'order',
    code: { coding: [{ system: MEDICAL_RECORD_EXPORT_TASK_SYSTEM, code: MEDICAL_RECORD_EXPORT_TASK_CODE }] },
    for: { reference: 'Patient/patient-1' },
    ...overrides,
  }) as Task;

const presign = (url: string): Promise<string> => Promise.resolve(`https://signed/${url}`);

describe('medical record export Task encoding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('toExportStatus', () => {
    it('maps FHIR task statuses onto the three states the front end knows', () => {
      expect(toExportStatus('completed')).toBe('completed');
      expect(toExportStatus('in-progress')).toBe('in-progress');
      expect(toExportStatus('requested')).toBe('requested');
      expect(toExportStatus('received')).toBe('requested');
      expect(toExportStatus('accepted')).toBe('requested');
      // Every terminal-but-unsuccessful status has to read as failed, or the poller spins forever.
      expect(toExportStatus('failed')).toBe('failed');
      expect(toExportStatus('cancelled')).toBe('failed');
      expect(toExportStatus('rejected')).toBe('failed');
      expect(toExportStatus('entered-in-error')).toBe('failed');
    });
  });

  describe('patientIdFromTask', () => {
    it('reads the patient out of Task.for', () => {
      expect(patientIdFromTask(task())).toBe('patient-1');
    });

    it('refuses a task that does not name a patient', () => {
      expect(() => patientIdFromTask(task({ for: undefined }))).toThrow(/does not name a Patient/);
      expect(() => patientIdFromTask(task({ for: { reference: 'Group/g1' } }))).toThrow(/does not name a Patient/);
    });
  });

  describe('readExportProgress', () => {
    it('round-trips what the writer publishes', () => {
      const parsed = readExportProgress(
        task({ output: [output(MEDICAL_RECORD_EXPORT_PROGRESS_CODE, '{"processed":12,"total":40,"skipped":2}')] })
      );
      expect(parsed).toEqual({ processed: 12, total: 40, skipped: 2 });
    });

    it('ignores unreadable progress instead of failing the poll', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      expect(
        readExportProgress(task({ output: [output(MEDICAL_RECORD_EXPORT_PROGRESS_CODE, 'not json')] }))
      ).toBeUndefined();
      expect(
        readExportProgress(task({ output: [output(MEDICAL_RECORD_EXPORT_PROGRESS_CODE, '{"processed":-1}')] }))
      ).toBeUndefined();
    });

    it('is undefined before the worker has published anything', () => {
      expect(readExportProgress(task())).toBeUndefined();
    });
  });

  describe('buildExportStatusResponse', () => {
    it('reports progress without presigning anything while the job runs', async () => {
      const presignSpy = vi.fn(presign);
      const response = await buildExportStatusResponse(
        task({ output: [output(MEDICAL_RECORD_EXPORT_PROGRESS_CODE, '{"processed":5,"total":9}')] }),
        presignSpy
      );

      expect(response).toEqual({
        taskId: 'task-1',
        status: 'in-progress',
        processed: 5,
        total: 9,
        fileName: undefined,
      });
      expect(presignSpy).not.toHaveBeenCalled();
    });

    it('presigns the archive once the job completes', async () => {
      const response = await buildExportStatusResponse(
        task({
          status: 'completed',
          output: [
            output(MEDICAL_RECORD_EXPORT_OUTPUT_URL_CODE, 'z3://bucket/patient-1/record.zip'),
            output(MEDICAL_RECORD_EXPORT_FILE_NAME_CODE, 'medical_record_doe_jane.zip'),
            output(MEDICAL_RECORD_EXPORT_PROGRESS_CODE, '{"processed":9,"total":9}'),
          ],
        }),
        presign
      );

      expect(response).toEqual({
        taskId: 'task-1',
        status: 'completed',
        processed: 9,
        total: 9,
        fileName: 'medical_record_doe_jane.zip',
        downloadUrl: 'https://signed/z3://bucket/patient-1/record.zip',
      });
    });

    it('completes without a download url when the chart had no documents', async () => {
      // Not an error: a patient with nothing to archive completes with total 0 and no file.
      const response = await buildExportStatusResponse(
        task({
          status: 'completed',
          output: [
            output(MEDICAL_RECORD_EXPORT_FILE_NAME_CODE, 'medical_record_doe_jane.zip'),
            output(MEDICAL_RECORD_EXPORT_PROGRESS_CODE, '{"processed":0,"total":0}'),
          ],
        }),
        presign
      );

      expect(response.status).toBe('completed');
      expect(response.downloadUrl).toBeUndefined();
      expect(response.total).toBe(0);
    });

    it('carries the skipped count through, so a partial archive cannot read as a clean success', async () => {
      const response = await buildExportStatusResponse(
        task({
          status: 'completed',
          output: [
            output(MEDICAL_RECORD_EXPORT_OUTPUT_URL_CODE, 'z3://bucket/patient-1/record.zip'),
            output(MEDICAL_RECORD_EXPORT_FILE_NAME_CODE, 'medical_record_doe_jane.zip'),
            output(MEDICAL_RECORD_EXPORT_PROGRESS_CODE, '{"processed":7,"total":7,"skipped":3}'),
          ],
        }),
        presign
      );

      expect(response.skipped).toBe(3);
      expect(response.total).toBe(7);
      expect(response.downloadUrl).toBeDefined();
    });

    it('reports an all-unreadable chart as skipped rather than as an empty one', async () => {
      const response = await buildExportStatusResponse(
        task({
          status: 'completed',
          output: [output(MEDICAL_RECORD_EXPORT_PROGRESS_CODE, '{"processed":0,"total":0,"skipped":4}')],
        }),
        presign
      );

      expect(response.downloadUrl).toBeUndefined();
      expect(response.skipped).toBe(4);
    });

    it('surfaces a failure message the worker wrote for the user', async () => {
      const response = await buildExportStatusResponse(
        task({
          status: 'failed',
          output: [output(MEDICAL_RECORD_EXPORT_FAILURE_CODE, 'This record is too large to export as one file.')],
        }),
        presign
      );

      expect(response.status).toBe('failed');
      expect(response.error).toBe('This record is too large to export as one file.');
    });

    it('never leaks statusReason, which holds whatever the thrown error said', async () => {
      // Matches outbound-fax: the raw cause stays on the Task and in the logs, and the front end says
      // something generic instead. Reporting `Download failed [503] for "Discharge Summary.pdf"` to a
      // user tells them nothing they can act on and exposes internals.
      const response = await buildExportStatusResponse(
        task({ status: 'failed', statusReason: { text: 'Download failed [503] for archive entry "note.pdf"' } }),
        presign
      );

      expect(response.status).toBe('failed');
      expect(response.error).toBeUndefined();
    });

    it('reports a failure with nothing authored as having no message', async () => {
      const response = await buildExportStatusResponse(task({ status: 'failed' }), presign);
      expect(response.error).toBeUndefined();
    });
  });

  describe('isMedicalRecordExportTask', () => {
    it('accepts only this feature’s task code', () => {
      expect(isMedicalRecordExportTask(task())).toBe(true);
      expect(isMedicalRecordExportTask(task({ code: undefined }))).toBe(false);
      expect(
        isMedicalRecordExportTask(
          task({ code: { coding: [{ system: MEDICAL_RECORD_EXPORT_TASK_SYSTEM, code: 'export-claims-csv' }] } })
        )
      ).toBe(false);
      expect(
        isMedicalRecordExportTask(
          task({ code: { coding: [{ system: 'http://example.com/other', code: MEDICAL_RECORD_EXPORT_TASK_CODE }] } })
        )
      ).toBe(false);
    });
  });

  describe('isAbandonedExportTask', () => {
    const now = DateTime.fromISO('2026-08-21T12:00:00Z', { zone: 'utc' });
    const ago = (ms: number): string => now.minus({ milliseconds: ms }).toISO()!;

    it('flags a requested task the subscription never picked up', () => {
      expect(
        isAbandonedExportTask(
          task({ status: 'requested', meta: { lastUpdated: ago(STUCK_REQUESTED_THRESHOLD_MS + 1000) } }),
          now
        )
      ).toBe(true);
    });

    it('leaves a queued task alone while delivery could still plausibly be in flight', () => {
      expect(isAbandonedExportTask(task({ status: 'requested', meta: { lastUpdated: ago(60_000) } }), now)).toBe(false);
    });

    it('leaves a running task alone until the deadline it published has passed', () => {
      // Quiet for ten minutes but with time left on the clock: the size pass publishes nothing, and
      // reading that as death is what has a second tab archive the same chart again.
      const running = task({
        status: 'in-progress',
        meta: { lastUpdated: ago(10 * 60_000) },
        output: [output(MEDICAL_RECORD_EXPORT_DEADLINE_CODE, now.plus({ minutes: 2 }).toISO()!)],
      });
      expect(isAbandonedExportTask(running, now)).toBe(false);
    });

    it('flags a running task whose deadline has passed, so the chart is not stuck forever', () => {
      const dead = task({
        status: 'in-progress',
        meta: { lastUpdated: ago(60_000) },
        output: [output(MEDICAL_RECORD_EXPORT_DEADLINE_CODE, ago(1000))],
      });
      expect(isAbandonedExportTask(dead, now)).toBe(true);
    });

    it('falls back to an idle bound for a running task that never published a deadline', () => {
      const noDeadline = (idleMs: number): Task => task({ status: 'in-progress', meta: { lastUpdated: ago(idleMs) } });

      expect(isAbandonedExportTask(noDeadline(STUCK_IN_PROGRESS_THRESHOLD_MS - 1000), now)).toBe(false);
      expect(isAbandonedExportTask(noDeadline(STUCK_IN_PROGRESS_THRESHOLD_MS + 1000), now)).toBe(true);
    });

    it('says nothing about tasks that are already finished', () => {
      expect(isAbandonedExportTask(task({ status: 'completed', meta: { lastUpdated: ago(60 * 60_000) } }), now)).toBe(
        false
      );
      expect(isAbandonedExportTask(task({ status: 'failed', meta: { lastUpdated: ago(60 * 60_000) } }), now)).toBe(
        false
      );
    });
  });

  describe('findActiveExportTask', () => {
    const searchWith = (tasks: Task[]): Oystehr =>
      ({
        fhir: {
          search: vi.fn(() => Promise.resolve({ unbundle: () => tasks })),
        },
      }) as unknown as Oystehr;

    it('returns the running export so a second click re-attaches instead of duplicating work', async () => {
      const running = task({ id: 'task-running', status: 'in-progress' });
      const { active, abandoned } = await findActiveExportTask(searchWith([running]), 'patient-1');
      expect(active?.id).toBe('task-running');
      expect(abandoned).toEqual([]);
    });

    it('searches by task code and patient', async () => {
      const oystehr = searchWith([]);
      await findActiveExportTask(oystehr, 'patient-1');

      const params = (oystehr.fhir.search as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0].params;
      expect(params).toEqual(
        expect.arrayContaining([
          { name: 'code', value: `${MEDICAL_RECORD_EXPORT_TASK_SYSTEM}|${MEDICAL_RECORD_EXPORT_TASK_CODE}` },
          { name: 'patient', value: 'Patient/patient-1' },
        ])
      );
    });

    it('reports a stuck requested task as abandoned rather than active', async () => {
      const stuck = task({
        id: 'task-stuck',
        status: 'requested',
        meta: {
          lastUpdated: DateTime.now()
            .minus({ milliseconds: STUCK_REQUESTED_THRESHOLD_MS + 5000 })
            .toISO()!,
        },
      });
      const { active, abandoned } = await findActiveExportTask(searchWith([stuck]), 'patient-1');
      expect(active).toBeUndefined();
      expect(abandoned.map((t) => t.id)).toEqual(['task-stuck']);
    });

    it('reports a running task whose worker died as abandoned, so the chart can be exported again', async () => {
      const dead = task({
        id: 'task-dead',
        status: 'in-progress',
        output: [output(MEDICAL_RECORD_EXPORT_DEADLINE_CODE, DateTime.now().minus({ minutes: 1 }).toISO()!)],
      });
      const { active, abandoned } = await findActiveExportTask(searchWith([dead]), 'patient-1');
      expect(active).toBeUndefined();
      expect(abandoned.map((t) => t.id)).toEqual(['task-dead']);
    });

    it('returns nothing when the patient has no export in flight', async () => {
      const { active, abandoned } = await findActiveExportTask(searchWith([]), 'patient-1');
      expect(active).toBeUndefined();
      expect(abandoned).toEqual([]);
    });
  });

  describe('cancelAbandonedExportTask', () => {
    it('retires the task so it stops matching the active search', async () => {
      const patch: ReturnType<typeof vi.fn> = vi.fn(() => Promise.resolve({} as Task));
      const oystehr = { fhir: { patch } } as unknown as Oystehr;

      await cancelAbandonedExportTask(oystehr, task({ status: 'in-progress' }));

      const operations = patch.mock.calls[0][0].operations;
      expect(operations[0]).toEqual({ op: 'replace', path: '/status', value: 'cancelled' });
      expect(operations[1].op).toBe('add');
      expect(operations[1].value.text).toContain('abandoned in status in-progress');
    });

    it('never lets a failed cleanup stop the next export', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const oystehr = { fhir: { patch: vi.fn(() => Promise.reject(new Error('conflict'))) } } as unknown as Oystehr;

      await expect(cancelAbandonedExportTask(oystehr, task())).resolves.toBeUndefined();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Could not cancel abandoned export'));
    });
  });

  describe('createExportTaskWriter', () => {
    const patchingOystehr = (): { oystehr: Oystehr; patch: ReturnType<typeof vi.fn> } => {
      const patch = vi.fn(() => Promise.resolve({} as Task));
      return { oystehr: { fhir: { patch } } as unknown as Oystehr, patch };
    };

    it('throttles progress writes so a large export is a handful of patches, not thousands', async () => {
      const { oystehr, patch } = patchingOystehr();
      let clock = 100_000;
      const writer = createExportTaskWriter(oystehr, task(), () => clock);

      // First write goes through immediately, then everything inside the window is coalesced.
      await writer.reportProgress({ processed: 1, total: 1000 });
      expect(patch).toHaveBeenCalledTimes(1);

      clock += PROGRESS_PATCH_INTERVAL_MS - 1;
      for (let i = 2; i < 50; i++) await writer.reportProgress({ processed: i, total: 1000 });
      expect(patch).toHaveBeenCalledTimes(1);

      clock += 2;
      await writer.reportProgress({ processed: 50, total: 1000 });
      expect(patch).toHaveBeenCalledTimes(2);
    });

    it('adds the output array first and replaces it after, so it cannot grow without bound', async () => {
      const { oystehr, patch } = patchingOystehr();
      let clock = 0;
      const writer = createExportTaskWriter(oystehr, task(), () => clock);

      await writer.reportProgress({ processed: 1, total: 2 });
      clock += PROGRESS_PATCH_INTERVAL_MS + 1;
      await writer.reportProgress({ processed: 2, total: 2 });

      expect(patch.mock.calls[0][0].operations[0].op).toBe('add');
      expect(patch.mock.calls[1][0].operations[0].op).toBe('replace');
      expect(patch.mock.calls[1][0].operations[0].value).toHaveLength(1);
    });

    it('keeps going when a progress write fails, since the next one carries the same number', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const patch = vi.fn(() => Promise.reject(new Error('conflict')));
      const oystehr = { fhir: { patch } } as unknown as Oystehr;
      const writer = createExportTaskWriter(oystehr, task(), () => 0);

      await expect(writer.reportProgress({ processed: 1, total: 2 })).resolves.toBeUndefined();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Could not publish export progress'));
    });

    it('writes the file url and name alongside final progress, ignoring the throttle', async () => {
      const { oystehr, patch } = patchingOystehr();
      const writer = createExportTaskWriter(oystehr, task(), () => 0);

      await writer.reportProgress({ processed: 1, total: 3 });
      await writer.recordResult({
        fileUrl: 'z3://bucket/record.zip',
        fileName: 'record.zip',
        progress: { processed: 3, total: 3 },
      });

      // Two writes despite both landing at the same instant: the result must never be throttled away.
      expect(patch).toHaveBeenCalledTimes(2);
      const value = patch.mock.calls[1][0].operations[0].value;
      expect(value).toEqual([
        {
          type: {
            coding: [{ system: MEDICAL_RECORD_EXPORT_TASK_SYSTEM, code: MEDICAL_RECORD_EXPORT_OUTPUT_URL_CODE }],
          },
          valueString: 'z3://bucket/record.zip',
        },
        {
          type: { coding: [{ system: MEDICAL_RECORD_EXPORT_TASK_SYSTEM, code: MEDICAL_RECORD_EXPORT_FILE_NAME_CODE }] },
          valueString: 'record.zip',
        },
        {
          type: { coding: [{ system: MEDICAL_RECORD_EXPORT_TASK_SYSTEM, code: MEDICAL_RECORD_EXPORT_PROGRESS_CODE }] },
          valueString: '{"processed":3,"total":3}',
        },
      ]);
    });

    it('publishes the deadline without arming the progress throttle', async () => {
      const { oystehr, patch } = patchingOystehr();
      const writer = createExportTaskWriter(oystehr, task(), () => 500_000);

      await writer.recordDeadline(DateTime.fromISO('2026-08-21T12:13:00Z', { zone: 'utc' }));
      // Same instant as the deadline write: the first progress report must still go through, or the
      // poller would not learn the total until a throttle window had passed.
      await writer.reportProgress({ processed: 0, total: 1000 });

      expect(patch).toHaveBeenCalledTimes(2);
      const codes = patch.mock.calls[1][0].operations[0].value.map(
        (entry: { type: { coding: { code: string }[] } }) => entry.type.coding[0].code
      );
      expect(codes).toEqual([MEDICAL_RECORD_EXPORT_DEADLINE_CODE, MEDICAL_RECORD_EXPORT_PROGRESS_CODE]);
    });

    it('keeps the deadline on the task when the result replaces the file entries', async () => {
      const { oystehr, patch } = patchingOystehr();
      const writer = createExportTaskWriter(oystehr, task(), () => 0);

      await writer.recordDeadline(DateTime.fromISO('2026-08-21T12:13:00Z', { zone: 'utc' }));
      await writer.recordResult({
        fileUrl: 'z3://bucket/record.zip',
        fileName: 'record.zip',
        progress: { processed: 3, total: 3 },
      });

      const codes = patch.mock.calls[1][0].operations[0].value.map(
        (entry: { type: { coding: { code: string }[] } }) => entry.type.coding[0].code
      );
      expect(codes).toEqual([
        MEDICAL_RECORD_EXPORT_DEADLINE_CODE,
        MEDICAL_RECORD_EXPORT_OUTPUT_URL_CODE,
        MEDICAL_RECORD_EXPORT_FILE_NAME_CODE,
        MEDICAL_RECORD_EXPORT_PROGRESS_CODE,
      ]);
    });

    it('writes an authored failure message straight through, ignoring the throttle', async () => {
      const { oystehr, patch } = patchingOystehr();
      const writer = createExportTaskWriter(oystehr, task(), () => 0);

      await writer.reportProgress({ processed: 1, total: 9 });
      await writer.recordUserFacingFailure('This record is too large to export as one file.');

      // Two writes at the same instant: a failure the user needs to read must never be throttled away.
      expect(patch).toHaveBeenCalledTimes(2);
      const codes = patch.mock.calls[1][0].operations[0].value.map(
        (entry: { type: { coding: { code: string }[] } }) => entry.type.coding[0].code
      );
      expect(codes).toContain(MEDICAL_RECORD_EXPORT_FAILURE_CODE);
    });

    it('keeps the authored failure when a later write replaces the file entries', async () => {
      const { oystehr, patch } = patchingOystehr();
      const writer = createExportTaskWriter(oystehr, task(), () => 0);

      await writer.recordUserFacingFailure('Ran out of time; the export was not started.');
      await writer.recordResult({ fileName: 'record.zip', progress: { processed: 0, total: 0 } });

      const codes = patch.mock.calls[1][0].operations[0].value.map(
        (entry: { type: { coding: { code: string }[] } }) => entry.type.coding[0].code
      );
      expect(codes).toContain(MEDICAL_RECORD_EXPORT_FAILURE_CODE);
    });

    it('records a name but no url for an empty chart', async () => {
      const { oystehr, patch } = patchingOystehr();
      const writer = createExportTaskWriter(oystehr, task(), () => 0);

      await writer.recordResult({ fileName: 'record.zip', progress: { processed: 0, total: 0 } });

      const value = patch.mock.calls[0][0].operations[0].value;
      expect(value.map((entry: { type: { coding: { code: string }[] } }) => entry.type.coding[0].code)).toEqual([
        MEDICAL_RECORD_EXPORT_FILE_NAME_CODE,
        MEDICAL_RECORD_EXPORT_PROGRESS_CODE,
      ]);
    });
  });
});
