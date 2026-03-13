import { input } from '@inquirer/prompts';

/*
 to run:
 npx env-cmd -f packages/zambdas/.env/{ENV}.json tsx scripts/delete-resources/cleanup-all-resources.js
*/

const { FHIR_API, PROJECT_ID, AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, ENVIRONMENT } = process.env;

if (!ENVIRONMENT) {
  throw new Error('ENVIRONMENT environment variable is required.');
}

if (!FHIR_API) {
  throw new Error('FHIR_BASE_URL environment variable is required.');
}

if (!PROJECT_ID) {
  throw new Error('PROJECT_ID environment variable is required.');
}

if (!AUTH0_ENDPOINT) {
  throw new Error('AUTH0_ENDPOINT environment variable is required.');
}

if (!AUTH0_CLIENT) {
  throw new Error('AUTH0_CLIENT environment variable is required.');
}

if (!AUTH0_SECRET) {
  throw new Error('AUTH0_SECRET environment variable is required.');
}

if (!AUTH0_AUDIENCE) {
  throw new Error('AUTH0_AUDIENCE environment variable is required.');
}

async function getAuth0Token() {
  console.log('Fetching Auth0 token...');
  const response = await fetch(AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: AUTH0_CLIENT,
      client_secret: AUTH0_SECRET,
      audience: AUTH0_AUDIENCE,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get Auth0 token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

const batchSize = 50;

const RESOURCES_FOR_DELETE = [
  'CapabilityStatement',
  'CodeSystem',
  'Composition',
  'Basic',
  'StructureDefinition',
  'ValueSet',
  'AuditEvent',
  'DocumentManifest',
  'Binary',
  'ImplementationGuide',
  'ConceptMap',
  'Consent',
  'DocumentReference',
  'Bundle',
  'SearchParameter',
  'NamingSystem',
  'CatalogEntry',
  'Linkage',
  'MessageDefinition',
  'TerminologyCapabilities',
  'MessageHeader',
  'OperationDefinition',
  'Subscription',
  'CompartmentDefinition',
  'SubscriptionStatus',
  'StructureMap',
  'SubscriptionTopic',
  'GraphDefinition',
  'ExampleScenario',
  'Patient',
  'Organization',
  'Substance',
  'Task',
  'Encounter',
  'Practitioner',
  'OrganizationAffiliation',
  'BiologicallyDerivedProduct',
  'Appointment',
  'EpisodeOfCare',
  'PractitionerRole',
  'HealthcareService',
  'Device',
  'AppointmentResponse',
  'Flag',
  'RelatedPerson',
  'Endpoint',
  'DeviceMetric',
  'Schedule',
  'List',
  'Person',
  'Location',
  'NutritionProduct',
  'Slot',
  'Library',
  'Group',
  'VerificationResult',
  'AllergyIntolerance',
  'Observation',
  'MedicationRequest',
  'CarePlan',
  'Communication',
  'AdverseEvent',
  'Media',
  'MedicationAdministration',
  'CareTeam',
  'CommunicationRequest',
  'Condition',
  'DiagnosticReport',
  'MedicationDispense',
  'Goal',
  'DeviceRequest',
  'Procedure',
  'Specimen',
  'MedicationStatement',
  'ServiceRequest',
  'DeviceUseStatement',
  'FamilyMemberHistory',
  'BodyStructure',
  'Medication',
  'NutritionOrder',
  'GuidanceResponse',
  'ClinicalImpression',
  'ImagingStudy',
  'MedicationKnowledge',
  'VisionPrescription',
  'SupplyRequest',
  'DetectedIssue',
  'QuestionnaireResponse',
  'Immunization',
  'RiskAssessment',
  'SupplyDelivery',
  'MolecularSequence',
  'ImmunizationEvaluation',
  'RequestGroup',
  'ImmunizationRecommendation',
  'Coverage',
  'Claim',
  'PaymentNotice',
  'Account',
  'CoverageEligibilityRequest',
  'ClaimResponse',
  'PaymentReconciliation',
  'ChargeItem',
  'CoverageEligibilityResponse',
  'Invoice',
  'ChargeItemDefinition',
  'EnrollmentRequest',
  'Contract',
  'EnrollmentResponse',
  'ExplanationOfBenefit',
  'InsurancePlan',
  'ResearchStudy',
  'ActivityDefinition',
  'Citation',
  'Measure',
  'MedicinalProductDefinition',
  'ResearchSubject',
  'DeviceDefinition',
  'Evidence',
  'MeasureReport',
  'PackagedProductDefinition',
  'EventDefinition',
  'EvidenceReport',
  'TestScript',
  'AdministrableProductDefinition',
  'ObservationDefinition',
  'EvidenceVariable',
  'TestReport',
  'ManufacturedItemDefinition',
  'PlanDefinition',
  'Ingredient',
  'Questionnaire',
  'ClinicalUseDefinition',
  'SpecimenDefinition',
  'RegulatedAuthorization',
  'SubstanceDefinition',
];

async function fetchAllPages(resourceType, authToken) {
  const allResources = [];
  let url = `${FHIR_API}/${resourceType}?_count=1000&_elements=id`;

  while (url) {
    console.log(`Fetching page from: ${resourceType}...`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'x-zapehr-project-id': PROJECT_ID,
      },
    });

    if (!response.ok) {
      console.error(`Error fetching ${resourceType}: ${response.status}`);
      break;
    }

    const data = await response.json();

    if (data.entry && data.entry.length > 0) {
      data.entry.forEach((entry) => {
        allResources.push({
          type: entry.resource.resourceType,
          id: entry.resource.id,
        });
      });

      const nextLink = data.link?.find((l) => l.relation === 'next');
      url = nextLink ? nextLink.url : null;
    } else {
      url = null;
    }
  }

  return allResources;
}

async function getAllResources(authToken) {
  const allResourceIds = [];

  for (const resourceType of RESOURCES_FOR_DELETE) {
    const resources = await fetchAllPages(resourceType, authToken);

    if (resources.length > 0) {
      allResourceIds.push(...resources);
      console.log(`Found ${resources.length} ${resourceType} resources`);
    }
  }

  return allResourceIds;
}

async function deleteBatch(resources, authToken) {
  const deleteBundle = {
    resourceType: 'Bundle',
    type: 'batch',
    entry: resources.map((resource) => ({
      request: {
        method: 'DELETE',
        url: `${resource.type}/${resource.id}`,
      },
    })),
  };

  const response = await fetch(FHIR_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'x-zapehr-project-id': PROJECT_ID,
      'Content-Type': 'application/fhir+json',
    },
    body: JSON.stringify(deleteBundle),
  });

  if (!response.ok) {
    throw new Error(`Batch delete failed: ${response.status}`);
  }

  const result = await response.json();

  const deletedCount =
    result.entry?.filter((e) => e.response && (e.response.status === '200' || e.response.status === '204')).length || 0;

  const failedCount =
    result.entry?.filter((e) => e.response && e.response.status !== '200' && e.response.status !== '204').length || 0;

  return { deletedCount, failedCount };
}

async function deleteAllResources() {
  console.log('Starting deletion process...\n');

  const authToken = await getAuth0Token();

  console.log('Configuration:');
  console.log(`  FHIR API: ${FHIR_API}`);
  console.log(`  Project ID: ${PROJECT_ID}`);
  console.log(`  Batch Size: ${batchSize}\n`);

  console.log('='.repeat(60));
  console.log('PHASE 1: Discovering resources');
  console.log('='.repeat(60));

  const allResources = await getAllResources(authToken);

  if (allResources.length === 0) {
    console.log('\n No resources found. Nothing to delete.');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`PHASE 2: Deleting ${allResources.length} resources in batches of ${batchSize}`);
  console.log('='.repeat(60) + '\n');

  console.log(`This will permanently delete ${allResources.length} FHIR resources from project ${PROJECT_ID}!`);
  console.log('This action cannot be undone.');
  console.log('');

  const safetyPhrase = `delete all resources from ${ENVIRONMENT}`.toLowerCase();

  await input({
    message: `Type "${safetyPhrase}" to confirm deletion:`,
    validate: (input) =>
      input.toLowerCase() === safetyPhrase || `Please type the correct pass phrase to confirm: "${safetyPhrase}"`,
  });

  let totalDeleted = 0;
  let totalFailed = 0;
  let batchNumber = 1;

  for (let i = 0; i < allResources.length; i += batchSize) {
    const batch = allResources.slice(i, i + batchSize);
    const remaining = allResources.length - i - batch.length;

    console.log(`\nBatch ${batchNumber}: Deleting ${batch.length} resources...`);

    try {
      const { deletedCount, failedCount } = await deleteBatch(batch, authToken);
      totalDeleted += deletedCount;
      totalFailed += failedCount;

      console.log(`  Deleted: ${deletedCount}`);
      if (failedCount > 0) {
        console.log(`  Failed: ${failedCount}`);
      }
      console.log(`  Progress: ${totalDeleted}/${allResources.length} (${remaining} remaining)`);

      batchNumber++;

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`  Batch failed: ${error.message}`);
      totalFailed += batch.length;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULTS');
  console.log('='.repeat(60));
  console.log(` Successfully deleted: ${totalDeleted}`);
  if (totalFailed > 0) {
    console.log(`  Failed to delete: ${totalFailed}`);
  }
  console.log('='.repeat(60) + '\n');

  console.log('Running final verification...\n');
  const remainingResources = await getAllResources(authToken);

  if (remainingResources.length === 0) {
    console.log('SUCCESS! All resources have been deleted.\n');
  } else {
    console.log(`WARNING: ${remainingResources.length} resources still remain.`);
    console.log('You may need to run the script again.\n');
  }
}

deleteAllResources().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
