import Oystehr from '@oystehr/sdk';
import { Coverage, CoverageEligibilityRequest, CoverageEligibilityResponse, Organization, Patient } from 'fhir/r4b';
import * as fs from 'fs';
import { ORG_TYPE_CODE_SYSTEM, ORG_TYPE_PAYER_CODE } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

const PAYER_ID_SYSTEM = 'payer-id';

async function getPayerOrganizations(oystehr: Oystehr): Promise<Organization[]> {
  let currentIndex = 0;
  let total = 1;
  const result: Organization[] = [];
  while (currentIndex < total) {
    const bundledResponse = await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        {
          name: 'type',
          value: `${ORG_TYPE_CODE_SYSTEM}|${ORG_TYPE_PAYER_CODE}`,
        },
        {
          name: '_offset',
          value: currentIndex,
        },
        {
          name: '_count',
          value: 1000,
        },
        {
          name: '_total',
          value: 'accurate',
        },
      ],
    });
    total = bundledResponse.total || 0;
    const unbundled = bundledResponse.unbundle();
    result.push(...unbundled);
    currentIndex += unbundled.length;
  }

  console.log('Found', result.length, 'organizations');
  return result;
}

async function fixOrganizations(oystehr: Oystehr, organizations: Organization[]): Promise<void> {
  // Count organizations by identifier type coding code
  const codeCount = new Map<string, Organization[]>();

  for (const org of organizations) {
    // Find the identifier with the PAYER_ID_SYSTEM
    const payerIdentifier = org.identifier?.find(
      (id) => id.type?.coding?.some((coding) => coding.system === PAYER_ID_SYSTEM)
    );

    if (payerIdentifier) {
      const code = payerIdentifier.type?.coding?.find((coding) => coding.system === PAYER_ID_SYSTEM)?.code;
      if (code) {
        if (!codeCount.has(code)) {
          codeCount.set(code, []);
        }
        codeCount.get(code)!.push(org);
      }
    }
  }

  // Find and print duplicates
  console.log('\n=== Duplicate Organizations ===');
  let duplicateCount = 0;
  const uniqueOrgIds = new Set<string>();
  const organizationsToDelete = new Set<string>();

  for (const [code, orgs] of codeCount.entries()) {
    if (orgs.length > 1) {
      duplicateCount++;
      console.log(`\nDuplicate Payer ID: "${code}" (${orgs.length} occurrences)`);

      const orgsWithoutCoverage: Organization[] = [];
      const orgsWithCoverage: { org: Organization; resources: any }[] = [];

      for (const org of orgs) {
        // Add organization ID to the set for unique count
        if (org.id) {
          uniqueOrgIds.add(org.id);
        }

        // Find the eligibility payer ID
        const eligibilityIdentifier = org.identifier?.find(
          (id) =>
            id.type?.coding?.some(
              (coding) => coding.code === 'XX' && coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0203'
            )
        );
        const eligibilityPayerId = eligibilityIdentifier?.value || 'N/A';

        console.log(
          `  - ID: ${org.id}, Name: ${org.name || 'N/A'}, Code: ${code}, Eligibility Payer ID: ${eligibilityPayerId}`
        );

        // Find all coverage-related resources
        const allCoverageResources = await findAllCoverageResources(oystehr, org);
        const totalResources =
          allCoverageResources.coverages.length +
          allCoverageResources.eligibilityRequests.length +
          allCoverageResources.eligibilityResponses.length;

        if (totalResources > 0) {
          console.log(
            `      Found ${totalResources} total coverage-related resource(s) for organization ${org.id} (${
              org.name || 'N/A'
            })`
          );
          console.log(`        - ${allCoverageResources.coverages.length} Coverage resources`);
          console.log(
            `        - ${allCoverageResources.eligibilityRequests.length} CoverageEligibilityRequest resources`
          );
          console.log(
            `        - ${allCoverageResources.eligibilityResponses.length} CoverageEligibilityResponse resources`
          );

          // Display coverage details if any exist
          for (const coverage of allCoverageResources.coverages) {
            const beneficiary = await findBeneficiaryPatient(oystehr, coverage);
            if (beneficiary && beneficiary.id) {
              const patientName =
                `${beneficiary.name?.[0]?.given?.join(' ') || ''} ${beneficiary.name?.[0]?.family || ''}`.trim() ||
                'N/A';
              console.log(`           Coverage Beneficiary ID: ${beneficiary.id}, Name: ${patientName}`);
            }
          }

          orgsWithCoverage.push({ org, resources: allCoverageResources });
        } else {
          console.log(`      No coverage-related resources found for organization ${org.id}`);
          orgsWithoutCoverage.push(org);
        }
      }

      // Determine the organization to keep (first one in the list)
      const orgToKeep = orgs[0];
      console.log(`\n      🛡️  Keeping organization: ${orgToKeep.id} (${orgToKeep.name || 'N/A'})`);

      // Update coverage resources from duplicate organizations to reference the kept organization
      for (let i = 1; i < orgs.length; i++) {
        const orgToTransferFrom = orgs[i];
        console.log(`\n      📋 Transferring resources from ${orgToTransferFrom.id} to ${orgToKeep.id}...`);

        // Find resources for this duplicate organization
        const resourcesFromDuplicate = orgsWithCoverage.find((item) => item.org.id === orgToTransferFrom.id);

        if (resourcesFromDuplicate) {
          const { coverages, eligibilityRequests, eligibilityResponses } = resourcesFromDuplicate.resources;

          // Update Coverage resources
          if (coverages.length > 0) {
            console.log(`        Updating ${coverages.length} Coverage resources...`);
            for (const coverage of coverages) {
              const success = await updateCoverageOrganization(oystehr, coverage, orgToKeep);
              if (success) {
                console.log(`          ✅ Updated Coverage ${coverage.id}`);
              } else {
                console.log(`          ❌ Failed to update Coverage ${coverage.id}`);
              }
            }
          }

          // Update CoverageEligibilityRequest resources
          if (eligibilityRequests.length > 0) {
            console.log(`        Updating ${eligibilityRequests.length} CoverageEligibilityRequest resources...`);
            for (const request of eligibilityRequests) {
              const success = await updateCoverageEligibilityRequest(oystehr, request, orgToKeep);
              if (success) {
                console.log(`          ✅ Updated CoverageEligibilityRequest ${request.id}`);
              } else {
                console.log(`          ❌ Failed to update CoverageEligibilityRequest ${request.id}`);
              }
            }
          }

          // Update CoverageEligibilityResponse resources
          if (eligibilityResponses.length > 0) {
            console.log(`        Updating ${eligibilityResponses.length} CoverageEligibilityResponse resources...`);
            for (const response of eligibilityResponses) {
              const success = await updateCoverageEligibilityResponse(oystehr, response, orgToKeep);
              if (success) {
                console.log(`          ✅ Updated CoverageEligibilityResponse ${response.id}`);
              } else {
                console.log(`          ❌ Failed to update CoverageEligibilityResponse ${response.id}`);
              }
            }
          }
        }

        // Mark duplicate organization for deletion (whether it had resources or not)
        if (orgToTransferFrom.id) {
          organizationsToDelete.add(orgToTransferFrom.id);
          console.log(`        🗑️ Marked for deletion: ${orgToTransferFrom.id} (duplicate #${i + 1})`);
        }
      }
    }
  }

  if (duplicateCount === 0) {
    console.log('No duplicate organization Payer IDs found.');
  } else {
    console.log(`\nTotal duplicate Payer IDs found: ${duplicateCount}`);
    console.log(`Total unique organization IDs in duplicates: ${uniqueOrgIds.size}`);
  }

  // Display organizations marked for deletion
  console.log(`\n=== Organizations Marked for Deletion ===`);
  if (organizationsToDelete.size > 0) {
    console.log(`Total organizations in deletion set: ${organizationsToDelete.size}`);
    console.log(`Organization IDs to delete:`);
    for (const orgId of organizationsToDelete) {
      console.log(`  - ${orgId}`);
    }

    // Actually delete the organizations
    console.log(`\n🗑️ Proceeding with deletion...`);
    const organizationIdsArray = Array.from(organizationsToDelete);
    const deletionResults = await deleteOrganizations(oystehr, organizationIdsArray);

    console.log(`\n=== Final Deletion Results ===`);
    console.log(`✅ Successfully deleted: ${deletionResults.successful.length} organizations`);
    console.log(`❌ Failed to delete: ${deletionResults.failed.length} organizations`);

    if (deletionResults.successful.length > 0) {
      console.log(`Successfully deleted IDs: ${deletionResults.successful.join(', ')}`);
    }
    if (deletionResults.failed.length > 0) {
      console.log(`Failed to delete IDs: ${deletionResults.failed.join(', ')}`);
    }
  } else {
    console.log('No organizations meet the deletion criteria');
  }
}

async function findCoverageDetails(oystehr: Oystehr, organization: Organization): Promise<Coverage[]> {
  if (!organization.id) {
    console.log('Organization has no ID, skipping coverage search');
    return [];
  }

  try {
    // Search for Coverage resources
    const bundleResponse = await oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [
        {
          name: 'payor',
          value: `Organization/${organization.id}`,
        },
        {
          name: '_count',
          value: 10,
        },
      ],
    });

    const coverages = bundleResponse.unbundle();
    return coverages;

    // console.log(`\nFound ${coverages.length} coverage(s) for organization ${organization.id} (${organization.name})`);
  } catch (error) {
    console.log(`Error searching for coverage for organization ${organization.id}: ${error}`);
    return [];
  }
}

async function findCoverageEligibilityRequests(
  oystehr: Oystehr,
  organization: Organization
): Promise<CoverageEligibilityRequest[]> {
  if (!organization.id) {
    console.log('Organization has no ID, skipping CoverageEligibilityRequest search');
    return [];
  }

  try {
    // Search for CoverageEligibilityRequest resources where this organization is the insurer
    const bundleResponse = await oystehr.fhir.search<CoverageEligibilityRequest>({
      resourceType: 'CoverageEligibilityRequest',
      params: [
        {
          name: 'insurer',
          value: `Organization/${organization.id}`,
        },
        {
          name: '_count',
          value: 10,
        },
      ],
    });

    const requests = bundleResponse.unbundle();
    console.log(
      `Found ${requests.length} CoverageEligibilityRequest(s) for organization ${organization.id} (${
        organization.name || 'N/A'
      })`
    );

    return requests;
  } catch (error) {
    console.log(`Error searching for CoverageEligibilityRequest for organization ${organization.id}: ${error}`);
    return [];
  }
}

async function findCoverageEligibilityResponses(
  oystehr: Oystehr,
  organization: Organization
): Promise<CoverageEligibilityResponse[]> {
  if (!organization.id) {
    console.log('Organization has no ID, skipping CoverageEligibilityResponse search');
    return [];
  }

  try {
    // Search for CoverageEligibilityResponse resources where this organization is the insurer
    const bundleResponse = await oystehr.fhir.search<CoverageEligibilityResponse>({
      resourceType: 'CoverageEligibilityResponse',
      params: [
        {
          name: 'insurer',
          value: `Organization/${organization.id}`,
        },
        {
          name: '_count',
          value: 10,
        },
      ],
    });

    const responses = bundleResponse.unbundle();
    console.log(
      `Found ${responses.length} CoverageEligibilityResponse(s) for organization ${organization.id} (${
        organization.name || 'N/A'
      })`
    );

    return responses;
  } catch (error) {
    console.log(`Error searching for CoverageEligibilityResponse for organization ${organization.id}: ${error}`);
    return [];
  }
}

async function deleteOrganization(oystehr: Oystehr, organizationId: string): Promise<boolean> {
  try {
    console.log(`Deleting organization with ID: ${organizationId}...`);
    await oystehr.fhir.delete({
      resourceType: 'Organization',
      id: organizationId,
    });
    console.log(`Successfully deleted organization ID: ${organizationId}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete organization ID: ${organizationId}. Error: ${error}`);
    return false;
  }
}

async function deleteOrganizations(
  oystehr: Oystehr,
  organizationIds: string[]
): Promise<{ successful: string[]; failed: string[] }> {
  const results = { successful: [] as string[], failed: [] as string[] };

  console.log(`\nAttempting to delete ${organizationIds.length} organizations...`);

  for (const id of organizationIds) {
    const success = await deleteOrganization(oystehr, id);
    if (success) {
      results.successful.push(id);
    } else {
      results.failed.push(id);
    }
  }

  console.log(`\n=== Deletion Summary ===`);
  console.log(`Successfully deleted: ${results.successful.length} organizations`);
  console.log(`Failed to delete: ${results.failed.length} organizations`);

  if (results.failed.length > 0) {
    console.log(`Failed IDs: ${results.failed.join(', ')}`);
  }

  return results;
}

async function findAllCoverageResources(
  oystehr: Oystehr,
  organization: Organization
): Promise<{
  coverages: Coverage[];
  eligibilityRequests: CoverageEligibilityRequest[];
  eligibilityResponses: CoverageEligibilityResponse[];
}> {
  if (!organization.id) {
    console.log('Organization has no ID, skipping all coverage resource searches');
    return {
      coverages: [],
      eligibilityRequests: [],
      eligibilityResponses: [],
    };
  }

  try {
    // Run all three searches in parallel for better performance
    const [coverages, eligibilityRequests, eligibilityResponses] = await Promise.all([
      findCoverageDetails(oystehr, organization),
      findCoverageEligibilityRequests(oystehr, organization),
      findCoverageEligibilityResponses(oystehr, organization),
    ]);

    return {
      coverages,
      eligibilityRequests,
      eligibilityResponses,
    };
  } catch (error) {
    console.log(`Error searching for coverage resources for organization ${organization.id}: ${error}`);
    return {
      coverages: [],
      eligibilityRequests: [],
      eligibilityResponses: [],
    };
  }
}

async function findBeneficiaryPatient(oystehr: Oystehr, coverage: Coverage): Promise<Patient | null> {
  if (!coverage.beneficiary?.reference) {
    console.log(`Coverage ${coverage.id} has no beneficiary reference`);
    return null;
  }

  try {
    // Extract patient ID from the reference (e.g., "Patient/12345" -> "12345")
    const patientReference = coverage.beneficiary.reference;
    const patientId = patientReference.replace('Patient/', '');

    if (!patientId) {
      console.log(`Invalid patient reference format: ${patientReference}`);
      return null;
    }

    // Fetch the patient resource
    const patient = await oystehr.fhir.get<Patient>({
      resourceType: 'Patient',
      id: patientId,
    });

    return patient;
  } catch (error) {
    console.log(`Error finding beneficiary patient for coverage ${coverage.id}: ${error}`);
    return null;
  }
}

async function updateCoverageOrganization(
  oystehr: Oystehr,
  coverage: Coverage,
  newPayorOrganization: Organization
): Promise<boolean> {
  if (!coverage.id) {
    console.log('Coverage has no ID, cannot update');
    return false;
  }

  if (!newPayorOrganization.id) {
    console.log('New payor organization has no ID, cannot update coverage');
    return false;
  }

  try {
    console.log(`Updating coverage ${coverage.id} to use payor organization ${newPayorOrganization.id}`);

    // Get the payor-id from the new organization
    const payerIdentifier = newPayorOrganization.identifier?.find(
      (id) => id.type?.coding?.some((coding) => coding.system === PAYER_ID_SYSTEM)
    );
    const payerId = payerIdentifier?.type?.coding?.find((coding) => coding.system === PAYER_ID_SYSTEM)?.code;

    // Create the new organization reference
    const newPayorReference = {
      reference: `Organization/${newPayorOrganization.id}`,
      display: newPayorOrganization.name || undefined,
    };

    // Update the coverage payor
    const updatedCoverage: Coverage = {
      ...coverage,
      payor: [newPayorReference], // FHIR Coverage.payor is an array
    };

    // Find and update the identifier with system http://terminology.hl7.org/CodeSystem/v2-0203 and code MB
    if (updatedCoverage.identifier) {
      for (const identifier of updatedCoverage.identifier) {
        // Check if this identifier has the MB code in the v2-0203 system
        const hasMBCode = identifier.type?.coding?.some(
          (coding) => coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0203' && coding.code === 'MB'
        );

        if (hasMBCode) {
          // Update the assigner reference to the new payor organization
          identifier.assigner = {
            reference: `Organization/${newPayorOrganization.id}`,
            display: newPayorOrganization.name || undefined,
          };
          console.log(`  Updated MB identifier assigner to organization ${newPayorOrganization.id}`);
          break; // Assuming there's only one MB identifier
        }
      }
    }

    // Find and update the coverage class with "plan" type
    if (updatedCoverage.class) {
      for (const coverageClass of updatedCoverage.class) {
        // Check if this class has the "plan" type in the coverage-class system
        const hasPlanType = coverageClass.type?.coding?.some(
          (coding) => coding.system === 'http://terminology.hl7.org/CodeSystem/coverage-class' && coding.code === 'plan'
        );

        if (hasPlanType) {
          // Update the class value to the organization's payor-id and name to org's name
          coverageClass.value = payerId || newPayorOrganization.id || '';
          coverageClass.name = newPayorOrganization.name || undefined;
          console.log(`  Updated plan class value to ${coverageClass.value} and name to ${coverageClass.name}`);
          break; // Assuming there's only one plan class
        }
      }
    }

    // Update the coverage resource
    await oystehr.fhir.update<Coverage>(updatedCoverage);

    console.log(
      `✅ Successfully updated coverage ${coverage.id} payor, MB identifier assigner, and plan class to organization ${
        newPayorOrganization.id
      } (${newPayorOrganization.name || 'N/A'})`
    );
    return true;
  } catch (error) {
    console.error(`❌ Error updating coverage ${coverage.id} payor: ${error}`);
    return false;
  }
}

async function updateCoverageEligibilityResponse(
  oystehr: Oystehr,
  eligibilityResponse: CoverageEligibilityResponse,
  newInsurerOrganization: Organization
): Promise<boolean> {
  if (!eligibilityResponse.id) {
    console.log('CoverageEligibilityResponse has no ID, cannot update');
    return false;
  }

  if (!newInsurerOrganization.id) {
    console.log('New insurer organization has no ID, cannot update CoverageEligibilityResponse');
    return false;
  }

  try {
    console.log(
      `Updating CoverageEligibilityResponse ${eligibilityResponse.id} to use insurer organization ${newInsurerOrganization.id}`
    );

    // Create the new organization reference
    const newInsurerReference = {
      reference: `Organization/${newInsurerOrganization.id}`,
    };

    // Update the eligibility response insurer
    const updatedEligibilityResponse: CoverageEligibilityResponse = {
      ...eligibilityResponse,
      insurer: newInsurerReference,
    };

    // Update the eligibility response resource
    await oystehr.fhir.update<CoverageEligibilityResponse>(updatedEligibilityResponse);
    return true;
  } catch (error) {
    console.error(`❌ Error updating CoverageEligibilityResponse ${eligibilityResponse.id} insurer: ${error}`);
    return false;
  }
}

async function updateCoverageEligibilityRequest(
  oystehr: Oystehr,
  eligibilityRequest: CoverageEligibilityRequest,
  newInsurerOrganization: Organization
): Promise<boolean> {
  if (!eligibilityRequest.id) {
    console.log('CoverageEligibilityRequest has no ID, cannot update');
    return false;
  }

  if (!newInsurerOrganization.id) {
    console.log('New insurer organization has no ID, cannot update CoverageEligibilityRequest');
    return false;
  }

  try {
    console.log(
      `Updating CoverageEligibilityRequest ${eligibilityRequest.id} to use insurer organization ${newInsurerOrganization.id}`
    );

    // Create the new organization reference
    const newInsurerReference = {
      reference: `Organization/${newInsurerOrganization.id}`,
      display: newInsurerOrganization.name || undefined,
    };

    // Update the eligibility request insurer
    const updatedEligibilityRequest: CoverageEligibilityRequest = {
      ...eligibilityRequest,
      insurer: newInsurerReference,
    };

    // Update the eligibility request resource
    await oystehr.fhir.update<CoverageEligibilityRequest>(updatedEligibilityRequest);

    console.log(
      `✅ Successfully updated CoverageEligibilityRequest ${eligibilityRequest.id} insurer to organization ${
        newInsurerOrganization.id
      } (${newInsurerOrganization.name || 'N/A'})`
    );
    return true;
  } catch (error) {
    console.error(`❌ Error updating CoverageEligibilityRequest ${eligibilityRequest.id} insurer: ${error}`);
    return false;
  }
}

async function main(): Promise<void> {
  const env = process.argv[2];
  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('❌ Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  const organizations = await getPayerOrganizations(oystehr);
  await fixOrganizations(oystehr, organizations);
}

main()
  .then(() => console.log('✅ Completed looking for duplicate organizations'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
