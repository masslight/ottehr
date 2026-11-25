import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Communication } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { MailedStatementItem } from 'utils/lib/types/api/mailed-statements-report.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getMailedStatementSyncState } from '../../src/shared/mailed-statement-sync-state';
import { MAIL_VENDOR_EXTENSION_URL } from '../../src/shared/postgrid';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

interface MailedStatementsReportOutput {
  message: string;
  statements: MailedStatementItem[];
  lastSyncRunAt: string | null;
}

describe('mailed-statements-report integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let communication: Communication;
  const vendorLetterId = `letter_${randomUUID()}`;
  const html = `<p>Statement ${randomUUID()}</p>`;
  const sent = DateTime.fromISO('2001-01-01T00:00:00Z', { zone: 'utc' })
    .plus({ seconds: Math.floor(Math.random() * 365 * 24 * 60 * 60) })
    .toISO()!;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('mailed-statements-report.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);

    communication = await oystehr.fhir.create<Communication>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Communication',
          status: 'completed',
          medium: [
            { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode', code: 'MAILWRIT' }] },
          ],
          sent,
          subject: { reference: `Patient/${base.patient.id}` },
          encounter: { reference: `Encounter/${base.encounter.id}` },
          recipient: [{ reference: `Patient/${base.patient.id}`, display: 'Jon Snow' }],
          payload: [
            { contentString: 'Standard statement' },
            { contentAttachment: { contentType: 'text/html', data: Buffer.from(html).toString('base64') } },
          ],
          extension: [
            {
              url: MAIL_VENDOR_EXTENSION_URL,
              extension: [
                { url: 'vendor-letter-id', valueString: vendorLetterId },
                { url: 'vendor-letter-status', valueString: 'ready' },
                { url: 'vendor-page-count', valueString: '2' },
              ],
            },
          ],
        },
        setup.processId
      ) as Communication
    );
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('reports the mailed statement with its patient, appointment and vendor details', async () => {
    const sentAt = DateTime.fromISO(sent);
    const response = await oystehrZambdas.zambda.execute({
      id: 'mailed-statements-report',
      dateRange: { start: sentAt.minus({ seconds: 1 }).toISO(), end: sentAt.plus({ seconds: 1 }).toISO() },
    });
    const output = response.output as MailedStatementsReportOutput;

    const statement = output.statements.find((item) => item.communicationId === communication.id);
    expect(statement).toMatchObject({
      patientId: base.patient.id,
      patientName: 'Snow, Jon',
      encounterId: base.encounter.id,
      appointmentId: base.appointment.id,
      appointmentDate: base.appointment.start,
      recipientName: 'Jon Snow',
      description: 'Standard statement',
      htmlContent: html,
      vendorLetterId,
      vendorLetterStatus: 'ready',
      vendorPageCount: 2,
    });
    expect(DateTime.fromISO(statement!.sentDate).toMillis()).toBe(sentAt.toMillis());
    expect(output.lastSyncRunAt).toBe((await getMailedStatementSyncState(oystehr)).lastRunAt);
  });
});
