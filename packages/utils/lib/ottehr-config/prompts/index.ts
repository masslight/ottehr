import { PromptsConfig, PromptsConfigSchema } from 'config-types';
import { PROMPTS_OVERRIDE } from '../../../ottehr-config-overrides/prompts';
import { mergeAndFreezeConfigObjects } from '../helpers';

const PROMPTS_DEFAULTS: PromptsConfig = {
  HPI_SUGGESTION: `For each of these clinic data points gathered in HPI for an urgent care visit:
    Onset,
    Location,
    Duration, 
    Characteristic,
    Aggravating,
    Relieving,
    Timing,
    Severity,
    Associated Symptoms

    Identify any the provider did not address sufficiently in the following HPI with a simple concise list within a single sentence of possibly missing items.
    Start the single sentence with "HPI may not have covered"
    Return a JSON object with a single field "suggestions" that is empty if there are no suggestions, or a list of one string of potentially missing items.
    Do not respond with more than one sentence.
    The response should be formatted like:
    {
      "suggestions": ["HPI may not have covered Onset, Location, Duration, Characteristic, Aggravating, Relieving, Timing, Severity, Associated Symptoms"]
    }`,
};

const mergedConfig = mergeAndFreezeConfigObjects(PROMPTS_DEFAULTS, PROMPTS_OVERRIDE);

export const PROMPTS_CONFIG = PromptsConfigSchema.parse(mergedConfig);
