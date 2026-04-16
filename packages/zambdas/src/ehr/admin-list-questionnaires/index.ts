import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, PRACTICE_MANAGED_TAG } from '../admin-questionnaires/helpers';

export const index = wrapHandler(
  'admin-list-questionnaires',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const oystehr = await getClient(input);

    // Fetch practice-managed questionnaires
    const practiceManaged = (
      await oystehr.fhir.search<Questionnaire>({
        resourceType: 'Questionnaire',
        params: [{ name: '_tag', value: PRACTICE_MANAGED_TAG.code }],
      })
    ).unbundle();

    // Fetch all questionnaires to find system ones (for association options)
    const all = (
      await oystehr.fhir.search<Questionnaire>({
        resourceType: 'Questionnaire',
        params: [{ name: 'status', value: 'active' }],
      })
    ).unbundle();

    const practiceManagedIds = new Set(practiceManaged.map((q) => q.id));

    // Deduplicate by URL and name — keep one entry per unique questionnaire
    const seenUrls = new Set<string>();
    const seenNames = new Set<string>();
    const systemQuestionnaires: { id: string; url: string; title: string }[] = [];

    console.log(`Found ${all.length} total questionnaires, ${practiceManagedIds.size} practice-managed`);

    for (const q of all) {
      if (practiceManagedIds.has(q.id) || !q.url) continue;
      // Only include patient-facing intake questionnaires. We identify these by checking
      // for group items with "page" in the linkId, which is the Ottehr convention for
      // multi-page intake forms. This heuristic has been verified across all known instances
      // but is fragile — a more robust approach would be to tag intake questionnaires with
      // a meta tag like "intake-paperwork" so they can be identified without inspecting
      // their internal structure.
      const hasPages = q.item?.some((item) => item.type === 'group' && item.linkId?.includes('page'));
      if (!hasPages) continue;
      const key = q.url;
      if (seenUrls.has(key)) continue;
      seenUrls.add(key);

      const name = q.name || q.url.split('/').pop() || '';
      if (seenNames.has(name)) continue;
      seenNames.add(name);

      const title = q.title || q.name || 'Untitled';
      systemQuestionnaires.push({
        id: q.id!,
        url: q.url,
        title,
      });

      console.log(`System questionnaire: ${title} | name=${name} | url=${q.url} | id=${q.id}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ questionnaires: practiceManaged, systemQuestionnaires }),
    };
  }
);
