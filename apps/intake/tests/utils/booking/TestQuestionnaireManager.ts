import { Questionnaire } from 'fhir/r4b';
import {
  CanonicalUrl,
  createQuestionnaireFromConfig,
  getIntakePaperworkConfig,
  getIntakePaperworkVirtualConfig,
  QuestionnaireConfigType,
  ResolvedConsentFormConfig,
  ServiceMode,
} from 'utils';
import { ResourceHandler } from '../resource-handler';

/**
 * Information about a created test questionnaire
 */
export interface CreatedTestQuestionnaire {
  /** The config ID this questionnaire was created from */
  configId: string;
  /** The service mode (in-person or virtual) */
  serviceMode: ServiceMode;
  /** The canonical URL (url + version) */
  canonical: CanonicalUrl;
  /** The created FHIR Questionnaire resource */
  questionnaire: Questionnaire;
}

/**
 * Manages test questionnaires for e2e booking tests
 *
 * Creates FHIR Questionnaires from concrete config overrides with unique URLs
 * to ensure test isolation. Each questionnaire is tagged with the worker ID
 * to enable cleanup after tests.
 *
 * Usage:
 * 1. Call `ensureTestQuestionnaire` with config overrides before running tests
 * 2. Use the returned `canonical` URL when creating test appointments
 * 3. Call `cleanup` after tests to remove test questionnaires
 */
export class TestQuestionnaireManager {
  private resourceHandler: ResourceHandler;
  private workerUniqueId: string;
  private createdQuestionnaires: Map<string, CreatedTestQuestionnaire> = new Map();

  /**
   * @param workerUniqueId - Unique identifier for this worker to isolate test resources
   */
  constructor(workerUniqueId: string) {
    this.resourceHandler = new ResourceHandler();
    this.workerUniqueId = workerUniqueId;
  }

  /**
   * Initialize the resource handler
   */
  async init(): Promise<void> {
    await this.resourceHandler.initApi();
  }

  /**
   * Generate a unique questionnaire URL for test isolation
   *
   * IMPORTANT: The URL must include 'intake-paperwork-inperson' or 'intake-paperwork-virtual'
   * because `isNonPaperworkQuestionnaireResponse` uses string matching to identify paperwork
   * questionnaires. Test questionnaires without these patterns would be filtered out.
   *
   * @param configId - Identifier for the concrete config (e.g., 'instance-1')
   * @param serviceMode - The service mode ('in-person' or 'virtual')
   * @returns A unique URL that includes the config ID and worker ID
   */
  private generateTestQuestionnaireUrl(configId: string, serviceMode: ServiceMode): string {
    const baseUrl = 'https://ottehr.com/FHIR/Questionnaire';
    // Use the standard intake-paperwork-* pattern so the questionnaire is recognized
    // by isNonPaperworkQuestionnaireResponse, then add e2e-test suffix for uniqueness
    const modeSlug = serviceMode === 'in-person' ? 'intake-paperwork-inperson' : 'intake-paperwork-virtual';
    // Include worker ID in URL to ensure complete isolation
    return `${baseUrl}/${modeSlug}-e2e-test-${configId}-${this.workerUniqueId}`;
  }

  /**
   * Generate a unique version for test questionnaires
   *
   * @param configId - Identifier for the concrete config
   * @returns A version string with timestamp for uniqueness
   */
  private generateTestQuestionnaireVersion(configId: string): string {
    // Use timestamp to ensure uniqueness even if same config is deployed multiple times
    return `e2e-${configId}-${Date.now()}`;
  }

  /**
   * Create a cache key for storing created questionnaires
   */
  private getCacheKey(configId: string, serviceMode: ServiceMode): string {
    return `${configId}-${serviceMode}`;
  }

  /**
   * Generate a FHIR Questionnaire from config overrides
   *
   * @param configOverrides - Config overrides to apply
   * @param serviceMode - The service mode ('in-person' or 'virtual')
   * @param configId - Identifier for this config (used in URL)
   * @param consentForms - Optional resolved consent forms to use (for instance-specific forms)
   * @returns The generated Questionnaire resource (not yet saved to FHIR)
   */
  private generateQuestionnaire(
    configOverrides: Partial<QuestionnaireConfigType>,
    serviceMode: ServiceMode,
    configId: string,
    consentForms?: ResolvedConsentFormConfig[]
  ): Questionnaire {
    // Get the base config with overrides applied
    // Pass consent forms so checkbox items are built from instance-specific forms
    const config =
      serviceMode === 'in-person'
        ? getIntakePaperworkConfig(configOverrides, consentForms)
        : getIntakePaperworkVirtualConfig(configOverrides, consentForms);

    // Override the questionnaire base URL and version for test isolation
    const testUrl = this.generateTestQuestionnaireUrl(configId, serviceMode);
    const testVersion = this.generateTestQuestionnaireVersion(configId);

    // Create a modified config with test URL/version
    const testConfig: QuestionnaireConfigType = {
      ...config,
      questionnaireBase: {
        ...config.questionnaireBase,
        url: testUrl,
        version: testVersion,
        name: `e2e_test_${serviceMode.replace('-', '_')}_${configId}`,
        title: `E2E Test ${serviceMode} intake - ${configId}`,
      },
    };

    // Generate the questionnaire from the modified config
    return createQuestionnaireFromConfig(testConfig);
  }

  /**
   * Ensure a test questionnaire exists in FHIR for the given config
   *
   * If the questionnaire was already created in this session, returns the cached version.
   * Otherwise, generates a new questionnaire and deploys it to FHIR.
   *
   * @param configId - Unique identifier for this config (e.g., 'instance-2')
   * @param configOverrides - Config overrides (e.g., hiddenFields)
   * @param serviceMode - The service mode ('in-person' or 'virtual')
   * @param consentForms - Optional resolved consent forms to use (for instance-specific forms)
   * @returns Information about the created questionnaire including its canonical URL
   */
  async ensureTestQuestionnaire(
    configId: string,
    configOverrides: Partial<QuestionnaireConfigType>,
    serviceMode: ServiceMode,
    consentForms?: ResolvedConsentFormConfig[]
  ): Promise<CreatedTestQuestionnaire> {
    const cacheKey = this.getCacheKey(configId, serviceMode);

    // Check cache first
    const cached = this.createdQuestionnaires.get(cacheKey);
    if (cached) {
      console.log(`Using cached test questionnaire for ${cacheKey}`);
      return cached;
    }

    const oystehr = this.resourceHandler.apiClient;
    const processId = this.workerUniqueId;

    // Generate the questionnaire with instance-specific consent forms if provided
    const questionnaire = this.generateQuestionnaire(configOverrides, serviceMode, configId, consentForms);

    // Add test tags for identification and cleanup
    questionnaire.meta = {
      ...questionnaire.meta,
      tag: [
        ...(questionnaire.meta?.tag || []),
        {
          system: processId,
          code: `e2e-test-questionnaire-${configId}`,
          display: `E2E Test Questionnaire: ${configId}`,
        },
        {
          system: 'https://ottehr.com/e2e-test',
          code: 'e2e-test-questionnaire',
          display: 'E2E Test Questionnaire',
        },
      ],
    };

    console.log(`Creating test questionnaire for ${cacheKey} with URL: ${questionnaire.url}`);

    // Deploy to FHIR
    const created = await oystehr.fhir.create(questionnaire);

    if (!created.id) {
      throw new Error(`Failed to create test questionnaire for ${cacheKey}`);
    }

    const result: CreatedTestQuestionnaire = {
      configId,
      serviceMode,
      canonical: {
        url: questionnaire.url!,
        version: questionnaire.version!,
      },
      questionnaire: created,
    };

    // Cache for later use and cleanup
    this.createdQuestionnaires.set(cacheKey, result);

    console.log(`Created test questionnaire: ${created.id} (${questionnaire.url}|${questionnaire.version})`);

    return result;
  }

  /**
   * Get a previously created test questionnaire
   *
   * @param configId - The config identifier
   * @param serviceMode - The service mode
   * @returns The created questionnaire info, or undefined if not found
   */
  getTestQuestionnaire(configId: string, serviceMode: ServiceMode): CreatedTestQuestionnaire | undefined {
    return this.createdQuestionnaires.get(this.getCacheKey(configId, serviceMode));
  }

  /**
   * Get all created test questionnaires
   */
  getAllTestQuestionnaires(): CreatedTestQuestionnaire[] {
    return Array.from(this.createdQuestionnaires.values());
  }

  /**
   * Cleanup all test questionnaires created by this manager
   *
   * Deletes all questionnaires from FHIR that were created during this session.
   */
  async cleanup(): Promise<void> {
    const oystehr = this.resourceHandler.apiClient;

    console.log(`Cleaning up ${this.createdQuestionnaires.size} test questionnaires`);

    for (const [cacheKey, createdQuestionnaire] of this.createdQuestionnaires.entries()) {
      const { questionnaire } = createdQuestionnaire;

      if (questionnaire.id) {
        try {
          await oystehr.fhir.delete({
            resourceType: 'Questionnaire',
            id: questionnaire.id,
          });
          console.log(`Deleted test questionnaire: ${questionnaire.id} (${cacheKey})`);
        } catch (error) {
          console.warn(`Failed to delete test questionnaire ${questionnaire.id}:`, error);
        }
      }
    }

    this.createdQuestionnaires.clear();
  }

  /**
   * Search for and cleanup any orphaned test questionnaires from previous runs
   *
   * This can be called during test setup to ensure a clean slate.
   * Searches for questionnaires tagged with our worker ID that may not have been
   * cleaned up properly.
   */
  async cleanupOrphanedQuestionnaires(): Promise<void> {
    const oystehr = this.resourceHandler.apiClient;
    const processId = this.workerUniqueId;

    try {
      const orphaned = await oystehr.fhir.search<Questionnaire>({
        resourceType: 'Questionnaire',
        params: [
          {
            name: '_tag',
            value: `${processId}|e2e-test-questionnaire`,
          },
        ],
      });

      const questionnaires = orphaned.unbundle();
      console.log(`Found ${questionnaires.length} orphaned test questionnaires to cleanup`);

      for (const q of questionnaires) {
        if (q.id) {
          try {
            await oystehr.fhir.delete({ resourceType: 'Questionnaire', id: q.id });
            console.log(`Deleted orphaned test questionnaire: ${q.id}`);
          } catch (error) {
            console.warn(`Failed to delete orphaned questionnaire ${q.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to search for orphaned questionnaires:', error);
    }
  }
}
