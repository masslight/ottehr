import Oystehr, { BatchInputPatchRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import type { Account, DocumentReference, Encounter, Patient, Questionnaire } from 'fhir/r4b';
import { AuditEvent, Bundle, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { userMe } from 'utils/lib/auth/user-me.helper';
import { AUDIT_EVENT_OUTCOME_CODE, PARTICIPATION_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  checkBundleOutcomeOk,
  getVersionedReferencesFromBundleResources,
  makeOptimisticLockIfMatchHeader,
  withVersionConflictRetries,
} from 'utils/lib/fhir/helpers';
import { getCoverageSlotChanges } from 'utils/lib/fhir/insurance';
import { LOINC_SYSTEM } from 'utils/lib/fhir/vitals';
import {
  isInsuranceCardId,
  isPrimaryInsuranceCardId,
  swapPrimarySecondaryInsuranceCardId,
} from 'utils/lib/helpers/paperwork/files-docs';
import {
  getRequestedInsurancePriorityChanges,
  mapQuestionnaireAndValueSetsToItemsList,
} from 'utils/lib/helpers/paperwork/paperwork';
import { makeValidationSchema } from 'utils/lib/helpers/paperwork/validation';
import { PATIENT_RECORD_QUESTIONNAIRE } from 'utils/lib/ottehr-config/patient-record';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { UpdatePatientAccountResponse } from 'utils/lib/types/api/patient-account';
import { INSURANCE_CARD_CODE, InsuranceCardId } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { flattenQuestionnaireAnswers, InsurancePriorityChanges } from 'utils/lib/types/data/paperwork/paperwork.types';
import {
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NOT_AUTHORIZED,
  QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR,
  QUESTIONNAIRE_RESPONSE_INVALID_ERROR,
} from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import { ValidationError } from 'yup';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { sendErrors } from '../../../shared/errors';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { getStripeClient } from '../../../shared/stripeIntegration';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';
import {
  createMasterRecordPatchOperations,
  createUpdatePharmacyPatchOps,
  getAccountAndCoverageResourcesForPatient,
  mergeEncounterAccounts,
  organizeAccounts,
  updatePatientAccountFromQuestionnaire,
  updateStripeCustomer,
} from '../../shared/harvest';

const ZAMBDA_NAME = 'update-patient-account';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success');
  const { secrets } = validatedParameters;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  console.log('complexly validating request parameters');
  const effectInput = await complexValidation(validatedParameters);
  console.log('complex validation successful');
  await performEffect(effectInput, oystehr);
  const response: UpdatePatientAccountResponse = { result: 'success' };
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

const performEffect = async (input: FinishedInput, oystehr: Oystehr): Promise<void> => {
  const {
    questionnaireResponse,
    items,
    patientId,
    providerProfileReference,
    preserveOmittedCoverages,
    questionnaireForEnableWhenFiltering,
  } = input;

  let patientResource = await oystehr.fhir.get<Patient>({
    resourceType: 'Patient',
    id: patientId,
  });

  console.log('creating patch operations');
  const patientPatchOps = createMasterRecordPatchOperations(
    {
      questionnaireResponseItems: items || [],
      sourceQuestionnaire: questionnaireForEnableWhenFiltering,
      options: { filterByEnableWhen: true },
    },
    patientResource
  );

  console.log('All Patient patch operations being attempted: ', JSON.stringify(patientPatchOps, null, 2));

  if (patientPatchOps.patient.patchOpsForDirectUpdate.length > 0) {
    console.time('patching patient resource');
    patientResource = await oystehr.fhir.patch({
      resourceType: 'Patient',
      id: patientResource.id!,
      operations: patientPatchOps.patient.patchOpsForDirectUpdate,
    });
    console.timeEnd('patching patient resource');
  } else {
    console.log('no patient patch operations to perform--skipping');
  }
  const pharmacyPatchOps = createUpdatePharmacyPatchOps(patientResource, flattenQuestionnaireAnswers(items));
  console.log('Pharmacy patch operations being attempted: ', JSON.stringify(pharmacyPatchOps, null, 2));
  if (pharmacyPatchOps.length > 0) {
    await oystehr.fhir.patch<Patient>({
      resourceType: 'Patient',
      id: patientResource.id!,
      operations: pharmacyPatchOps,
    });
  } else {
    console.log('no pharmacy patch operations to perform--skipping');
  }

  let resultBundle: Bundle;
  try {
    resultBundle = await updatePatientAccountFromQuestionnaire(
      {
        questionnaireResponseItem: items,
        patientId,
        // Pass the post-patch Patient so same-as-patient address resolution
        // sees the address change applied above without re-fetching.
        patient: patientResource,
        preserveOmittedCoverages,
        questionnaireForEnableWhenFiltering,
      },
      oystehr
    );
  } catch (e) {
    console.error('error updating patient account from questionnaire', e);
    const ae = await writeAuditEvent(
      { resultBundle: null, providerProfileReference, questionnaireResponse, patientId },
      oystehr
    );
    console.log('wrote audit event: ', `AuditEvent/${ae.id}`);
    throw e;
  }

  const requestedPriorityChanges = getRequestedInsurancePriorityChanges(items);

  if (requestedPriorityChanges.primaryBecameSecondary || requestedPriorityChanges.secondaryBecamePrimary) {
    try {
      await moveInsuranceCardImagesForSavedAccount(oystehr, patientId, requestedPriorityChanges, resultBundle);
    } catch (e) {
      console.error('error moving insurance card images', e);
      await sendErrors(e, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
    }
  }

  let updatedAccount: Account | undefined;
  let workersCompAccount: Account | undefined;

  try {
    const {
      account,
      guarantorResource,
      workersCompAccount: latestWorkersCompAccount,
    } = await getAccountAndCoverageResourcesForPatient(patientId, oystehr);

    updatedAccount = account;
    workersCompAccount = latestWorkersCompAccount;

    const stripeClient = getStripeClient(input.secrets);

    if (!account || !guarantorResource) {
      console.log('could not find account or guarantor, skipping stripe update');
    } else {
      await updateStripeCustomer({
        account,
        guarantorResource,
        stripeClient,
      });
    }
  } catch (e) {
    console.error('error updating stripe details', e);
    const ae = await writeAuditEvent(
      { resultBundle, providerProfileReference, questionnaireResponse, patientId },
      oystehr
    );
    console.log('wrote audit event: ', `AuditEvent/${ae.id}`);
    await sendErrors(e, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }

  console.log('resultBundle', JSON.stringify(resultBundle, null, 2));

  const ae = await writeAuditEvent(
    { resultBundle, providerProfileReference, questionnaireResponse, patientId },
    oystehr
  );

  console.log('wrote audit event: ', `AuditEvent/${ae.id}`);

  if (questionnaireResponse.encounter?.reference) {
    const encounterId = questionnaireResponse.encounter.reference.split('/')[1];
    const encounterResource = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: encounterId,
    });
    const patientAccountReference = updatedAccount?.id ? `Account/${updatedAccount.id}` : undefined;
    const workersCompAccountReference = workersCompAccount?.id ? `Account/${workersCompAccount.id}` : undefined;
    const { accounts: updatedEncounterAccounts, changed: accountsChanged } = mergeEncounterAccounts(
      encounterResource.account,
      [patientAccountReference, workersCompAccountReference]
    );
    if (accountsChanged && updatedEncounterAccounts) {
      await oystehr.fhir.patch<Encounter>({
        id: encounterId,
        resourceType: 'Encounter',
        operations: [
          {
            op: encounterResource.account ? 'replace' : 'add',
            path: '/account',
            value: updatedEncounterAccounts,
          },
        ],
      });
    }
  }
};

const moveInsuranceCardImagesForSavedAccount = async (
  oystehr: Oystehr,
  patientId: string,
  requestedPriorityChanges: InsurancePriorityChanges,
  resultBundle: Bundle
): Promise<void> => {
  const savedAccounts = (resultBundle.entry ?? []).flatMap((entry) =>
    entry.resource?.resourceType === 'Account' ? [entry.resource as Account] : []
  );

  const { existingAccount: savedAccount } = organizeAccounts(savedAccounts);

  if (!savedAccount?.id) {
    return;
  }

  const history = await oystehr.fhir.history<Account>({ resourceType: 'Account', id: savedAccount.id });
  const versions = (history.entry ?? [])
    .flatMap((entry) => (entry.resource ? [entry.resource] : []))
    .sort((a, b) => (b.meta?.lastUpdated ?? '').localeCompare(a.meta?.lastUpdated ?? ''));

  const savedVersionIndex = versions.findIndex((version) => version.meta?.versionId === savedAccount.meta?.versionId);
  const previousAccount = savedVersionIndex === -1 ? undefined : versions[savedVersionIndex + 1];

  if (!previousAccount) {
    return;
  }

  const { primaryCoverageChanged, secondaryCoverageChanged } = getCoverageSlotChanges(previousAccount, savedAccount);

  // A requested move is applied only when the destination slot really got a different coverage, so re-submitting the
  // same form moves nothing.
  await moveInsuranceCardImages(patientId, oystehr, {
    primaryBecameSecondary: requestedPriorityChanges.primaryBecameSecondary && secondaryCoverageChanged,
    secondaryBecamePrimary: requestedPriorityChanges.secondaryBecamePrimary && primaryCoverageChanged,
  });
};

// Insurance card images are tied to primary/secondary by attachment title, so when an insurance changes its priority, its card titles are changed too.
const moveInsuranceCardImages = async (
  patientId: string,
  oystehr: Oystehr,
  { primaryBecameSecondary, secondaryBecamePrimary }: InsurancePriorityChanges
): Promise<void> => {
  if (!primaryBecameSecondary && !secondaryBecamePrimary) {
    return;
  }

  // Each image is patched with If-Match: when an overlapping save changes the same images, this re-reads them and
  // applies the move on top of that change instead of overwriting it.
  await withVersionConflictRetries(async () => {
    const docRefs = await getAllFhirSearchPages<DocumentReference>(
      {
        resourceType: 'DocumentReference',
        params: [
          { name: 'status', value: 'current' },
          { name: 'related', value: `Patient/${patientId}` },
          { name: 'type', value: `${LOINC_SYSTEM}|${INSURANCE_CARD_CODE}` },
          { name: '_sort', value: '-_lastUpdated' },
        ],
      },
      oystehr
    );

    const requests = getInsuranceCardMoveRequests(docRefs, { primaryBecameSecondary, secondaryBecamePrimary });

    if (requests.length) {
      await oystehr.fhir.transaction({ requests });
    }
  });
};

const getInsuranceCardMoveRequests = (
  docRefs: DocumentReference[],
  { primaryBecameSecondary, secondaryBecamePrimary }: InsurancePriorityChanges
): BatchInputPatchRequest<DocumentReference>[] => {
  const requests: BatchInputPatchRequest<DocumentReference>[] = [];
  const movedTitles = new Set<InsuranceCardId>();

  for (const docRef of docRefs) {
    const title = docRef.content[0]?.attachment.title;

    if (!isInsuranceCardId(title)) {
      continue;
    }

    const isMovingOut = isPrimaryInsuranceCardId(title) ? primaryBecameSecondary : secondaryBecamePrimary;
    const isMovingIn = isPrimaryInsuranceCardId(title) ? secondaryBecamePrimary : primaryBecameSecondary;

    // Stale image of a removed coverage in the slot a coverage moves into: supersede it so it isn't shown with that coverage.
    if (!isMovingOut) {
      if (isMovingIn) {
        requests.push({
          method: 'PATCH',
          url: `DocumentReference/${docRef.id}`,
          ifMatch: makeOptimisticLockIfMatchHeader(docRef),
          operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
        });
      }

      continue;
    }

    // Only the newest image of each card side is moved. Older versions are superseded (as a new upload does): all
    // moved images get the same lastUpdated, so the newest one could otherwise lose to an old version.
    const operations: Operation[] = movedTitles.has(title)
      ? [{ op: 'replace', path: '/status', value: 'superseded' }]
      : [{ op: 'replace', path: '/content/0/attachment/title', value: swapPrimarySecondaryInsuranceCardId(title) }];

    movedTitles.add(title);
    requests.push({
      method: 'PATCH',
      url: `DocumentReference/${docRef.id}`,
      ifMatch: makeOptimisticLockIfMatchHeader(docRef),
      operations,
    });
  }

  return requests;
};

interface AuditEventInput {
  resultBundle: Bundle | null;
  providerProfileReference: string;
  questionnaireResponse: QuestionnaireResponse;
  patientId: string;
}

const writeAuditEvent = async (input: AuditEventInput, oystehr: Oystehr): Promise<AuditEvent> => {
  const { resultBundle, providerProfileReference, patientId, questionnaireResponse } = input;
  const outcome = (() => {
    if (!resultBundle) {
      return AUDIT_EVENT_OUTCOME_CODE.seriousFailure;
    }
    return checkBundleOutcomeOk(resultBundle)
      ? AUDIT_EVENT_OUTCOME_CODE.success
      : AUDIT_EVENT_OUTCOME_CODE.seriousFailure;
  })();
  const contained: AuditEvent['contained'] = [{ ...questionnaireResponse, id: 'inputQR' }];
  const entity: AuditEvent['entity'] = [
    {
      what: {
        reference: '#inputQR',
        type: 'QuestionnaireResponse',
      },
      role: {
        system: 'http://terminology.hl7.org/CodeSystem/object-role',
        code: '4',
        display: 'Domain Resource',
      },
      description: 'Resource submitted by the author describing changes to the patient record',
    },
    {
      what: {
        reference: `Patient/${patientId}`,
      },
      role: {
        system: 'http://terminology.hl7.org/CodeSystem/object-role',
        code: '1',
        display: 'Patient',
      },
    },
  ];
  if (resultBundle) {
    entity.push(
      ...getVersionedReferencesFromBundleResources(resultBundle).map((reference) => {
        return {
          what: reference,
          role: {
            system: 'http://terminology.hl7.org/CodeSystem/object-role',
            code: '4',
            display: 'Domain Resource',
          },
          description: 'Resource updated as a result of processing a QuestionnaireResponse submitted by the author',
        };
      })
    );
  }
  const auditEvent: AuditEvent = {
    resourceType: 'AuditEvent',
    contained,
    type: {
      system: 'http://terminology.hl7.org/CodeSystem/iso-21089-lifecycle',
      code: 'originate',
      display: 'Originate/Retain Record Lifecycle Event',
    },
    recorded: DateTime.now().toISO(),
    outcome,
    agent: [
      {
        type: {
          coding: [
            {
              system: PARTICIPATION_CODE_SYSTEM,
              code: 'AUT',
              display: 'author (originator)',
            },
          ],
        },
        who: {
          reference: providerProfileReference,
        },
        requestor: true,
      },
    ],
    source: {
      site: 'Ottehr',
      observer: {
        reference: providerProfileReference,
      },
    },
    entity,
  };
  return oystehr.fhir.create(auditEvent);
};

interface BasicInput {
  userToken: string;
  patientId: string;
  questionnaireResponse: QuestionnaireResponse;
  onlyValidateProvidedFields: boolean;
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!userToken) {
    throw new Error('user token unexpectedly missing');
  }

  const { secrets } = input;
  const { questionnaireResponse, onlyValidateProvidedFields } = safeJsonParse(input.body);
  if (questionnaireResponse === undefined) {
    throw MISSING_REQUIRED_PARAMETERS(['questionnaireResponse']);
  }
  if (onlyValidateProvidedFields !== undefined && typeof onlyValidateProvidedFields !== 'boolean') {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('onlyValidateProvidedFields must be a boolean when provided');
  }
  if (questionnaireResponse.resourceType !== 'QuestionnaireResponse') {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('questionnaireResponse must be of type QuestionnaireResponse');
  }
  if (!questionnaireResponse.item?.length) {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('questionnaireResponse.item may not be missing or empty');
  }
  if (!questionnaireResponse.questionnaire) {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR(
      'questionnaireResponse must have a canonical reference on its "questionnaire" field'
    );
  } else if (questionnaireResponse.questionnaire.split('|').length !== 2) {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR(
      'questionnaireResponse must have a valid canonical reference on its "questionnaire" field'
    );
  }
  const subject = questionnaireResponse.subject?.reference;
  if (!subject) {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('questionnaireResponse.subject may not be missing');
  }
  const [resourceType, patientId] = subject.split('/');

  if (resourceType !== 'Patient') {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('questionnaireResponse.subject must be of type Patient');
  }

  if (isValidUUID(patientId) === false) {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('questionnaireResponse.subject must have a valid UUID');
  }

  return {
    questionnaireResponse,
    onlyValidateProvidedFields: onlyValidateProvidedFields ?? false,
    secrets,
    userToken,
    patientId,
  };
};

interface FinishedInput extends BasicInput {
  providerProfileReference: string;
  items: QuestionnaireResponseItem[];
  preserveOmittedCoverages: boolean;
  questionnaireForEnableWhenFiltering: Questionnaire;
}

const complexValidation = async (input: BasicInput): Promise<FinishedInput> => {
  const { secrets, userToken, questionnaireResponse, onlyValidateProvidedFields } = input;
  console.log('questionnaireResponse', JSON.stringify(questionnaireResponse));
  const user = await userMe(userToken, secrets);
  if (!user) {
    throw NOT_AUTHORIZED;
  }

  const providerProfileReference = user.profile;

  if (!providerProfileReference) {
    throw NOT_AUTHORIZED;
  }
  const questionnaire = PATIENT_RECORD_QUESTIONNAIRE();

  const preserveOmittedCoverages = questionnaireResponse.item?.length === 1;
  console.log('preserveOmittedCoverages', preserveOmittedCoverages);

  const questionnaireItems = mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []);
  // By default we validate each submitted section in full — some sections (e.g.
  // insurance/coverage) can't be safely processed field-by-field and must be
  // validated as an atomic unit. Callers making a single-field edit (e.g. the EHR
  // Medicaid toggle) opt into `onlyValidateProvidedFields` so an unrelated required
  // sibling in the same section — like ethnicity/race in
  // `patient-additional-details-section` — doesn't reject the update.
  const validationSchema = makeValidationSchema(questionnaireItems, undefined, undefined, {
    onlyValidateProvidedFields,
  });
  // when a coverage is added via the add coverage modal, a single item with the data for the added coverage is sent to
  // this endpoint. passing this allows us to refrain from removing any existing coverages from the account when a new one is added.
  try {
    await validationSchema.validate(questionnaireResponse.item, { abortEarly: false });
  } catch (e) {
    const validationErrors = (e as any).inner as ValidationError[];
    if (Array.isArray(validationErrors)) {
      const errorPaths = validationErrors
        .map((e) => {
          return e.path?.split('.')?.[0];
        })
        .filter((i) => !!i) as string[];
      console.log('validationErrors', JSON.stringify(validationErrors, null, 2));
      console.log('errorPaths', JSON.stringify(errorPaths));

      if (errorPaths.length === 0) {
        // this will be a 500
        throw validationErrors;
      }
      const pageAndFieldErrors = errorPaths.reduce(
        (accum, currentPath) => {
          let pageName: string | undefined;
          let fieldName: string | undefined;
          questionnaireItems.forEach((page) => {
            const itemWithError = (page.item ?? []).find((i) => {
              return i.linkId === currentPath;
            });
            if (itemWithError) {
              pageName = page.linkId;
              fieldName = itemWithError.text ?? itemWithError.linkId;
            }
          });
          if (pageName && fieldName) {
            const currentErrorList = accum[pageName] ?? [];
            currentErrorList.push(fieldName);
            accum[pageName] = currentErrorList;
          }
          return accum;
        },
        {} as { [pageName: string]: string[] }
      );
      if (Object.keys(pageAndFieldErrors).length === 0) {
        throw validationErrors;
      }
      console.log('pages with errors: ', JSON.stringify(pageAndFieldErrors));
      throw QUESTIONNAIRE_RESPONSE_INVALID_ERROR(pageAndFieldErrors);
    } else {
      console.log('guess its not an array', e);
      throw validationErrors;
    }
  }

  const items = questionnaireResponse.item ?? [];

  return {
    ...input,
    providerProfileReference,
    items,
    preserveOmittedCoverages,
    questionnaireForEnableWhenFiltering: questionnaire,
  };
};
