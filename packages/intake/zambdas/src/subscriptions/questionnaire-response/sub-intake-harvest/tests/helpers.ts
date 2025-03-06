import { BatchInputPostRequest } from '@oystehr/sdk';
import { Account, Coverage, Patient, RelatedPerson } from 'fhir/r4b';
import { uuid } from 'short-uuid';

export const fillReferences = (template: any, references: string[]): any => {
  let stringinfiedTemplate = JSON.stringify(template);
  references.forEach((reference) => {
    const [resourceType] = reference.split('/');
    // const resourceType regex in template looks like: {{resourceType.upperCased()_REF}}
    stringinfiedTemplate = stringinfiedTemplate.replace(
      new RegExp(`{{${resourceType.toUpperCase()}_REF}}`, 'g'),
      reference
    );
  });
  return JSON.parse(stringinfiedTemplate);
};

interface BatchPostInput {
  primary?: { coverage: Coverage; subscriber: RelatedPerson | Patient; ensureOrder: boolean };
  secondary?: { coverage: Coverage; subscriber: RelatedPerson | Patient; ensureOrder: boolean };
  account?: Account;
}

export const batchTestInsuranceWrites = (
  input: BatchPostInput
): BatchInputPostRequest<Coverage | RelatedPerson | Patient | Account>[] => {
  const { primary, secondary, account } = input;

  const primaryCoveragePostURL = primary ? `urn:uuid:${uuid()}` : undefined;
  const secondaryCoveragePostURL = secondary ? `urn:uuid:${uuid()}` : undefined;

  const batchRequests: BatchInputPostRequest<Coverage | RelatedPerson | Patient | Account>[] = [];

  if (primary) {
    const primaryRPPostURL = primary ? `urn:uuid:${uuid()}` : undefined;
    const primaryCoveragePost: BatchInputPostRequest<Coverage> = {
      method: 'POST',
      fullUrl: primaryCoveragePostURL,
      url: 'Coverage',
      resource: {
        ...primary.coverage,
        subscriber: { reference: primaryRPPostURL },
        id: primaryCoveragePostURL,
        contained: undefined,
        order: primary.ensureOrder ? 1 : primary.coverage.order,
      },
    };
    const primaryRPPost: BatchInputPostRequest<Patient | RelatedPerson> = {
      resource: primary.subscriber,
      method: 'POST',
      url: primary.subscriber.resourceType,
      fullUrl: primaryRPPostURL,
    };
    batchRequests.push(...[primaryCoveragePost, primaryRPPost]);
  }

  if (secondary) {
    const secondaryRPPostURL = secondary ? `urn:uuid:${uuid()}` : undefined;
    const secondaryCoveragePost: BatchInputPostRequest<Coverage> = {
      method: 'POST',
      fullUrl: secondaryCoveragePostURL,
      url: 'Coverage',
      resource: {
        ...secondary.coverage,
        subscriber: { reference: secondaryRPPostURL },
        id: secondaryCoveragePostURL,
        contained: undefined,
        order: secondary.ensureOrder ? 2 : secondary.coverage.order,
      },
    };
    const secondaryRPPost: BatchInputPostRequest<Patient | RelatedPerson> = {
      resource: secondary.subscriber,
      method: 'POST',
      url: secondary.subscriber.resourceType,
      fullUrl: secondaryRPPostURL,
    };
    batchRequests.push(...[secondaryCoveragePost, secondaryRPPost]);
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
    const accountPost: BatchInputPostRequest<Account> = {
      method: 'POST',
      resource: {
        ...account,
        coverage,
      },
      url: 'Account',
    };
    batchRequests.push(accountPost);
  }
  return batchRequests;
};
