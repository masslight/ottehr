import { Claim, ClaimAccident, ClaimSupportingInfo, CodeableConcept, Coding } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FHIR_EXTENSION } from 'utils';
import {
  AdditionalInformationFormValues,
  BillingFormValues,
  DiagnosesFormValues,
  SLBProviderFormValues,
} from './form-values.types';
import { getDateFromISO } from './resources.helper';

function getCode(codeableConcept: CodeableConcept | undefined, system: string): string | undefined {
  return codeableConcept?.coding?.find((coding) => coding.system === system)?.code;
}

function isSupportingInfo(supportingInfo: ClaimSupportingInfo, category: string): boolean {
  return getCode(supportingInfo.category, FHIR_EXTENSION.Claim.claimInformationCategory.url) === category;
}

function findSupportingInfo(
  supportingInfo: ClaimSupportingInfo[] | undefined,
  category: string
): ClaimSupportingInfo | undefined {
  return supportingInfo?.find((supportingInfo) => isSupportingInfo(supportingInfo, category));
}

export const getClaimData = (
  claim?: Claim
): {
  conditionRelatedToEmployment: boolean;
  conditionRelatedToAutoAccident: boolean;
  autoAccidentState?: string;
  conditionRelatedToOtherAccident: boolean;
  conditionRelatedToMixed: string;
  claimCode1?: string;
  claimCode2?: string;
  claimCode3?: string;
  claimCodes: string;
  dateOfIllness?: DateTime;
  unableToWork: { start?: DateTime; end?: DateTime };
  unableToWorkString?: string;
  hospitalizationDates: { start?: DateTime; end?: DateTime };
  hospitalizationDatesString?: string;
  resubmissionCode?: string;
  priorAuthNumber?: string;
  diagnoses?: { code: string; display: string }[];
  diagnosesComment?: string;
  facilityId?: string;
  billingItems?: {
    date: [DateTime | null, DateTime | null];
    // place: string;
    emergency: boolean;
    code: string;
    modifiers: string;
    // pointerA: boolean;
    // pointerB: boolean;
    charges: number;
    units: number;
    // epsdt: boolean;
    // provider: string;
  }[];
  totalCharge?: number;
  patientPaid?: number;
} => {
  // 10a
  const conditionRelatedToEmployment = !!claim?.accident?.type?.coding?.find(
    (coding) => coding.code === 'WPA' && coding.system === FHIR_EXTENSION.Claim.v3_ActCode.url
  );
  // 10b
  const conditionRelatedToAutoAccident = !!claim?.accident?.type?.coding?.find(
    (coding) => coding.code === 'MVA' && coding.system === FHIR_EXTENSION.Claim.v3_ActCode.url
  );
  const autoAccidentState = claim?.accident?.locationAddress?.state;
  // 10c
  const conditionRelatedToOtherAccident = !!claim?.accident?.type?.coding?.find(
    (coding) => coding.code === undefined && coding.system === FHIR_EXTENSION.Claim.v3_ActCode.url
  );

  const conditionRelatedToMixed = [
    conditionRelatedToEmployment && 'a. Employment',
    conditionRelatedToAutoAccident && autoAccidentState && `b. Auto accident, ${autoAccidentState}`,
    conditionRelatedToOtherAccident && 'c. Other accident',
  ]
    .filter((value) => !!value)
    .join(', ');

  // 10d
  const claimCodeExtensions = claim?.extension?.filter(
    (extension) => extension.url === FHIR_EXTENSION.Claim.claimConditionCode.url
  );
  const claimCode1 = claimCodeExtensions?.[0]?.valueString;
  const claimCode2 = claimCodeExtensions?.[1]?.valueString;
  const claimCode3 = claimCodeExtensions?.[2]?.valueString;

  const claimCodes = [claimCode1, claimCode2, claimCode3].filter((value) => !!value).join(', ');

  // 14
  const dateOfIllness = claim && getDateFromISO(findSupportingInfo(claim.supportingInfo, 'onset')?.timingDate);

  // 16
  const employmentImpacted = claim && findSupportingInfo(claim.supportingInfo, 'employmentimpacted');

  const unableToWork = {
    start: getDateFromISO(employmentImpacted?.timingPeriod?.start),
    end: getDateFromISO(employmentImpacted?.timingPeriod?.end),
  };

  const unableToWorkString =
    unableToWork.start &&
    unableToWork.end &&
    `${unableToWork.start.toFormat('MM/dd/yyyy')}-${unableToWork.end.toFormat('MM/dd/yyyy')}`;

  // 18
  const hospitalized = claim && findSupportingInfo(claim.supportingInfo, 'hospitalized');

  const hospitalizationDates = {
    start: getDateFromISO(hospitalized?.timingPeriod?.start),
    end: getDateFromISO(hospitalized?.timingPeriod?.end),
  };

  const hospitalizationDatesString =
    hospitalizationDates.start &&
    hospitalizationDates.end &&
    `${hospitalizationDates.start.toFormat('MM/dd/yyyy')}-${hospitalizationDates.end.toFormat('MM/dd/yyyy')}`;

  // 22 resubmission code
  const resubmissionCode = claim?.related?.[0]?.relationship?.coding?.find(
    (coding) => coding.system === FHIR_EXTENSION.Claim.resubmissionRelationship.url
  )?.code;

  // 23
  const priorAuthNumber = claim?.insurance?.[0]?.preAuthRef?.[0];

  // 21
  const diagnoses = claim?.diagnosis?.map((diagnosis) => ({
    code: diagnosis.diagnosisCodeableConcept?.coding?.[0]?.code || '',
    display: diagnosis.diagnosisCodeableConcept?.coding?.[0]?.display || '',
  }));

  const diagnosesComment = claim?.extension?.find(
    (extension) => extension.url === FHIR_EXTENSION.Claim.claimDiagnosesComment.url
  )?.valueString;

  // 32
  const facilityId = claim?.facility?.reference?.split('/')?.[1];

  // 24
  const billingItems = claim?.item?.map((item) => ({
    date: [
      item.servicedPeriod?.start ? DateTime.fromISO(item.servicedPeriod.start) : null,
      item.servicedPeriod?.end ? DateTime.fromISO(item.servicedPeriod.end) : null,
    ] as [DateTime | null, DateTime | null],
    // place: '', // ?
    emergency: !!item.revenue?.coding?.find(
      (coding) => coding.system === FHIR_EXTENSION.Claim.revenueCode.url && coding.code === '1001'
    ),
    code:
      item.productOrService?.coding?.find((coding) => coding.system === 'http://www.ama-assn.org/go/cpt')?.code || '',
    modifiers:
      item.modifier
        ?.filter(
          (modifier) => modifier?.coding?.find((coding) => coding.system === FHIR_EXTENSION.Claim.procedureModifier.url)
        )
        .map(
          (modifier) =>
            modifier?.coding?.find((coding) => coding.system === FHIR_EXTENSION.Claim.procedureModifier.url)?.code
        )
        .join(', ') || '',
    // pointerA: false, // ?
    // pointerB: false, // ?
    charges: item.unitPrice?.value || 0,
    units: item.quantity?.value || 0,
    // epsdt: false, // ?
    // provider: '', // ?
  }));

  // 28
  const totalCharge = claim?.total?.value;

  // 29
  const patientPaid = claim?.extension?.find((extension) => extension.url === FHIR_EXTENSION.Claim.patientPaid.url)
    ?.valueMoney?.value;

  return {
    conditionRelatedToEmployment,
    conditionRelatedToAutoAccident,
    autoAccidentState,
    conditionRelatedToOtherAccident,
    conditionRelatedToMixed,
    claimCode1,
    claimCode2,
    claimCode3,
    claimCodes,
    dateOfIllness,
    unableToWork,
    unableToWorkString,
    hospitalizationDates,
    hospitalizationDatesString,
    resubmissionCode,
    priorAuthNumber,
    diagnoses,
    diagnosesComment,
    facilityId,
    billingItems,
    totalCharge,
    patientPaid,
  };
};

const createAccidentCodingByCode = (code: 'WPA' | 'MVA' | undefined): Coding => ({
  code,
  system: FHIR_EXTENSION.Claim.v3_ActCode.url,
});

export const mapAdditionalInformationToClaimResource = (
  claim: Claim,
  additionalInformation: AdditionalInformationFormValues
): Claim => {
  const claimCopy = structuredClone(claim) as Claim;

  // 10a-c
  if (
    additionalInformation.relatedToEmployment ||
    additionalInformation.relatedToAutoAccident ||
    additionalInformation.relatedToOtherAccident
  ) {
    const claimAccident: ClaimAccident = { date: '', type: { coding: [] } };

    if (additionalInformation.relatedToEmployment) {
      claimAccident.type!.coding!.push(createAccidentCodingByCode('WPA'));
    }
    if (additionalInformation.relatedToAutoAccident) {
      claimAccident.type!.coding!.push(createAccidentCodingByCode('MVA'));
      claimAccident.locationAddress = { state: additionalInformation.relatedToAutoAccident };
    }
    if (additionalInformation.relatedToOtherAccident) {
      claimAccident.type!.coding!.push(createAccidentCodingByCode(undefined));
    }

    claimCopy.accident = claimAccident;
  } else {
    claimCopy.accident = undefined;
  }

  // 10d
  const claimCodes = additionalInformation.claimCodes
    .trim()
    .split(' ')
    .filter((c) => c)
    .slice(0, 3);

  claimCopy.extension = [
    ...(claimCopy.extension || []).filter((extension) => extension.url !== FHIR_EXTENSION.Claim.claimConditionCode.url),
    ...claimCodes.map((code) => ({ url: FHIR_EXTENSION.Claim.claimConditionCode.url, valueString: code })),
  ];

  if (claimCopy.extension.length === 0) {
    claimCopy.extension = undefined;
  }

  // 14
  if (additionalInformation.illness) {
    const illnessSupportingInfo = {
      timingDate: additionalInformation.illness?.toISO() || undefined,
      category: { coding: [{ system: FHIR_EXTENSION.Claim.claimInformationCategory.url, code: 'onset' }] },
    };
    let changed = false;

    claimCopy.supportingInfo = claimCopy.supportingInfo?.map((supportingInfo) => {
      if (isSupportingInfo(supportingInfo, 'onset')) {
        changed = true;
        return {
          ...supportingInfo,
          ...illnessSupportingInfo,
        };
      } else {
        return supportingInfo;
      }
    });

    if (!changed) {
      claimCopy.supportingInfo = [
        ...(claimCopy.supportingInfo || []),
        {
          ...illnessSupportingInfo,
          sequence: 2,
        },
      ];
    }
  } else {
    claimCopy.supportingInfo = claimCopy.supportingInfo?.filter(
      (supportingInfo) => !isSupportingInfo(supportingInfo, 'onset')
    );
  }

  // 16
  if (additionalInformation.unableToWork[0] && additionalInformation.unableToWork[1]) {
    const unableToWorkSupportingInfo = {
      timingPeriod: {
        start: additionalInformation.unableToWork[0]?.toISO() || undefined,
        end: additionalInformation.unableToWork[1]?.toISO() || undefined,
      },
      category: { coding: [{ system: FHIR_EXTENSION.Claim.claimInformationCategory.url, code: 'employmentimpacted' }] },
    };
    let changed = false;

    claimCopy.supportingInfo = claimCopy.supportingInfo?.map((supportingInfo) => {
      if (isSupportingInfo(supportingInfo, 'employmentimpacted')) {
        changed = true;
        return {
          ...supportingInfo,
          ...unableToWorkSupportingInfo,
        };
      } else {
        return supportingInfo;
      }
    });

    if (!changed) {
      claimCopy.supportingInfo = [
        ...(claimCopy.supportingInfo || []),
        {
          ...unableToWorkSupportingInfo,
          sequence: 3,
        },
      ];
    }
  } else {
    claimCopy.supportingInfo = claimCopy.supportingInfo?.filter(
      (supportingInfo) => !isSupportingInfo(supportingInfo, 'employmentimpacted')
    );
  }

  // 18
  if (additionalInformation.hospitalization[0] && additionalInformation.hospitalization[1]) {
    const hospitalizationSupportingInfo = {
      timingPeriod: {
        start: additionalInformation.hospitalization[0]?.toISO() || undefined,
        end: additionalInformation.hospitalization[1]?.toISO() || undefined,
      },
      category: { coding: [{ system: FHIR_EXTENSION.Claim.claimInformationCategory.url, code: 'hospitalized' }] },
    };
    let changed = false;

    claimCopy.supportingInfo = claimCopy.supportingInfo?.map((supportingInfo) => {
      if (isSupportingInfo(supportingInfo, 'hospitalized')) {
        changed = true;
        return {
          ...supportingInfo,
          ...hospitalizationSupportingInfo,
        };
      } else {
        return supportingInfo;
      }
    });

    if (!changed) {
      claimCopy.supportingInfo = [
        ...(claimCopy.supportingInfo || []),
        {
          ...hospitalizationSupportingInfo,
          sequence: 4,
        },
      ];
    }
  } else {
    claimCopy.supportingInfo = claimCopy.supportingInfo?.filter(
      (supportingInfo) => !isSupportingInfo(supportingInfo, 'hospitalized')
    );
  }

  // 22
  if (additionalInformation.resubmissionCode) {
    claimCopy.related = claimCopy.related?.map((related, index) =>
      index === 0
        ? {
            ...related,
            relationship: {
              ...related.relationship,
              coding: related.relationship?.coding?.find(
                (coding) => coding.system === FHIR_EXTENSION.Claim.resubmissionRelationship.url
              )
                ? related.relationship?.coding?.map((coding) =>
                    coding.system === FHIR_EXTENSION.Claim.resubmissionRelationship.url
                      ? { ...coding, code: additionalInformation.resubmissionCode }
                      : coding
                  )
                : [
                    ...(related.relationship?.coding || []),
                    {
                      system: FHIR_EXTENSION.Claim.resubmissionRelationship.url,
                      code: additionalInformation.resubmissionCode,
                    },
                  ],
            },
          }
        : related
    );
  } else {
    claimCopy.related = claimCopy.related?.map((related, index) =>
      index === 0
        ? {
            ...related,
            relationship: {
              ...related.relationship,
              coding: related.relationship?.coding?.filter(
                (coding) => coding.system !== FHIR_EXTENSION.Claim.resubmissionRelationship.url
              ),
            },
          }
        : related
    );
  }

  // 23
  claimCopy.insurance = claimCopy.insurance.map((insurance, index) =>
    index === 0
      ? {
          ...insurance,
          preAuthRef: additionalInformation.authorizationNumber
            ? [additionalInformation.authorizationNumber]
            : undefined,
        }
      : insurance
  );

  return claimCopy;
};

export const mapDiagnosesToClaimResource = (claim: Claim, diagnoses: DiagnosesFormValues): Claim => {
  const claimCopy = structuredClone(claim) as Claim;

  claimCopy.extension = [
    ...(claimCopy.extension || []).filter(
      (extension) => extension.url !== FHIR_EXTENSION.Claim.claimDiagnosesComment.url
    ),
    ...(diagnoses.comment.trim()
      ? [{ url: FHIR_EXTENSION.Claim.claimDiagnosesComment.url, valueString: diagnoses.comment.trim() }]
      : []),
  ];

  if (claimCopy.extension.length === 0) {
    claimCopy.extension = undefined;
  }

  claimCopy.diagnosis = diagnoses.items.map((item, index) => ({
    sequence: index + 1,
    diagnosisCodeableConcept: {
      coding: [
        {
          code: item?.code,
          display: item?.display,
        },
      ],
    },
  }));

  if (claimCopy.diagnosis.length === 0) {
    claimCopy.diagnosis = undefined;
  }

  return claimCopy;
};

export const mapBillingToClaimResource = (claim: Claim, billing: BillingFormValues): Claim => {
  const claimCopy = structuredClone(claim) as Claim;

  if (isNaN(billing.payment)) {
    claimCopy.extension = claimCopy.extension?.filter(
      (extension) => extension.url !== FHIR_EXTENSION.Claim.patientPaid.url
    );
  } else {
    const paymentExtension = { url: FHIR_EXTENSION.Claim.patientPaid.url, valueMoney: { value: billing.payment } };
    let changed = false;

    claimCopy.extension = claimCopy.extension?.map((extension) => {
      if (extension.url === FHIR_EXTENSION.Claim.patientPaid.url) {
        changed = true;
        return paymentExtension;
      }
      return extension;
    });

    if (!changed) {
      claimCopy.extension = [...(claimCopy.extension || []), paymentExtension];
    }
  }

  if (claimCopy.extension?.length === 0) {
    claimCopy.extension = undefined;
  }

  if (billing.items.length === 0) {
    claimCopy.total = { value: 0 };
    claimCopy.item = undefined;
  } else {
    claimCopy.total = {
      value: billing.items.reduce((prev, curr) => {
        prev += curr.charges;
        return prev;
      }, 0),
    };

    claimCopy.item = billing.items.map((item, index) => ({
      sequence: index + 1,
      productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: item.code }] },
      servicedPeriod: {
        start: item.date[0]?.toISO() || undefined,
        end: item.date[1]?.toISO() || undefined,
      },
      revenue: item.emergency
        ? { coding: [{ system: FHIR_EXTENSION.Claim.revenueCode.url, coding: '1001' }] }
        : undefined,
      unitPrice: { value: item.charges },
      quantity: { value: item.units },
      modifier:
        item.modifiers.split(', ').length > 0
          ? item.modifiers
              .split(', ')
              .map((modifier) => ({ coding: [{ system: FHIR_EXTENSION.Claim.procedureModifier.url, code: modifier }] }))
          : undefined,
    }));
  }

  return claimCopy;
};

export const mapSLBProviderToClaimResource = (claim: Claim, slbProvider: SLBProviderFormValues): Claim => {
  const claimCopy = structuredClone(claim) as Claim;

  if (slbProvider.location?.id) {
    claimCopy.facility = { reference: `Location/${slbProvider.location.id}` };
  }

  if (slbProvider.location?.managingOrganization?.reference) {
    claimCopy.provider = { reference: slbProvider.location.managingOrganization.reference };
  }

  return claimCopy;
};
