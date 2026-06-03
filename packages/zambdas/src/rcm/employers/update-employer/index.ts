import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { createCandidClientIfConfigured, toggleCandidEmployerPayer, updateCandidEmployerPayer } from '../candid-sync';
import {
  buildEmployerType,
  getCandidPayerIdFromOrganization,
  isEmployerOrganization,
  normalizeAddress,
  normalizeEmployerNotesExtension,
  normalizeIdentifier,
  normalizeTelecom,
} from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('update-employer', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { employerId, name, active, category, identifier, address, contact, secrets } =
      validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const existing = await oystehr.fhir.get<Organization>({
      resourceType: 'Organization',
      id: employerId,
    });

    if (!isEmployerOrganization(existing)) {
      throw new Error(`Organization ${employerId} is not an occupational medicine employer`);
    }

    const updatedCategory = category ?? existing.type?.[0]?.text ?? 'Occupational Medicine';

    const mergedIdentifier = (() => {
      if (identifier === undefined) return existing.identifier;
      const normalized = normalizeIdentifier(identifier);
      if (!normalized) return existing.identifier;
      const incomingSystems = new Set(normalized.map((id) => id.system));
      const kept = (existing.identifier ?? []).filter((id) => !incomingSystems.has(id.system));
      return [...kept, ...normalized];
    })();

    const updated = await oystehr.fhir.update<Organization>(
      {
        ...existing,
        name: name ?? existing.name,
        active: active ?? existing.active,
        type: category ? buildEmployerType(category) : existing.type ?? buildEmployerType(),
        identifier: mergedIdentifier,
        address: address === undefined ? existing.address : normalizeAddress(address),
        telecom: contact === undefined ? existing.telecom : normalizeTelecom(contact),
        extension:
          contact === undefined
            ? existing.extension
            : normalizeEmployerNotesExtension(contact?.notes, existing.extension),
      },
      { optimisticLockingVersionId: existing.meta?.versionId }
    );

    // Sync to Candid if the organization has a Candid payer ID (best-effort)
    const candid = await createCandidClientIfConfigured(oystehr, secrets);
    if (candid) {
      const candidPayerId = getCandidPayerIdFromOrganization(updated);
      if (candidPayerId) {
        await updateCandidEmployerPayer(
          candid,
          candidPayerId,
          updated.name ?? existing.name ?? '',
          updatedCategory,
          updated.address
        );

        // If active status changed, toggle enablement in Candid as well
        const activeChanged = active !== undefined && active !== existing.active;
        if (activeChanged) {
          await toggleCandidEmployerPayer(candid, candidPayerId, active);
        }
      } else {
        console.log(`[update-employer] No Candid payer ID on Organization ${employerId} — skipping Candid sync`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(updated),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('update-employer', error, ENVIRONMENT);
  }
});
