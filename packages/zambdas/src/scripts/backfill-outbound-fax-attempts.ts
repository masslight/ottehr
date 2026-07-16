import { Communication, Provenance, Task } from 'fhir/r4b';
import {
  getReferenceId,
  OUTBOUND_DELIVERY_SOURCE_IDENTIFIER_SYSTEM,
  OUTBOUND_DELIVERY_TASK_CODES,
  OUTBOUND_DELIVERY_TASK_SYSTEM,
  OYSTEHR_FAX_COMMUNICATION_IDENTIFIER_SYSTEM,
  PROVENANCE_FAX_ACTIVITY_CODES,
  PROVENANCE_FAX_SYSTEM,
  Secrets,
} from 'utils';
import { buildLegacyFaxAttempt } from './backfill-outbound-fax-attempts.helpers';
import { createOystehrClientFromConfig, getAll, performEffectWithEnvFile } from './helpers';

async function backfill(config: Secrets): Promise<void> {
  const oystehr = await createOystehrClientFromConfig(config);
  const [communications, provenances, existingTasks] = await Promise.all([
    getAll<Communication>(
      'Communication',
      [{ name: 'identifier', value: `${OYSTEHR_FAX_COMMUNICATION_IDENTIFIER_SYSTEM}|` }],
      oystehr
    ),
    getAll<Provenance>(
      'Provenance',
      [{ name: 'activity', value: `${PROVENANCE_FAX_SYSTEM}|${PROVENANCE_FAX_ACTIVITY_CODES.faxSent}` }],
      oystehr
    ),
    getAll<Task>(
      'Task',
      [{ name: 'code', value: `${OUTBOUND_DELIVERY_TASK_SYSTEM}|${OUTBOUND_DELIVERY_TASK_CODES.fax}` }],
      oystehr
    ),
  ]);
  const existingSources = new Set(
    existingTasks.flatMap((task) =>
      (task.identifier ?? [])
        .filter((identifier) => identifier.system === OUTBOUND_DELIVERY_SOURCE_IDENTIFIER_SYSTEM)
        .map((identifier) => identifier.value)
    )
  );
  const provenanceByCommunication = new Map<string, Provenance>();
  for (const provenance of provenances) {
    const communicationId = provenance.target
      .map((target) => getReferenceId(target.reference, 'Communication'))
      .find(Boolean);
    if (communicationId) provenanceByCommunication.set(communicationId, provenance);
  }

  let created = 0;
  let skipped = 0;
  for (const communication of communications) {
    const source = communication.id ? `Communication/${communication.id}` : undefined;
    if (!source || existingSources.has(source)) {
      skipped++;
      continue;
    }
    const task = buildLegacyFaxAttempt(communication, provenanceByCommunication.get(communication.id!));
    if (!task) {
      skipped++;
      continue;
    }
    await oystehr.fhir.create<Task>(task);
    existingSources.add(source);
    created++;
  }
  console.log(`Outbound fax backfill complete: ${created} created, ${skipped} skipped`);
}

performEffectWithEnvFile(backfill).catch((error) => {
  console.error(error);
  process.exit(1);
});
