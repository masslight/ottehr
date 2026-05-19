import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import {
  AdminGetProgressNoteConfigOutput,
  DispositionType,
  getDefaultNote,
  MDM_FIELD_DEFAULT_TEXT,
  PROGRESS_NOTE_CONFIG_TAG,
  PROGRESS_NOTE_DISPOSITION_DEFAULTS_EXTENSION_URL,
  PROGRESS_NOTE_MDM_EXTENSION_URL,
  ProgressNoteConfig,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-progress-note-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);

  const { secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const config = await getProgressNoteConfig(oystehr);

  const output: AdminGetProgressNoteConfigOutput = { config };

  return {
    statusCode: 200,
    body: JSON.stringify(output),
  };
});

export const getProgressNoteConfig = async (oystehr: Oystehr): Promise<ProgressNoteConfig> => {
  const resources = (
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

  const resource = resources.find((r): r is Basic => r.resourceType === 'Basic');

  return resource ? parseConfig(resource) : buildDefaultConfig();
};

const buildDefaultConfig = (): ProgressNoteConfig => ({
  mdmDefaultText: MDM_FIELD_DEFAULT_TEXT,
  dispositionDefaults: {
    'pcp-no-type': getDefaultNote('pcp-no-type'),
    another: getDefaultNote('another'),
    ed: getDefaultNote('ed'),
    specialty: getDefaultNote('specialty'),
  },
});

const parseConfig = (resource: Basic): ProgressNoteConfig => {
  const mdmExt = resource.extension?.find((e) => e.url === PROGRESS_NOTE_MDM_EXTENSION_URL);
  const mdmDefaultText = mdmExt?.valueString ?? MDM_FIELD_DEFAULT_TEXT;

  const dispositionExt = resource.extension?.find((e) => e.url === PROGRESS_NOTE_DISPOSITION_DEFAULTS_EXTENSION_URL);

  const dispositionDefaults: Partial<Record<DispositionType, string>> = {};
  dispositionExt?.extension?.forEach((ext) => {
    if (ext.url && ext.valueString !== undefined) {
      dispositionDefaults[ext.url as DispositionType] = ext.valueString;
    }
  });

  return { mdmDefaultText, dispositionDefaults };
};
