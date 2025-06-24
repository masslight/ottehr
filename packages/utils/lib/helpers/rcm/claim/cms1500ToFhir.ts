import {
  Claim,
  ClaimAccident,
  ClaimCareTeam,
  ClaimDiagnosis,
  ClaimItem,
  ClaimRelated,
  ClaimSupportingInfo,
  CodeableConcept,
  Extension,
} from 'fhir/r4b';
import { codeableConcept, filterUndefined, money, undefinedIfEmptyArray } from '../../../fhir';
import { Cms1500 } from '../../../types';
import { validateDefined } from '../../helpers';
import {
  CODE_SYSTEM_ACT_CODE_V3,
  CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_ICD_9,
  CODE_SYSTEM_ICD_10,
  CODE_SYSTEM_PAYEE_TYPE,
  CODE_SYSTEM_PROCESS_PRIORITY,
  CODE_SYSTEM_ZAPEHR_RCM_CMS1500_DATE_TYPE,
  CODE_SYSTEM_ZAPEHR_RCM_CMS1500_PROCEDURE_MODIFIER,
  CODE_SYSTEM_ZAPEHR_RCM_CMS1500_REFFERING_PROVIDER_TYPE,
  CODE_SYSTEM_ZAPEHR_RCM_CMS1500_RESUBMITTION_RELATIONSHIP,
  CODE_SYSTEM_ZAPEHR_RCM_CMS1500_REVENUE_CODE,
  EMERGENCY_REVENUE_CODE,
  EXTENSION_CLAIM_CONDITION_CODE,
  EXTENSION_OUTSIDE_CHARGES,
  EXTENSION_PATIENT_ACCOUNT_NUMBER,
  EXTENSION_PATIENT_PAID,
  EXTENSION_PATIENT_SIGNED_DATE,
  EXTENSION_PRACTITIONER_SIGNED_DATE,
} from '../constants';

export function cms1500ToFhir(cms1500: Cms1500): Claim {
  return {
    resourceType: 'Claim',
    identifier: undefinedIfEmptyArray(
      filterUndefined(
        cms1500?.otherClaimId
          ? {
              use: 'secondary',
              value: cms1500.otherClaimId,
            }
          : undefined
      )
    ),
    status: 'draft',
    use: 'claim',
    type: codeableConcept('professional', CODE_SYSTEM_CLAIM_TYPE),
    priority: codeableConcept('normal', CODE_SYSTEM_PROCESS_PRIORITY),
    created: new Date().toISOString(),
    patient: {
      reference: validateDefined(cms1500.patient, 'patient'),
    },
    insurance: filterUndefined(
      {
        sequence: 1,
        focal: false,
        coverage: {
          reference: validateDefined(cms1500.primaryCoverage, 'primaryCoverage'),
        },
        preAuthRef: cms1500.priorAuthorizationNumber ? [cms1500.priorAuthorizationNumber] : undefined,
      },
      cms1500.otherCoverage
        ? {
            sequence: 2,
            focal: false,
            coverage: {
              reference: cms1500.otherCoverage,
            },
          }
        : undefined
    ),
    insurer:
      cms1500.insurer != null
        ? {
            reference: cms1500.insurer,
          }
        : undefined,
    payee: cms1500.billingProvider
      ? {
          type: codeableConcept('provider', CODE_SYSTEM_PAYEE_TYPE),
          party: {
            reference: cms1500.billingProvider,
          },
        }
      : undefined,
    supportingInfo: createSupportingInfo(cms1500),
    related: createClaimRelated(cms1500),
    accident: createAccident(cms1500),
    diagnosis: createDiagnosis(cms1500),
    careTeam: createCareTeam(cms1500),
    facility: cms1500.serviceFacilityLocation
      ? {
          reference: cms1500.serviceFacilityLocation,
        }
      : undefined,
    provider: {
      reference: validateDefined(cms1500.billingProvider, 'billingProvider'),
    },
    item: createServiceItems(cms1500),
    total: money(cms1500.totalCharge),
    extension: undefinedIfEmptyArray(
      filterUndefined<Extension>(
        cms1500.patientSignedDate
          ? {
              url: EXTENSION_PATIENT_SIGNED_DATE,
              valueDate: cms1500.patientSignedDate,
            }
          : undefined,
        cms1500.physicianSignedDate
          ? {
              url: EXTENSION_PRACTITIONER_SIGNED_DATE,
              valueDate: cms1500.physicianSignedDate,
            }
          : undefined,
        cms1500.outsideLabCharges
          ? {
              url: EXTENSION_OUTSIDE_CHARGES,
              valueMoney: money(cms1500.outsideLabCharges),
            }
          : undefined,
        cms1500.patientAccountNumber
          ? {
              url: EXTENSION_PATIENT_ACCOUNT_NUMBER,
              valueString: cms1500.patientAccountNumber,
            }
          : undefined,
        cms1500.amountPaid
          ? {
              url: EXTENSION_PATIENT_PAID,
              valueMoney: money(cms1500.amountPaid),
            }
          : undefined,
        ...(cms1500.claimCodes ?? []).map((claimCode) => {
          return { url: EXTENSION_CLAIM_CONDITION_CODE, valueString: claimCode };
        })
      )
    ),
  };
}

function createSupportingInfo(cms1500: Cms1500): ClaimSupportingInfo[] | undefined {
  return undefinedIfEmptyArray(
    filterUndefined<ClaimSupportingInfo>(
      cms1500.dateOfCurrentIllness
        ? {
            sequence: 1,
            category: codeableConcept('onset', CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY),
            code: codeableConcept(
              validateDefined(cms1500.dateOfCurrentIllness.qualifier, 'dateOfCurrentIllness.qualifier'),
              CODE_SYSTEM_ZAPEHR_RCM_CMS1500_DATE_TYPE
            ),
            timingDate: validateDefined(cms1500.dateOfCurrentIllness.date, 'dateOfCurrentIllness.date'),
          }
        : undefined,
      cms1500.otherDate
        ? {
            sequence: 2,
            category: codeableConcept('other', CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY),
            code: codeableConcept(
              validateDefined(cms1500.otherDate.qualifier, 'otherDate.qualifier'),
              CODE_SYSTEM_ZAPEHR_RCM_CMS1500_DATE_TYPE
            ),
            timingDate: validateDefined(cms1500.otherDate.date, 'therDate.date'),
          }
        : undefined,
      cms1500.patientUnableToWorkPeriod
        ? {
            sequence: 3,
            category: codeableConcept('employmentimpacted', CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY),
            timingPeriod: {
              start: validateDefined(cms1500.patientUnableToWorkPeriod.from, 'patientUnableToWorkPeriod.from'),
              end: validateDefined(cms1500.patientUnableToWorkPeriod.to, 'patientUnableToWorkPeriod.to'),
            },
          }
        : undefined,
      cms1500.hospitalizationDates
        ? {
            sequence: 4,
            category: codeableConcept('hospitalized', CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY),
            timingPeriod: {
              start: validateDefined(cms1500.hospitalizationDates.from, 'hospitalizationDates.from'),
              end: cms1500.hospitalizationDates.to,
            },
          }
        : undefined,
      cms1500.additionalClaimInformation
        ? {
            sequence: 5,
            category: codeableConcept('info', CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY),
            valueString: cms1500.additionalClaimInformation,
          }
        : undefined,
      ...(cms1500.services ?? []).flatMap((service, index) => {
        return [
          service.supplementalInformation
            ? {
                sequence: 101 + index * 10,
                category: codeableConcept('info', CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY),
                valueString: service.supplementalInformation,
              }
            : undefined,
          service.epsdt
            ? {
                sequence: 102 + index * 10,
                category: codeableConcept('info', CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY),
                valueString: service.epsdt,
              }
            : undefined,
          service.familyPlan
            ? {
                sequence: 103 + index * 10,
                category: codeableConcept('info', CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY),
                valueBoolean: service.familyPlan,
              }
            : undefined,
        ];
      })
    )
  );
}

function createClaimRelated(cms1500: Cms1500): ClaimRelated[] | undefined {
  if (cms1500.resubmission == null) {
    return undefined;
  }
  return [
    {
      relationship: codeableConcept(
        validateDefined(cms1500.resubmission.code, 'resubmission.code'),
        CODE_SYSTEM_ZAPEHR_RCM_CMS1500_RESUBMITTION_RELATIONSHIP
      ),
      reference: {
        value: cms1500.resubmission.originalReferenceNumber,
      },
    },
  ];
}

function createAccident(cms1500: Cms1500): ClaimAccident | undefined {
  if (cms1500.patientConditionRelatedTo == null || cms1500.dateOfCurrentIllness == null) {
    return undefined;
  }
  return {
    date: validateDefined(cms1500.dateOfCurrentIllness.date, 'dateOfCurrentIllness.date'),
    type: cms1500.patientConditionRelatedTo.employment
      ? codeableConcept('WPA', CODE_SYSTEM_ACT_CODE_V3)
      : cms1500.patientConditionRelatedTo.autoAccident
      ? codeableConcept('MVA', CODE_SYSTEM_ACT_CODE_V3)
      : undefined,
    locationAddress: cms1500.patientConditionRelatedTo?.autoAccident?.autoAccidentState
      ? {
          state: cms1500.patientConditionRelatedTo.autoAccident.autoAccidentState,
        }
      : undefined,
  };
}

function createDiagnosis(cms1500: Cms1500): ClaimDiagnosis[] | undefined {
  if (cms1500.diagnosis == null) {
    return undefined;
  }
  const icdSystemUrl = icdSystemUrlFromIndicator(
    validateDefined(cms1500.diagnosis.icdIndicator, 'diagnosis.icdIndicator')
  );
  return validateDefined(cms1500.diagnosis.codes, 'diagnosis.codes').map((coding, index) => {
    const { code, display } = coding;
    return {
      sequence: index + 1,
      diagnosisCodeableConcept: {
        coding: [
          {
            code,
            system: icdSystemUrl,
            display,
          },
        ],
      },
    };
  });
}

function createCareTeam(cms1500: Cms1500): ClaimCareTeam[] | undefined {
  const careTeam: ClaimCareTeam[] = [];
  if (cms1500.referringProvider != null) {
    careTeam.push({
      sequence: 1,
      provider: {
        reference: cms1500.referringProvider,
      },
      role: referringProviderRole(validateDefined(cms1500.referringProviderQualifier, 'referringProviderQualifier')),
    });
  }
  cms1500.services?.forEach((service, index) => {
    careTeam.push({
      sequence: index + 2,
      provider: {
        reference: validateDefined(service.renderingProvider, `services[${index}].renderingProvider`),
      },
    });
  });
  return undefinedIfEmptyArray(careTeam);
}

function referringProviderRole(qualifier: string): CodeableConcept {
  let code: string | undefined = undefined;
  if (qualifier === 'DN') {
    code = 'referring';
  }
  if (qualifier === 'DK') {
    code = 'ordering';
  }
  if (qualifier === 'DQ') {
    code = 'supervising';
  }
  if (code === undefined) {
    throw new Error(`Unsupported qualifier for referring provider "${qualifier}"`);
  }
  return codeableConcept(code, CODE_SYSTEM_ZAPEHR_RCM_CMS1500_REFFERING_PROVIDER_TYPE);
}

function createServiceItems(cms1500: Cms1500): ClaimItem[] | undefined {
  return cms1500.services?.map((service, index) => {
    const sequence = index + 1;
    validateDefined(service.procedures, `services[${index}].procedures`);
    const item: ClaimItem = {
      sequence: sequence,
      locationCodeableConcept: codeableConcept(
        validateDefined(service.placeOfService, `services[${index}].placeOfService`),
        CODE_SYSTEM_CMS_PLACE_OF_SERVICE
      ),
      revenue: service.emergency
        ? codeableConcept(EMERGENCY_REVENUE_CODE, CODE_SYSTEM_ZAPEHR_RCM_CMS1500_REVENUE_CODE)
        : undefined,
      productOrService: {
        coding: [
          {
            code: validateDefined(service.procedures?.cptOrHcpcs, `services[${index}].procedures.cptOrHcpcs`),
            system: CODE_SYSTEM_CPT,
          },
        ],
      },
      diagnosisSequence: [validateDefined(service.diagnosisPointer, `services[${index}].diagnosisPointer`)].map(
        (pointer) => pointer.charCodeAt(0) - 'A'.charCodeAt(0) + 1
      ),
      unitPrice: money(validateDefined(service.charges, `services[${index}].charges`)),
      quantity: {
        value: validateDefined(service.daysOrUnits, `services[${index}].daysOrUnits`),
      },
      careTeamSequence: [index + 2],
      encounter: [
        {
          reference: service.encounter,
        },
      ],
    };
    const start = validateDefined(service.datesOfService?.from, `services[${index}].datesOfService.from`);
    item.servicedPeriod = {
      start: start,
      end: service.datesOfService?.to ? service.datesOfService.to : start,
    };
    if (service.procedures?.modifiers) {
      item.modifier = service.procedures.modifiers.map((modifier) =>
        codeableConcept(modifier, CODE_SYSTEM_ZAPEHR_RCM_CMS1500_PROCEDURE_MODIFIER)
      );
    }
    return item;
  });
}

function icdSystemUrlFromIndicator(icdIndicator: string): string {
  if (icdIndicator === '9') {
    return CODE_SYSTEM_ICD_9;
  }
  if (icdIndicator === '0') {
    return CODE_SYSTEM_ICD_10;
  }
  throw new Error(`Unknown ICD indicator ${icdIndicator}`);
}
