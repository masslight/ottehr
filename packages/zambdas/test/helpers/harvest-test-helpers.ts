import { BatchInputPostRequest } from '@oystehr/sdk';
import { Account, Coverage, Patient, QuestionnaireResponseItem, RelatedPerson } from 'fhir/r4b';
import { uuid } from 'short-uuid';
import altGuarantor from '../data/alt-guarantor.json';

export const fillReferences = (template: any, references: string[]): any => {
  let stringifiedTemplate = JSON.stringify(template);
  references.forEach((reference) => {
    const [resourceType] = reference.split('/');
    stringifiedTemplate = stringifiedTemplate.replace(
      new RegExp(`{{${resourceType.toUpperCase()}_REF}}`, 'g'),
      reference
    );
  });
  return JSON.parse(stringifiedTemplate);
};

interface BatchPostInput {
  primary?: {
    coverage: Coverage;
    subscriber: RelatedPerson | Patient;
    ensureOrder: boolean;
    containedSubscriber?: boolean;
  };
  secondary?: {
    coverage: Coverage;
    subscriber: RelatedPerson | Patient;
    ensureOrder: boolean;
    containedSubscriber?: boolean;
  };
  account?: Account;
  containedGuarantor?: RelatedPerson | Patient;
  persistedGuarantor?: RelatedPerson | Patient;
  persistedGuarantorReference?: string;
}

export const batchTestInsuranceWrites = (
  input: BatchPostInput
): BatchInputPostRequest<Coverage | RelatedPerson | Patient | Account>[] => {
  const { primary, secondary, account, containedGuarantor, persistedGuarantor, persistedGuarantorReference } = input;

  if (containedGuarantor && persistedGuarantor) {
    throw new Error('Cannot have both contained and persisted guarantor');
  }
  if (containedGuarantor && persistedGuarantorReference) {
    throw new Error('Cannot have both contained and persisted guarantor reference');
  }

  if (persistedGuarantor && persistedGuarantorReference) {
    throw new Error('Cannot have both persisted guarantor and persisted guarantor reference');
  }

  const primaryCoveragePostURL = primary ? `urn:uuid:${uuid()}` : undefined;
  const secondaryCoveragePostURL = secondary ? `urn:uuid:${uuid()}` : undefined;

  const batchRequests: BatchInputPostRequest<Coverage | RelatedPerson | Patient | Account>[] = [];

  if (primary) {
    const contained = primary.containedSubscriber;
    const primaryRPPostURL = contained ? '#coverageSubscriber' : `urn:uuid:${uuid()}`;
    const primaryCoveragePost: BatchInputPostRequest<Coverage> = {
      method: 'POST',
      fullUrl: primaryCoveragePostURL,
      url: 'Coverage',
      resource: {
        ...primary.coverage,
        subscriber: { reference: primaryRPPostURL },
        id: primaryCoveragePostURL,
        contained: contained ? [{ ...primary.subscriber, id: 'coverageSubscriber' }] : undefined,
        order: primary.ensureOrder ? 1 : primary.coverage.order,
      },
    };
    batchRequests.push(primaryCoveragePost);
    if (!contained) {
      const primaryRPPost: BatchInputPostRequest<Patient | RelatedPerson> = {
        resource: primary.subscriber,
        method: 'POST',
        url: primary.subscriber.resourceType,
        fullUrl: primaryRPPostURL,
      };
      batchRequests.push(primaryRPPost);
    }
  }

  if (secondary) {
    const contained = secondary.containedSubscriber;
    const secondaryRPPostURL = contained ? '#coverageSubscriber' : `urn:uuid:${uuid()}`;
    const secondaryCoveragePost: BatchInputPostRequest<Coverage> = {
      method: 'POST',
      fullUrl: secondaryCoveragePostURL,
      url: 'Coverage',
      resource: {
        ...secondary.coverage,
        subscriber: { reference: secondaryRPPostURL },
        id: secondaryCoveragePostURL,
        contained: contained ? [{ ...secondary.subscriber, id: 'coverageSubscriber' }] : undefined,
        order: secondary.ensureOrder ? 2 : secondary.coverage.order,
      },
    };
    batchRequests.push(secondaryCoveragePost);
    if (!contained) {
      const secondaryRPPost: BatchInputPostRequest<Patient | RelatedPerson> = {
        resource: secondary.subscriber,
        method: 'POST',
        url: secondary.subscriber.resourceType,
        fullUrl: secondaryRPPostURL,
      };
      batchRequests.push(secondaryRPPost);
    }
  }
  if (account) {
    const coverage: Account['coverage'] = secondaryCoveragePostURL || primaryCoveragePostURL ? [] : undefined;
    if (coverage !== undefined) {
      if (primaryCoveragePostURL) {
        coverage.push({ coverage: { reference: primaryCoveragePostURL }, priority: 1 });
      }
      if (secondaryCoveragePostURL) {
        coverage.push({ coverage: { reference: secondaryCoveragePostURL }, priority: 2 });
      }
    }
    const accountToPost: Account = {
      ...account,
      coverage,
    };
    if (containedGuarantor) {
      accountToPost.contained = [containedGuarantor];
      accountToPost.guarantor = [{ party: { reference: `#${containedGuarantor.id}` } }];
    } else if (persistedGuarantor) {
      const guarantorPostUrl = `urn:uuid:${uuid()}`;
      batchRequests.push({
        method: 'POST',
        resource: persistedGuarantor,
        url: persistedGuarantor.resourceType,
        fullUrl: guarantorPostUrl,
      });
      accountToPost.guarantor = [{ party: { reference: guarantorPostUrl } }];
    } else if (persistedGuarantorReference) {
      accountToPost.guarantor = [{ party: { reference: persistedGuarantorReference } }];
    }
    const accountPost: BatchInputPostRequest<Account> = {
      method: 'POST',
      resource: accountToPost,
      url: 'Account',
    };
    batchRequests.push(accountPost);
  }
  return batchRequests;
};

export const replaceGuarantorWithPatient = (item: QuestionnaireResponseItem[]): QuestionnaireResponseItem[] => {
  return item.map((i) => {
    if (i.linkId === 'responsible-party-page') {
      return {
        ...i,
        item: replaceGuarantorWithPatient(i.item ?? []),
      };
    }
    if (i.linkId === 'responsible-party-relationship') {
      return { ...i, answer: [{ valueString: 'Self' }] };
    }
    return i;
  });
};

export const replaceGuarantorWithAlternate = (
  item: QuestionnaireResponseItem[],
  parameterized?: any
): QuestionnaireResponseItem[] => {
  return [
    ...item.map((i) => {
      if (i.linkId === 'responsible-party-page') {
        return parameterized ?? altGuarantor;
      }
      return i;
    }),
  ];
};

export const replaceSubscriberWithPatient = (
  item: QuestionnaireResponseItem[],
  options: { primary: boolean; secondary: boolean }
): QuestionnaireResponseItem[] => {
  return item.map((i) => {
    if (i.linkId === 'payment-option-page' || i.linkId === 'secondary-insurance') {
      return {
        ...i,
        item: replaceSubscriberWithPatient(i.item ?? [], options),
      };
    }
    if (i.linkId === 'patient-relationship-to-insured-2' && options.secondary) {
      return { ...i, answer: [{ valueString: 'Self' }] };
    }
    if (i.linkId === 'patient-relationship-to-insured' && options.primary) {
      return { ...i, answer: [{ valueString: 'Self' }] };
    }
    return i;
  });
};
