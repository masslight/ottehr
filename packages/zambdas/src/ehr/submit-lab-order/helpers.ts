import Oystehr, { BatchInputRequest, User } from '@oystehr/sdk';
import {
  Account,
  Coverage,
  DocumentReference,
  Encounter,
  Location,
  Organization,
  Patient,
  Practitioner,
  Provenance,
  Questionnaire,
  QuestionnaireResponse,
  ServiceRequest,
  Specimen,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CoverageAndOrg,
  CoverageOrgRank,
  EXTERNAL_LAB_ERROR,
  getOrderNumber,
  getPresignedURL,
  getTimezone,
  isPSCOrder,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  LabPaymentMethod,
  ORDER_ITEM_UNKNOWN,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  paymentMethodFromCoverage,
  PaymentResources,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  Secrets,
} from 'utils';
import { createExternalLabsOrderFormPDF, getOrderFormDataConfig } from '../../shared/pdf/external-labs-order-form-pdf';
import { makeLabPdfDocumentReference, makeRelatedForLabsPDFDocRef } from '../../shared/pdf/labs-results-form-pdf';
import { PdfInfo } from '../../shared/pdf/pdf-utils';
import {
  AOEDisplayForOrderForm,
  getExternalLabOrderResourcesViaServiceRequest,
  LabOrderResources,
  sortCoveragesByPriority,
} from '../shared/labs';

export const LABS_DATE_STRING_FORMAT = 'MM/dd/yyyy hh:mm a ZZZZ';

type LabOrderResourcesExtended = LabOrderResources & {
  accountNumber: string;
  encounter: Encounter;
  mostRecentSampleCollectionDate?: DateTime<true>;
  timezone?: string;
  location: Location;
  coveragesAndOrgs?: CoverageAndOrg[];
  questionsAndAnswers?: AOEDisplayForOrderForm[];
};

export type testDataForOrderForm = {
  serviceRequestID: string;
  serviceRequest: ServiceRequest;
  serviceRequestCreatedDate: string;
  testName: string;
  testAssessments: { code: string; name: string }[]; // dx
  testPriority: string;
  aoeAnswers?: AOEDisplayForOrderForm[];
  mostRecentSampleCollectionDate?: DateTime<true>;
};

export type resourcesForOrderForm = {
  isManualOrder: boolean;
  isPscOrder: boolean;
  testDetails: testDataForOrderForm[];
  accountNumber: string;
  labOrganization: Organization;
  provider: Practitioner;
  patient: Patient;
  timezone: string | undefined;
  encounter: Encounter;
  location?: Location;
  paymentResources: PaymentResources;
  account: Account;
  labGeneratedEReq?: DocumentReference; // will be generated after submit to oystehr labs IF applicable (right now only for labcorp & quest)
  abnDocRef?: DocumentReference; // will be generated after submit to oystehr labs IF applicable (right now only for labcorp & quest)
};

export type OrderResourcesByOrderNumber = {
  [orderNumber: string]: resourcesForOrderForm;
};

type CoverageResult = {
  serviceRequestID: string;
  coveragesAndOrgs: CoverageAndOrg[] | undefined;
};

export async function getBundledOrderResources(
  oystehr: Oystehr,
  m2mToken: string, // needed to get questionnaire via the qr.questionnaire url
  serviceRequestIDs: string[],
  isManualOrder: boolean
): Promise<OrderResourcesByOrderNumber> {
  const promises = serviceRequestIDs.map((serviceRequestID) =>
    getExternalLabOrderResourcesViaServiceRequest(oystehr, serviceRequestID).then((result) => ({
      serviceRequestID,
      result,
    }))
  );
  const results = await Promise.all(promises).catch((e) => {
    console.log('error getting getting external lab resources', e);
    throw e;
  });

  const bundledOrders: { [orderNumber: string]: string[] } = {};
  const resourcesByServiceRequest: {
    [serviceRequestID: string]:
      | Omit<LabOrderResourcesExtended, 'accountNumber' | 'location'>
      | LabOrderResourcesExtended;
  } = {};

  const locationPromises: Array<Promise<{ serviceRequestID: string; location?: Location }>> = [];
  const coveragePromises: Array<Promise<CoverageResult>> = [];
  const aoeAnswerPromises: Array<
    Promise<{ serviceRequestID: string; questionsAndAnswers?: AOEDisplayForOrderForm[] }>
  > = [];

  results.forEach(({ serviceRequestID, result }) => {
    if (result.serviceRequest.status !== 'draft') {
      throw Error(`This order has already been submitted: ${result.serviceRequest.id}`);
    }

    // TODO: fix in future. Pretty sure we don't need this, as result.location is part of the LabOrderResources type
    const locationRef = result.serviceRequest.locationReference?.[0].reference;
    const locationPromise = makeLocationPromise(oystehr, serviceRequestID, locationRef);
    locationPromises.push(locationPromise);

    const patientIDToValidate = result.patient.id;

    const insuranceRefs = result.serviceRequest.insurance
      ?.map((ins) => {
        return ins.reference && ins.reference?.startsWith('Coverage/') ? ins.reference : undefined;
      })
      .filter((ref) => ref !== undefined);
    const coveragePromise = makeCoveragePromise(oystehr, serviceRequestID, patientIDToValidate, insuranceRefs);
    coveragePromises.push(coveragePromise);

    const questionnaireResponse = result.questionnaireResponse;
    const aoeAnswerPromise = makeQuestionnairePromise(serviceRequestID, questionnaireResponse, m2mToken);
    aoeAnswerPromises.push(aoeAnswerPromise);

    const orderNumber = getOrderNumber(result.serviceRequest);
    if (!orderNumber) throw Error(`ServiceRequest is missing a requisition number, ${result.serviceRequest}`);
    if (bundledOrders[orderNumber]) {
      bundledOrders[orderNumber].push(serviceRequestID);
    } else {
      bundledOrders[orderNumber] = [serviceRequestID];
    }

    const timezone = result.schedule ? getTimezone(result.schedule) : undefined;

    const sampleCollectionDate = getMostRecentCollectionDate(result.specimens)?.setZone(timezone);
    const sampleCollectionDateFormatted = sampleCollectionDate?.isValid ? sampleCollectionDate : undefined;

    // future TODO: we can move the check that every serviceRequest has a Location here
    resourcesByServiceRequest[serviceRequestID] = {
      ...result,
      mostRecentSampleCollectionDate: sampleCollectionDateFormatted,
      timezone,
    };
  });

  const [locationResults, coverageResults, aoeAnswerResults] = await Promise.all([
    Promise.all(locationPromises),
    Promise.all(coveragePromises),
    Promise.all(aoeAnswerPromises),
  ]);

  // Oystehr requires that all the locations be the same. We don't enforce that on the FE yet, so throwing a check here
  // future todo: enforce on FE that all tests in a bundle be ordered from same location
  if (!locationResults.length) {
    throw EXTERNAL_LAB_ERROR('No locations found for bundle');
  }
  const firstLocation = locationResults[0].location;
  if (
    !firstLocation ||
    !locationResults.every(
      (locRes) => locRes.location?.id === firstLocation?.id && locRes.location?.status === 'active'
    )
  ) {
    throw EXTERNAL_LAB_ERROR(`All tests must be ordered from the same Location/${firstLocation?.id}`);
  }

  const accountNumberByOrgRef = new Map<string, string>(
    firstLocation?.identifier
      ?.filter((id) => id.system === LAB_ACCOUNT_NUMBER_SYSTEM && id.value && id.assigner && id.assigner.reference)
      .map((id) => [id.assigner!.reference!, id.value!])
  );

  locationResults.forEach(({ serviceRequestID, location }) => {
    if (!location) {
      throw EXTERNAL_LAB_ERROR(`ServiceRequest/${serviceRequestID} must have a Location defined`);
    }
    const labOrderResourcesForSubmit = resourcesByServiceRequest[serviceRequestID];
    const accountNumber = accountNumberByOrgRef.get(`Organization/${labOrderResourcesForSubmit.labOrganization.id}`);
    if (!accountNumber) {
      throw EXTERNAL_LAB_ERROR(
        `No account number found for ${labOrderResourcesForSubmit.labOrganization.name} for ${location?.name} office`
      );
    }

    // doing this so the type check keeps us honest on location and accountNumber
    const resourcesWithLocationAndAccountNumber: LabOrderResourcesExtended = {
      ...labOrderResourcesForSubmit,
      location,
      accountNumber,
    };

    resourcesByServiceRequest[serviceRequestID] = resourcesWithLocationAndAccountNumber;
  });

  coverageResults.forEach(({ serviceRequestID, coveragesAndOrgs }) => {
    const labOrderResourcesForSubmit = resourcesByServiceRequest[serviceRequestID];
    resourcesByServiceRequest[serviceRequestID] = {
      ...labOrderResourcesForSubmit,
      coveragesAndOrgs,
    };
  });

  aoeAnswerResults.forEach(({ serviceRequestID, questionsAndAnswers }) => {
    const labOrderResourcesForSubmit = resourcesByServiceRequest[serviceRequestID];
    resourcesByServiceRequest[serviceRequestID] = {
      ...labOrderResourcesForSubmit,
      questionsAndAnswers,
    };
  });

  const bundledOrderResources: OrderResourcesByOrderNumber = {};
  Object.entries(bundledOrders).forEach(([orderNumber, serviceRequestIDs]) => {
    serviceRequestIDs.forEach((srID) => {
      const allResources = resourcesByServiceRequest[srID];
      const serviceRequest = allResources.serviceRequest;
      const sampleCollectionDate = allResources.mostRecentSampleCollectionDate;
      const aoeAnswers = allResources.questionsAndAnswers;
      const srTestDetail = getTestDataForOrderForm(serviceRequest, aoeAnswers, sampleCollectionDate);
      const isPscOrder = isPSCOrder(serviceRequest);

      function isLabOrderResourcesExtended(
        resources: LabOrderResourcesExtended | Omit<LabOrderResourcesExtended, 'location' | 'accountNumber'>
      ): resources is LabOrderResourcesExtended {
        return 'accountNumber' in resources && 'location' in resources;
      }

      if (!isLabOrderResourcesExtended(allResources)) {
        throw EXTERNAL_LAB_ERROR('resources do not contain location and/or account number');
      }

      if (bundledOrderResources[orderNumber]) {
        bundledOrderResources[orderNumber].testDetails.push(srTestDetail);
      } else {
        const paymentResources = makePaymentResourceConfig(
          allResources.serviceRequest.id,
          allResources.coveragesAndOrgs,
          allResources.account
        );
        // oystehr labs will validate that all these resources match for each ServiceRequest submitted within
        // a bundled order so there is no need for us to do that validation here, we will just take the resources from the first ServiceRequest for that bundle
        bundledOrderResources[orderNumber] = {
          isManualOrder,
          isPscOrder,
          testDetails: [srTestDetail],
          accountNumber: allResources.accountNumber,
          encounter: allResources.encounter,
          labOrganization: allResources.labOrganization,
          provider: allResources.practitioner,
          patient: allResources.patient,
          timezone: allResources.timezone,
          location: allResources.location,
          paymentResources,
          account: allResources.account,
        };
      }
    });
  });

  return bundledOrderResources;
}

function makeLocationPromise(
  oystehr: Oystehr,
  serviceRequestID: string,
  locationRef?: string
): Promise<{ serviceRequestID: string; location?: Location }> {
  // If no locationRef, return resolved promise with location undefined
  if (!locationRef) return Promise.resolve({ serviceRequestID, location: undefined });

  const locationID = locationRef.replace('Location/', '');
  return oystehr.fhir
    .get<Location>({
      resourceType: 'Location',
      id: locationID,
    })
    .then((location) => ({ serviceRequestID, location }));
}

function makeCoveragePromise(
  oystehr: Oystehr,
  serviceRequestID: string,
  patientIDToValidate: string | undefined,
  insuranceRefs?: string[]
): Promise<CoverageResult> {
  // If no insuranceRef, return resolved promise with undefined for coveragesAndOrgs
  if (!insuranceRefs || !insuranceRefs.length) {
    return Promise.resolve({ serviceRequestID, coveragesAndOrgs: undefined });
  }

  const coverageIDs = insuranceRefs.map((ref) => ref.replace('Coverage/', ''));
  return oystehr.fhir
    .search<Coverage | Organization | Patient>({
      resourceType: 'Coverage',
      params: [
        { name: '_id', value: coverageIDs.join(',') || 'UNKNOWN' },
        { name: '_include', value: 'Coverage:payor' },
        { name: '_include', value: 'Coverage:beneficiary' },
      ],
    })
    .then((bundle) => {
      const unbundledResults = bundle.unbundle();
      const coverages = unbundledResults.filter((resource) => resource.resourceType === 'Coverage');
      if (!coverages.length) throw EXTERNAL_LAB_ERROR('no coverage found');

      const insuranceOrganizations = unbundledResults.filter((resource) => resource.resourceType === 'Organization');
      if (!insuranceOrganizations.length) throw EXTERNAL_LAB_ERROR('organizations for insurance were not found');
      const payorRefToOrgMap = new Map<string, Organization>(
        insuranceOrganizations.map((org) => [`Organization/${org.id}`, org])
      );

      const coveragePatients = unbundledResults.filter((resource) => resource.resourceType === 'Patient');
      if (coveragePatients.length !== 1)
        throw EXTERNAL_LAB_ERROR('Found multiple patients when querying insurance info');
      const coveragePatient = coveragePatients[0];

      if (!coveragePatient || coveragePatient?.id !== patientIDToValidate) {
        throw Error(
          `The coverage beneficiary does not match the patient from the service request. Coverage patient id: ${coveragePatient?.id}. ServiceRequest patient id: ${patientIDToValidate} `
        );
      }

      // map the coverage to its payor
      const coveragesAndOrgs = coverages.map((coverage) => {
        const orgRef = coverage.payor.length ? coverage.payor[0].reference : '';
        const org = payorRefToOrgMap.get(orgRef ?? '');
        if (!org) throw EXTERNAL_LAB_ERROR(`No payor found for Coverage/${coverage.id}`);
        return {
          coverage,
          payorOrg: org,
        };
      });

      return { serviceRequestID, coveragesAndOrgs };
    });
}

function makeQuestionnairePromise(
  serviceRequestID: string,
  questionnaireResponse: QuestionnaireResponse | undefined,
  m2mToken: string
): Promise<{ serviceRequestID: string; questionsAndAnswers?: AOEDisplayForOrderForm[] }> {
  if (!questionnaireResponse) {
    return Promise.resolve({ serviceRequestID, questionsAndAnswers: undefined });
  }

  const questionnaireUrl = questionnaireResponse.questionnaire;
  if (!questionnaireUrl) {
    throw new Error(`QuestionnaireResponse is missing its questionnaire, ${questionnaireResponse.id}`);
  }

  const answers = questionnaireResponse.item;
  if (!answers) {
    // this will happen when there is an aoe but all the questions are optional and the user does not answer them
    return Promise.resolve({ serviceRequestID, questionsAndAnswers: undefined });
  }

  return fetch(questionnaireUrl, {
    headers: {
      Authorization: `Bearer ${m2mToken}`,
    },
  })
    .then((questionnaireRequest) => {
      return questionnaireRequest.json();
    })
    .then((questionnaire) => {
      const fhirQuestionnaire = questionnaire as Questionnaire;
      console.log('fhirQuestionnaire', fhirQuestionnaire);
      const questionsAndAnswers = answers
        .map((qrItem) => {
          const question = fhirQuestionnaire.item?.find((item) => item.linkId === qrItem.linkId);

          if (!question) throw Error(`question is not found on the questionnaire, link id: ${qrItem.linkId}`);
          let answerDisplay: string | undefined;

          if (question.type === 'text' || question.type === 'choice') {
            answerDisplay = qrItem.answer?.map((answerString) => answerString.valueString).join(', ');
          }
          if (question.type === 'boolean') {
            answerDisplay = qrItem.answer?.[0].valueBoolean === false ? 'No' : 'Yes';
          }
          if (question.type === 'date') {
            answerDisplay = qrItem.answer?.[0].valueDate;
          }
          if (question.type === 'decimal') {
            answerDisplay = qrItem.answer?.[0].valueDecimal?.toString();
          }
          if (question.type === 'integer') {
            answerDisplay = qrItem.answer?.[0].valueInteger?.toString();
          }

          const questionDisplay = question.text;
          if (!questionDisplay || !answerDisplay) {
            return null;
          }
          return { question: questionDisplay, answer: [answerDisplay] };
        })
        .filter((item): item is { question: string; answer: string[] } => !!item);

      return { serviceRequestID, questionsAndAnswers };
    });
}

function getMostRecentCollectionDate(specimens: Specimen[]): DateTime<true> | undefined {
  if (specimens.length === 0) return;

  const sampleCollectionDates = specimens
    .map((specimen) =>
      specimen.collection?.collectedDateTime ? DateTime.fromISO(specimen.collection?.collectedDateTime) : undefined
    )
    .filter((date) => date !== undefined && date.isValid);

  if (sampleCollectionDates.length > 0) {
    const mostRecentDate = DateTime.max(...sampleCollectionDates);
    if (mostRecentDate) return mostRecentDate;
  }

  return;
}

function getTestDataForOrderForm(
  sr: ServiceRequest,
  aoeAnswers?: AOEDisplayForOrderForm[],
  mostRecentSampleCollectionDate?: DateTime<true>
): testDataForOrderForm {
  if (!sr.reasonCode) throw Error('ServiceRequest is missing a reasonCode to specify diagnosis');

  const data: testDataForOrderForm = {
    serviceRequestID: sr.id || ORDER_ITEM_UNKNOWN,
    serviceRequest: sr,
    serviceRequestCreatedDate: sr.authoredOn || '',
    testName:
      sr.code?.coding?.find((coding) => coding.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.display || ORDER_ITEM_UNKNOWN,
    testAssessments: sr.reasonCode?.map((code) => ({
      code: code.coding?.[0].code || ORDER_ITEM_UNKNOWN,
      name: code.text || ORDER_ITEM_UNKNOWN,
    })),
    testPriority: sr.priority || ORDER_ITEM_UNKNOWN,
    aoeAnswers,
    mostRecentSampleCollectionDate,
  };

  return data;
}

export function makeProvenanceResourceRequest(
  now: DateTime<true>,
  serviceRequestID: string,
  currentUser: User
): BatchInputRequest<Provenance> {
  const provenanceFhir: Provenance = {
    resourceType: 'Provenance',
    target: [
      {
        reference: `ServiceRequest/${serviceRequestID}`,
      },
    ],
    recorded: now.toISO(),
    agent: [
      {
        who: { reference: currentUser?.profile },
      },
    ],
    activity: {
      coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.submit],
    },
  };

  return {
    method: 'POST',
    url: '/Provenance',
    resource: provenanceFhir,
  };
}

export async function makeOrderFormsAndDocRefs(
  input: OrderResourcesByOrderNumber,
  now: DateTime<true>,
  secrets: Secrets | null,
  token: string,
  oystehr: Oystehr
): Promise<string[]> {
  const orderFormPromises = Object.entries(input).map(async ([orderNumber, resources]) => {
    console.log('making form order for', orderNumber);
    const patientId = resources.patient.id;
    const encounterId = resources.encounter.id;
    const serviceRequestIds = resources.testDetails.map((detail) => detail.serviceRequestID);
    if (!patientId) throw new Error(`Patient id is missing, cannot create order form`);
    if (!encounterId) throw new Error(`Encounter id is missing, cannot create order form`);

    let pdfInfo: PdfInfo | undefined;
    let labGeneratedEReqUrl: string | undefined;
    let abnUrl: string | undefined;
    if (resources.labGeneratedEReq) {
      labGeneratedEReqUrl = resources.labGeneratedEReq.content[0].attachment.url || '';
    } else {
      const orderFormDataConfig = getOrderFormDataConfig(orderNumber, resources, now, oystehr);
      pdfInfo = await createExternalLabsOrderFormPDF(orderFormDataConfig, patientId, secrets, token);
    }
    if (resources.abnDocRef) {
      abnUrl = resources.abnDocRef.content[0].attachment.url || '';
    }

    return {
      pdfInfo,
      labGeneratedEReqUrl,
      abnUrl,
      patientId,
      encounterId,
      serviceRequestIds,
    };
  });
  const orderFormPdfDetails = await Promise.all(orderFormPromises);

  const { docRefPromises, presignedOrderFormURLPromises } = orderFormPdfDetails.reduce(
    (
      acc: { docRefPromises: Promise<DocumentReference>[]; presignedOrderFormURLPromises: Promise<string>[] },
      detail
    ) => {
      if (detail.pdfInfo) {
        acc.docRefPromises.push(
          makeLabPdfDocumentReference({
            oystehr,
            type: 'order',
            pdfInfo: detail.pdfInfo,
            patientID: detail.patientId,
            encounterID: detail.encounterId,
            related: makeRelatedForLabsPDFDocRef({ serviceRequestIds: detail.serviceRequestIds }),
          })
        );
        acc.presignedOrderFormURLPromises.push(getPresignedURL(detail.pdfInfo.uploadURL, token));
      } else if (detail.labGeneratedEReqUrl) {
        acc.presignedOrderFormURLPromises.push(getPresignedURL(detail.labGeneratedEReqUrl, token));
      }
      if (detail.abnUrl) {
        acc.presignedOrderFormURLPromises.push(getPresignedURL(detail.abnUrl, token));
      }
      return acc;
    },
    { docRefPromises: [], presignedOrderFormURLPromises: [] }
  );

  const [_docRefs, presignedOrderFormURLs] = await Promise.all([
    Promise.all(docRefPromises),
    Promise.all(presignedOrderFormURLPromises),
  ]);

  return presignedOrderFormURLs;
}

function makePaymentResourceConfig(
  serviceRequestID: string | undefined,
  coveragesAndOrgs: CoverageAndOrg[] | undefined,
  account: Account
): PaymentResources {
  console.log('in makePaymentResourceConfig');
  console.log(`These are the coveragesAndOrgs: ${JSON.stringify(coveragesAndOrgs)}`);
  console.log('For ServiceRequest', serviceRequestID);
  if (!coveragesAndOrgs || !coveragesAndOrgs.length) return { type: LabPaymentMethod.SelfPay };

  const clientBillCoverageAndOrg = coveragesAndOrgs.find(
    (data) => paymentMethodFromCoverage(data.coverage) === LabPaymentMethod.ClientBill
  );
  const selfPayCoverage = coveragesAndOrgs.find(
    (data) => paymentMethodFromCoverage(data.coverage) === LabPaymentMethod.SelfPay
  );

  if (clientBillCoverageAndOrg && coveragesAndOrgs.length === 1) {
    return { type: LabPaymentMethod.ClientBill, coverage: clientBillCoverageAndOrg.coverage };
  } else if (
    coveragesAndOrgs.every((data) => paymentMethodFromCoverage(data.coverage) === LabPaymentMethod.Insurance)
  ) {
    const sortedCoverages = sortCoveragesByPriority(
      account,
      coveragesAndOrgs.map((cAndO) => cAndO.coverage)
    );

    // this should only happen if there are no Coverages passed, which we know there would be
    if (!sortedCoverages) throw new Error('Error sorting coverages in makePaymentResourceConfig, none returned');
    console.log(
      `These are the sorted sortedCoverages ${JSON.stringify(sortedCoverages.map((e) => `Coverage/${e.id}`))}`
    );

    const coverageRefToResourcesMap = new Map<string, CoverageAndOrg>(
      coveragesAndOrgs.map((e) => [`Coverage/${e.coverage.id}`, e])
    );
    const coveragesAndOrgsWithRank: CoverageOrgRank[] = sortedCoverages.map((coverage, idx) => {
      const coverageAndOrg = coverageRefToResourcesMap.get(`Coverage/${coverage.id}`);
      if (!coverageAndOrg)
        throw EXTERNAL_LAB_ERROR(`Could not map Coverage back to its coverageAndOrg: Coverage/${coverage.id}`);

      return {
        coverage: coverageAndOrg.coverage,
        payorOrg: coverageAndOrg.payorOrg,
        coverageRank: idx + 1,
      };
    });

    console.log(
      `These are the coveragesAndOrgsWithRank: ${JSON.stringify(
        coveragesAndOrgsWithRank.map((e) => {
          return {
            coverage: `Coverage/${e.coverage}`,
            insuranceOrganization: `Organization/${e.payorOrg}`,
            coverageRank: e.coverageRank,
          };
        })
      )}`
    );

    return { type: LabPaymentMethod.Insurance, coverageAndOrgs: coveragesAndOrgsWithRank };
  } else if (selfPayCoverage && coveragesAndOrgs.length === 1) {
    return { type: LabPaymentMethod.SelfPay, coverage: selfPayCoverage.coverage };
  } else {
    const coverageIdWithPaymentMethod = coveragesAndOrgs.map((data) => ({
      coverageId: data.coverage.id,
      paymentMethod: paymentMethodFromCoverage(data.coverage),
    }));
    console.log(
      `coverages parsed have an unexpected combination of payment methods: ${JSON.stringify(
        coverageIdWithPaymentMethod
      )}`
    );
    // right now labs can only have one type of payment method: self pay or insurance or client bill
    // possibly in the future we could allow a combo of self pay and insurance (maybe idk) and then this error is not needed
    throw new Error(
      `Could not determine the payment method based on coverages linked to this service request ${serviceRequestID}`
    );
  }
}
