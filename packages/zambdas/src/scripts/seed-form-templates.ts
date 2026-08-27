import { randomUUID } from 'crypto';
import { DocumentReference } from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import path from 'path';
import {
  BUCKET_NAMES,
  FORM_TEMPLATE_CATEGORY_CODING,
  FORM_TEMPLATE_CATEGORY_SEARCH_PARAM,
  FORM_TEMPLATE_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/constants';
import { FORMS_CONFIG } from 'utils/lib/ottehr-config/forms';
import { sanitizeFileNameForZ3 } from 'utils/lib/utils/file';
import { getAuth0Token } from '../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../shared/helpers';
import { makeZ3FileUrl } from '../shared/presigned-file-urls/helpers';
import { createPresignedUrl, uploadObjectToZ3 } from '../shared/z3Utils';
import { performEffectWithEnvFile } from './helpers';

/**
 * One-shot seed of the previously hard-coded form templates.
 *
 * The Forms section of the patient chart used to render a compiled-in list (FORMS_CONFIG) pointing at
 * PDFs checked into apps/ehr/public. That list is now admin-authored data, so an environment upgrading
 * to the self-service version would otherwise lose forms its providers were already using. This copies
 * each configured entry into FHIR + Z3 once, after which admins own it like any other template.
 *
 * Run this on **existing** environments only. A brand new install should start with an empty list and
 * let the customer upload what they actually need — the built-in entry is a Texas workers-comp form
 * that is meaningless to most practices.
 *
 * Seeded templates are created **published**, not as drafts: they were already visible in the chart
 * before the upgrade, and seeding them as drafts would silently remove a form providers were using.
 *
 * Idempotent per entry: a template already carrying the entry's seed identifier is skipped, so re-runs
 * and partial failures are safe.
 */

/** Deterministic per-config-entry key, so a second run recognizes what the first one created. */
const seedIdentifierValue = (link: string): string => `seed:${link}`;

const seedFormTemplates = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = createClinicalOystehrClient(token, config);

  const entries = FORMS_CONFIG.forms;
  if (entries.length === 0) {
    console.log('FORMS_CONFIG is empty — nothing to seed.');
    return;
  }

  const existing = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [{ name: 'category', value: FORM_TEMPLATE_CATEGORY_SEARCH_PARAM }],
    })
  ).unbundle();
  const alreadySeeded = new Set(
    existing.flatMap((docRef) =>
      (docRef.identifier ?? [])
        .filter((id) => id.system === FORM_TEMPLATE_IDENTIFIER_SYSTEM && id.value?.startsWith('seed:'))
        .map((id) => id.value!)
    )
  );

  let created = 0;
  for (const entry of entries) {
    const identifierValue = seedIdentifierValue(entry.link);
    if (alreadySeeded.has(identifierValue)) {
      console.log(`Already seeded, skipping: ${entry.title}`);
      continue;
    }

    // FORMS_CONFIG links are paths under the EHR's static assets, e.g. "/dwc073.pdf".
    const sourcePath = path.resolve(__dirname, '../../../../apps/ehr/public', entry.link.replace(/^\//, ''));
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Configured form "${entry.title}" points at ${entry.link}, which is missing at ${sourcePath}`);
    }
    const pdfBytes = new Uint8Array(fs.readFileSync(sourcePath));

    const objectName = `${randomUUID()}-${sanitizeFileNameForZ3(path.basename(entry.link))}`;
    const z3Url = makeZ3FileUrl({ secrets: config, bucketName: BUCKET_NAMES.FORM_TEMPLATES, fileName: objectName });
    const presignedUploadUrl = await createPresignedUrl(token, z3Url, 'upload');
    await uploadObjectToZ3(pdfBytes, presignedUploadUrl);

    const docRef: DocumentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      docStatus: 'final',
      category: [{ coding: [FORM_TEMPLATE_CATEGORY_CODING] }],
      identifier: [{ system: FORM_TEMPLATE_IDENTIFIER_SYSTEM, value: identifierValue }],
      date: DateTime.now().setZone('UTC').toISO() ?? '',
      content: [{ attachment: { url: z3Url, contentType: 'application/pdf', title: entry.title } }],
    };
    await oystehr.fhir.create<DocumentReference>(docRef);
    created += 1;
    console.log(`Seeded: ${entry.title}`);
  }

  console.log(`Done. Seeded ${created} of ${entries.length} configured form template(s).`);
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(seedFormTemplates);
};

// Let failures propagate and exit non-zero so a manual run fails loudly rather than half-seeding in
// silence.
main().catch((error) => {
  console.error('Failed to seed form templates: ', error);
  process.exit(1);
});
