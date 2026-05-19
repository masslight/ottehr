import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import {
  AdminUpdateProgressNoteConfigInput,
  DispositionType,
  PROGRESS_NOTE_CONFIG_TAG,
  PROGRESS_NOTE_DISPOSITION_DEFAULTS_EXTENSION_URL,
  PROGRESS_NOTE_MDM_EXTENSION_URL,
  ProgressNoteConfig,
  Secrets,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-update-progress-note-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);

  const validatedParameters: AdminUpdateProgressNoteConfigInput & { secrets: Secrets | null; userToken: string } =
    validateRequestParameters(input);

  const { secrets, config } = validatedParameters;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const configResource = buildConfigResource(config);

  const existingResources = (
    await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [
        {
          name: '_tag',
          value: `${PROGRESS_NOTE_CONFIG_TAG.system}|${PROGRESS_NOTE_CONFIG_TAG.code}`,
        },
      ],
    })
  ).unbundle();

  const existing = existingResources.find((r): r is Basic => r.resourceType === 'Basic');

  if (existing) {
    await oystehr.fhir.update<Basic>({ ...configResource, id: existing.id! });
  } else {
    await oystehr.fhir.create<Basic>(configResource);
  }

  return {
    statusCode: 204,
    body: JSON.stringify({}),
  };
});

const buildConfigResource = (config: ProgressNoteConfig): Basic => {
  const dispositionExtensions = Object.entries(config.dispositionDefaults).map(([type, text]) => ({
    url: type as DispositionType,
    valueString: text,
  }));

  return {
    resourceType: 'Basic',
    meta: {
      tag: [PROGRESS_NOTE_CONFIG_TAG],
    },
    code: {
      coding: [
        {
          system: PROGRESS_NOTE_CONFIG_TAG.system,
          code: PROGRESS_NOTE_CONFIG_TAG.code,
        },
      ],
    },
    extension: [
      {
        url: PROGRESS_NOTE_MDM_EXTENSION_URL,
        valueString: config.mdmDefaultText,
      },
      {
        url: PROGRESS_NOTE_DISPOSITION_DEFAULTS_EXTENSION_URL,
        extension: dispositionExtensions,
      },
    ],
  };
};
