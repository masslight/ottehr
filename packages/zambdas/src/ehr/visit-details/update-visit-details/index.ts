import Oystehr, { BatchInputJSONPatchRequest, BatchInputPatchRequest, User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Account, Appointment, Encounter, Extension, Organization, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  applyVisitOccupationalMedicineEmployerToEncounterExtensions,
  cleanUpStaffHistoryTag,
  FHIR_EXTENSION,
  FHIR_RESOURCE_NOT_FOUND,
  getCoding,
  getCriticalUpdateTagOp,
  getReasonForVisitAndAdditionalDetailsFromAppointment,
  getReasonForVisitOptionsForServiceCategory,
  INVALID_INPUT_ERROR,
  OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
  resolveServiceCategory,
  SERVICE_CATEGORY_SYSTEM,
  userMe,
  WORKERS_COMP_ACCOUNT_TYPE,
} from 'utils';
import { isEmployerOrganization } from '../../../rcm/employers/helpers';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { accountMatchesType } from '../../shared/harvest';
import { UpdateVisitDetailsValidatedInput, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'update-visit-details';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
  const { secrets } = validatedParameters;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  const effectInput = await complexValidation(validatedParameters, oystehr);
  console.log('effectInput', JSON.stringify(effectInput, null, 2));

  await performEffect(effectInput, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  };
});

interface EffectInput extends UpdateVisitDetailsValidatedInput {
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

  if (bookingDetails.visitOccupationalMedicineEmployer !== undefined) {
    const updatedExtensions = applyVisitOccupationalMedicineEmployerToEncounterExtensions(
      encounter?.extension,
      bookingDetails.visitOccupationalMedicineEmployer
    );

    const encounterPatch: BatchInputPatchRequest<Encounter> = {
      method: 'PATCH',
      url: `/Encounter/${encounter.id}`,
      operations: [
        {
          op: encounter?.extension?.length ? 'replace' : 'add',
          path: '/extension',
          value: updatedExtensions,
        },
      ],
    };
    patchRequests.push(encounterPatch);
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

const complexValidation = async (input: UpdateVisitDetailsValidatedInput, oystehr: Oystehr): Promise<EffectInput> => {
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

  let appointmentServiceCategory = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
  let validReasonsForVisit: Array<{ value: string; label: string }>;

  if (input.bookingDetails.serviceCategory) {
    const newCode = input.bookingDetails.serviceCategory.code!;
    const resolved = await resolveServiceCategory(newCode, oystehr);
    if (!resolved) {
      throw INVALID_INPUT_ERROR(`serviceCategory, "${newCode}", is not a valid option`);
    }
    input.bookingDetails.serviceCategory.display = resolved.display;
    appointmentServiceCategory = newCode;
    validReasonsForVisit = resolved.reasonsForVisit;
  } else if (appointmentServiceCategory) {
    // RFV is being changed without a category switch. Resolve against the
    // appointment's existing category (which may be FHIR-backed).
    const resolved = await resolveServiceCategory(appointmentServiceCategory, oystehr);
    validReasonsForVisit = resolved?.reasonsForVisit ?? [];
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

  if (input.bookingDetails.visitOccupationalMedicineEmployer !== undefined) {
    const appointmentCategoryCode = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
    if (appointmentCategoryCode !== 'pre-op') {
      throw INVALID_INPUT_ERROR('visitOccupationalMedicineEmployer is only supported for pre-op service category');
    }
  }

  const visitEmployer = input.bookingDetails.visitOccupationalMedicineEmployer;
  if (visitEmployer) {
    const organizationId = visitEmployer.reference?.split('/')[1];

    if (!organizationId) {
      throw INVALID_INPUT_ERROR('visitOccupationalMedicineEmployer.reference must be Organization/{id}');
    }

    const organization = await oystehr.fhir.get<Organization>({
      resourceType: 'Organization',
      id: organizationId,
    });

    if (!isEmployerOrganization(organization)) {
      throw INVALID_INPUT_ERROR('visitOccupationalMedicineEmployer must reference an occupational medicine employer');
    }

    if (organization.active === false) {
      throw INVALID_INPUT_ERROR('visitOccupationalMedicineEmployer must reference an active organization');
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
