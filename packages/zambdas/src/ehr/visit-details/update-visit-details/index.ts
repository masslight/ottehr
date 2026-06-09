import Oystehr, { BatchInputJSONPatchRequest, BatchInputPatchRequest, User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Account, Appointment, Coding, Encounter, Extension, HealthcareService, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BOOKING_CONFIG,
  BookingDetails,
  cleanUpStaffHistoryTag,
  FHIR_EXTENSION,
  FHIR_RESOURCE_NOT_FOUND,
  getAllFhirSearchPages,
  getCoding,
  getCriticalUpdateTagOp,
  getReasonForVisitAndAdditionalDetailsFromAppointment,
  getReasonForVisitOptionsForServiceCategory,
  INVALID_INPUT_ERROR,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
  parseReasonsForVisit,
  REASON_ADDITIONAL_MAX_CHAR,
  Secrets,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  userMe,
  WORKERS_COMP_ACCOUNT_TYPE,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { accountMatchesType } from '../../shared/harvest';

const ZAMBDA_NAME = 'update-visit-details';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
  const { secrets } = validatedParameters;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);
  const effectInput = await complexValidation(validatedParameters, oystehr);
  console.log('effectInput', JSON.stringify(effectInput, null, 2));

  await performEffect(effectInput, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  };
});

interface EffectInput extends Input {
  patient: Patient;
  user: User;
  appointment: Appointment;
  encounter: Encounter;
  workersCompAccount?: Account;
  occupationalMedicineAccount?: Account;
}

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<void> => {
  const { patient, appointment, bookingDetails, user, encounter, workersCompAccount, occupationalMedicineAccount } =
    input;

  const patchRequests: BatchInputJSONPatchRequest[] = [];
  if (bookingDetails.confirmedDob) {
    // Update the FHIR Patient resource
    const patientPatchOps: Operation[] = [
      {
        op: 'replace',
        path: '/birthDate',
        value: bookingDetails.confirmedDob,
      },
    ];

    const updateTag = getCriticalUpdateTagOp(patient, `Staff ${user?.email ? user.email : `(${user?.id})`}`);
    patientPatchOps.push(updateTag);

    const removeStaffUpdateTagOp = cleanUpStaffHistoryTag(patient, 'dob');
    if (removeStaffUpdateTagOp) patientPatchOps.push(removeStaffUpdateTagOp);

    const patientPatch: BatchInputJSONPatchRequest = {
      url: '/Patient/' + patient.id,
      method: 'PATCH',
      operations: patientPatchOps,
    };

    patchRequests.push(patientPatch);
  }
  if (bookingDetails.patientName) {
    const {
      first: patientFirstName,
      middle: patientMiddleName,
      last: patientLastName,
      suffix: patientSuffix,
    } = bookingDetails.patientName;
    const patientPatchOps: Operation[] = [
      {
        op: 'replace',
        path: '/name/0/given/0',
        value: patientFirstName?.trim(),
      },
      {
        op: 'replace',
        path: '/name/0/family',
        value: patientLastName?.trim(),
      },
    ];

    const storedMiddleName = patient?.name?.[0]?.given?.[1];
    if (patientMiddleName && !storedMiddleName) {
      patientPatchOps.push({
        op: 'add',
        path: '/name/0/given/1',
        value: patientMiddleName?.trim(),
      });
    } else if (!patientMiddleName && storedMiddleName) {
      patientPatchOps.push({
        op: 'remove',
        path: '/name/0/given/1',
      });
    } else if (patientMiddleName && storedMiddleName) {
      patientPatchOps.push({
        op: 'replace',
        path: '/name/0/given/1',
        value: patientMiddleName?.trim(),
      });
    }

    const updateTag = getCriticalUpdateTagOp(patient, `Staff ${user?.email ? user.email : `(${user?.id})`}`);
    patientPatchOps.push(updateTag);

    const storedSuffix = patient?.name?.[0]?.suffix?.[0];
    if (patientSuffix && !storedSuffix) {
      patientPatchOps.push({
        op: 'add',
        path: '/name/0/suffix',
        value: [patientSuffix],
      });
    } else if (!patientSuffix && storedSuffix) {
      patientPatchOps.push({
        op: 'remove',
        path: '/name/0/suffix',
      });
    } else if (patientSuffix && storedSuffix) {
      patientPatchOps.push({
        op: 'replace',
        path: '/name/0/suffix',
        value: [patientSuffix],
      });
    }

    const removeStaffUpdateTagOp = cleanUpStaffHistoryTag(patient, 'name');
    if (removeStaffUpdateTagOp) patientPatchOps.push(removeStaffUpdateTagOp);

    patchRequests.push({
      method: 'PATCH',
      url: `/Patient/${patient.id}`,
      operations: patientPatchOps,
    });
  }

  if (bookingDetails.reasonForVisit || bookingDetails.additionalDetails) {
    const op = appointment.description ? 'replace' : 'add';
    const { reasonForVisit: existingReasonForVisit, additionalDetails: existingAdditionalDetails } =
      getReasonForVisitAndAdditionalDetailsFromAppointment(appointment);
    const newAdditionalDetails = bookingDetails.additionalDetails ?? existingAdditionalDetails;
    const value =
      `${bookingDetails.reasonForVisit ?? (existingReasonForVisit || '')}` +
      (newAdditionalDetails ? ` - ${newAdditionalDetails ?? existingAdditionalDetails ?? ''}` : '');
    const appointmentPatchOps: Operation[] = [
      {
        op,
        path: '/description',
        value,
      },
    ];
    patchRequests.push({
      method: 'PATCH',
      url: `/Appointment/${appointment.id}`,
      operations: appointmentPatchOps,
    });
  }

  if (bookingDetails.authorizedNonLegalGuardians !== undefined) {
    const extension = patient.extension || [];
    const extensionIndex = (patient.extension || []).findIndex((ext) => {
      return ext.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url;
    });

    let skipUpdate = false;

    if (extensionIndex > -1) {
      if (bookingDetails.authorizedNonLegalGuardians) {
        extension[extensionIndex].valueString = bookingDetails.authorizedNonLegalGuardians;
      } else {
        extension.splice(extensionIndex, 1);
      }
    } else if (bookingDetails.authorizedNonLegalGuardians) {
      extension.push({
        url: FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url,
        valueString: bookingDetails.authorizedNonLegalGuardians,
      });
    } else {
      skipUpdate = true;
    }
    if (!skipUpdate) {
      const op = extensionIndex > -1 ? 'replace' : 'add';
      const patientPatchOps: Operation[] = [
        {
          op,
          path: '/extension',
          value: extension,
        },
      ];
      patchRequests.push({
        method: 'PATCH',
        url: `/Patient/${patient.id}`,
        operations: patientPatchOps,
      });
    }
  }

  if (bookingDetails.consentForms) {
    const { consentAttested } = bookingDetails.consentForms;
    const encounterExt = encounter?.extension || [];
    const newExtension = encounterExt.filter((ext) => {
      return ext.url !== FHIR_EXTENSION.Encounter.attestedConsent.url;
    });
    if (!consentAttested) {
      if (newExtension.length !== encounterExt.length) {
        const encounterPatch: BatchInputPatchRequest<Encounter> = {
          method: 'PATCH',
          url: `/Encounter/${encounter.id}`,
          operations: [
            {
              op: 'replace',
              path: '/extension',
              value: newExtension,
            },
          ],
        };
        patchRequests.push(encounterPatch);
      }
    } else {
      const newExtEntry: Extension = {
        url: FHIR_EXTENSION.Encounter.attestedConsent.url,
        valueSignature: {
          when: DateTime.now().setZone('utc').toISO()!,
          who: {
            reference: user.profile,
            display: `${user.name} - userId:${user.id}`,
          },
          type: [
            {
              system: 'http://uri.etsi.org/01903/v1.2.2',
              code: 'ProofOfReceipt',
            },
          ],
        },
      };
      newExtension.push(newExtEntry);
      const encounterPatch: BatchInputPatchRequest<Encounter> = {
        method: 'PATCH',
        url: `/Encounter/${encounter.id}`,
        operations: [
          {
            op: encounter?.extension ? 'replace' : 'add',
            path: '/extension',
            value: newExtension,
          },
        ],
      };
      patchRequests.push(encounterPatch);
    }
  }

  if (bookingDetails.serviceCategory) {
    const newEncounterAccounts = (encounter.account ?? [])
      .filter((reference) => reference.reference === 'Account/' + occupationalMedicineAccount?.id)
      .filter((reference) => reference.reference === 'Account/' + workersCompAccount?.id);

    if (bookingDetails.serviceCategory.code === 'workers-comp' && workersCompAccount) {
      newEncounterAccounts.push({
        reference: 'Account/' + workersCompAccount.id,
      });
    }

    if (bookingDetails.serviceCategory.code === 'occupational-medicine' && occupationalMedicineAccount) {
      newEncounterAccounts.push({
        reference: 'Account/' + occupationalMedicineAccount.id,
      });
    }

    const encounterPatch: BatchInputPatchRequest<Encounter> = {
      method: 'PATCH',
      url: `/Encounter/${encounter.id}`,
      operations: [
        {
          op: encounter?.account ? 'replace' : 'add',
          path: '/account',
          value: newEncounterAccounts,
        },
      ],
    };
    patchRequests.push(encounterPatch);

    const appointmentPatch: BatchInputJSONPatchRequest = {
      url: '/Appointment/' + appointment.id,
      method: 'PATCH',
      operations: [
        {
          op: appointment?.serviceCategory ? 'replace' : 'add',
          path: '/serviceCategory',
          value: [
            {
              coding: [bookingDetails.serviceCategory],
            },
          ],
        },
      ],
    };
    patchRequests.push(appointmentPatch);
  }

  // this will combine any requests to patch the same object. for now there's no possibility of conflicting operations
  // in this endpoint, so simply consolidating the requests is safe.
  const consolidatedPatches = consolidatePatchRequests(patchRequests);

  // Batch Appointment and Patient updates
  await oystehr.fhir.transaction({
    requests: consolidatedPatches,
  });
};

const complexValidation = async (input: Input, oystehr: Oystehr): Promise<EffectInput> => {
  const { appointmentId, userToken } = input;
  const user = await userMe(userToken, input.secrets);
  if (!user) {
    throw new Error('user unexpectedly not found');
  }
  const patientAndThings = (
    await oystehr.fhir.search<Appointment | Patient | Encounter>({
      resourceType: 'Appointment',
      params: [
        { name: '_id', value: appointmentId },
        { name: '_include', value: 'Appointment:patient' },
        { name: '_revinclude', value: 'Encounter:appointment' },
      ],
    })
  ).unbundle();
  const appointment = patientAndThings.find((entry) => entry.resourceType === 'Appointment') as Appointment;
  const patientResource = patientAndThings.find((entry) => entry.resourceType === 'Patient') as Patient;
  const encounterResource = patientAndThings.find((entry) => entry.resourceType === 'Encounter') as Encounter;

  if (!appointment) {
    throw FHIR_RESOURCE_NOT_FOUND('Appointment');
  }
  if (!patientResource || !patientResource.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Patient');
  }
  if (!encounterResource || !encounterResource.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Encounter');
  }

  // Resolve a service-category code against the merged catalog (compiled-in
  // BOOKING_CONFIG ∪ FHIR-backed HealthcareServices registered via the
  // Services admin UI). Returns the display label and the configured RFV list
  // if found; undefined if the code matches nothing. Single source so the
  // category-change path and the RFV-only-change path agree on what's valid.
  const resolveCategory = async (
    code: string
  ): Promise<{ display: string | undefined; reasons: Array<{ value: string; label: string }> } | undefined> => {
    const bookingConfigMatch = BOOKING_CONFIG.serviceCategories.find((sc) => sc.category.code === code);
    if (bookingConfigMatch) {
      return {
        display: bookingConfigMatch.category.display,
        reasons: getReasonForVisitOptionsForServiceCategory(code),
      };
    }
    // Paginated: a >1-page catalog (FHIR default page size is small) would
    // otherwise miss target categories on later pages, rejecting valid update
    // attempts with "not a valid option".
    const allCategoryHses = await getAllFhirSearchPages<HealthcareService>(
      {
        resourceType: 'HealthcareService',
        params: [
          { name: '_tag', value: SERVICE_CATEGORY_TAG.code },
          { name: 'active', value: 'true' },
        ],
      },
      oystehr
    );
    const fhirMatch = allCategoryHses.find((r) =>
      (r.type ?? []).some((concept) =>
        (concept.coding ?? []).some((c) => c.system === SERVICE_CATEGORY_SYSTEM && c.code === code)
      )
    );
    if (!fhirMatch) return undefined;
    return { display: fhirMatch.name, reasons: parseReasonsForVisit(fhirMatch) };
  };

  let appointmentServiceCategory = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
  let validReasonsForVisit: Array<{ value: string; label: string }>;

  if (input.bookingDetails.serviceCategory) {
    const newCode = input.bookingDetails.serviceCategory.code!;
    const resolved = await resolveCategory(newCode);
    if (!resolved) {
      throw INVALID_INPUT_ERROR(`serviceCategory, "${newCode}", is not a valid option`);
    }
    input.bookingDetails.serviceCategory.display = resolved.display;
    appointmentServiceCategory = newCode;
    validReasonsForVisit = resolved.reasons;
  } else if (appointmentServiceCategory) {
    // RFV is being changed without a category switch. Resolve against the
    // appointment's existing category (which may be FHIR-backed).
    const resolved = await resolveCategory(appointmentServiceCategory);
    validReasonsForVisit = resolved?.reasons ?? [];
  } else {
    // No category on the appointment and none in the request — fall back to
    // BOOKING_CONFIG's first entry, matching the prior behaviour.
    validReasonsForVisit = getReasonForVisitOptionsForServiceCategory('urgent-care');
  }

  const newRFV = input.bookingDetails.reasonForVisit;
  if (newRFV) {
    const isValidReason = validReasonsForVisit.some((reason: { value: string }) => reason.value === newRFV);
    if (!isValidReason) {
      throw INVALID_INPUT_ERROR(
        `reasonForVisit "${newRFV}" is not valid for service category "${appointmentServiceCategory ?? 'urgent-care'}"`
      );
    }
  }

  const accounts = (
    await oystehr.fhir.search<Account>({
      resourceType: 'Account',
      params: [{ name: 'patient', value: patientResource.id }],
    })
  ).unbundle();

  // const selfPay = getPaymentVariantFromEncounter(encounterResource) === PaymentVariant.selfPay;

  return {
    ...input,
    patient: patientResource,
    appointment,
    encounter: encounterResource,
    user,
    workersCompAccount: accounts.find((account) => accountMatchesType(account, WORKERS_COMP_ACCOUNT_TYPE)),
    occupationalMedicineAccount: accounts.find((account) =>
      accountMatchesType(account, OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE)
    ),
  };
};

interface Input {
  userToken: string;
  secrets: Secrets | null;
  appointmentId: string;
  bookingDetails: Omit<BookingDetails, 'serviceCategory'> & {
    serviceCategory?: Coding;
  };
}

const validateRequestParameters = (input: ZambdaInput): Input => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!userToken) {
    throw new Error('user token unexpectedly missing');
  }

  console.log('input', JSON.stringify(input, null, 2));
  const { secrets } = input;
  const { appointmentId, bookingDetails } = JSON.parse(input.body);

  if (!appointmentId) {
    throw MISSING_REQUIRED_PARAMETERS(['appointmentId']);
  }

  if (isValidUUID(appointmentId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('appointmentId');
  }

  if (!bookingDetails) {
    throw MISSING_REQUIRED_PARAMETERS(['bookingDetails']);
  }

  if (typeof bookingDetails !== 'object') {
    throw INVALID_INPUT_ERROR('bookingDetails must be an object');
  }

  if (bookingDetails.reasonForVisit && typeof bookingDetails.reasonForVisit !== 'string') {
    throw INVALID_INPUT_ERROR('reasonForVisit must be a string');
  }

  if (bookingDetails.additionalDetails && typeof bookingDetails.additionalDetails !== 'string') {
    throw INVALID_INPUT_ERROR('additionalDetails must be a string');
  } else if (bookingDetails.additionalDetails && bookingDetails.additionalDetails.length > REASON_ADDITIONAL_MAX_CHAR) {
    throw INVALID_INPUT_ERROR(`additionalDetails must be at most ${REASON_ADDITIONAL_MAX_CHAR} characters`);
  }

  if (bookingDetails.authorizedNonLegalGuardians && typeof bookingDetails.authorizedNonLegalGuardians !== 'string') {
    throw INVALID_INPUT_ERROR('authorizedNonLegalGuardians must be a string');
  }

  if (bookingDetails.confirmedDob && typeof bookingDetails.confirmedDob !== 'string') {
    throw INVALID_INPUT_ERROR('confirmedDob must be a string');
  } else if (bookingDetails.confirmedDob) {
    const dob = DateTime.fromISO(bookingDetails.confirmedDob);
    if (!dob.isValid) {
      throw INVALID_INPUT_ERROR(`confirmedDob, "${bookingDetails.confirmedDob}", is not a valid iso date string`);
    }
  }

  if (bookingDetails.patientName && typeof bookingDetails.patientName !== 'object') {
    throw INVALID_INPUT_ERROR('"patientName" must be an object');
  } else if (bookingDetails.patientName && Object.keys(bookingDetails.patientName).length === 0) {
    throw INVALID_INPUT_ERROR('"patientName" must have at least one field defined');
  } else if (bookingDetails.patientName) {
    if (bookingDetails.patientName.first && typeof bookingDetails.patientName.first !== 'string') {
      throw INVALID_INPUT_ERROR('"patientName.first" must be a string');
    }
    if (bookingDetails.patientName.last && typeof bookingDetails.patientName.last !== 'string') {
      throw INVALID_INPUT_ERROR('"patientName.last" must be a string');
    }
    if (bookingDetails.patientName.middle && typeof bookingDetails.patientName.middle !== 'string') {
      throw INVALID_INPUT_ERROR('"patientName.middle" must be a string');
    }
    if (bookingDetails.patientName.suffix && typeof bookingDetails.patientName.suffix !== 'string') {
      throw INVALID_INPUT_ERROR('"patientName.suffix" must be a string');
    }
    if (bookingDetails.patientName.first !== undefined && bookingDetails.patientName.first.trim().length === 0) {
      throw INVALID_INPUT_ERROR('patientName must have a non-empty first name');
    }
    if (bookingDetails.patientName.last !== undefined && bookingDetails.patientName.last.trim().length === 0) {
      throw INVALID_INPUT_ERROR('patientName must have a non-empty last name');
    }
  }

  if (bookingDetails.consentForms && typeof bookingDetails.consentForms !== 'object') {
    throw INVALID_INPUT_ERROR('"consentForms" must be an object');
  } else if (bookingDetails.consentForms) {
    if (
      bookingDetails.consentForms.consentAttested &&
      typeof bookingDetails.consentForms.consentAttested !== 'boolean'
    ) {
      throw INVALID_INPUT_ERROR('consentForms.consentAttested must be a boolean');
    }
  }

  // Shape-only validation here: build a placeholder Coding so downstream code
  // can read `.code`. Existence (against BOOKING_CONFIG ∪ FHIR-backed catalog)
  // and display-name resolution happen in complexValidation where we have an
  // Oystehr client for the FHIR lookup.
  let serviceCategory: Coding | undefined = undefined;
  if (bookingDetails.serviceCategory && typeof bookingDetails.serviceCategory !== 'string') {
    throw INVALID_INPUT_ERROR('serviceCategory must be a string');
  } else if (bookingDetails.serviceCategory) {
    serviceCategory = { system: SERVICE_CATEGORY_SYSTEM, code: bookingDetails.serviceCategory };
  }

  // Require at least one field to be present

  if (
    bookingDetails.reasonForVisit === undefined &&
    bookingDetails.additionalDetails === undefined &&
    bookingDetails.authorizedNonLegalGuardians === undefined &&
    bookingDetails.confirmedDob === undefined &&
    bookingDetails.patientName === undefined &&
    bookingDetails.consentForms === undefined &&
    bookingDetails.serviceCategory === undefined
  ) {
    throw INVALID_INPUT_ERROR('at least one field in bookingDetails must be provided');
  }

  return {
    secrets,
    userToken,
    appointmentId,
    bookingDetails: {
      ...bookingDetails,
      serviceCategory,
    },
  };
};

const consolidatePatchRequests = (ops: BatchInputJSONPatchRequest[]): BatchInputPatchRequest<any>[] => {
  const consolidated: { [key: string]: BatchInputJSONPatchRequest } = {};
  ops.forEach((op) => {
    const key = op.url;
    if (!consolidated[key]) {
      consolidated[key] = { ...op };
    } else {
      consolidated[key].operations.push(...op.operations);
    }
  });
  return Object.values(consolidated);
};
