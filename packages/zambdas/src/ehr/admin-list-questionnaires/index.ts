import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { getAllFhirSearchPages, PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient } from '../admin-questionnaires/helpers';

export const index = wrapHandler(
  'admin-list-questionnaires',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const oystehr = await getClient(input);

    // Fetch practice-managed questionnaires. Paginated — a single page would silently
    // truncate once the catalog outgrows the default page size (it already has 100+).
    const practiceManaged = await getAllFhirSearchPages<Questionnaire>(
      {
        resourceType: 'Questionnaire',
        params: [{ name: '_tag', value: PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code }],
      },
      oystehr
    );

    // Fetch all questionnaires to find system ones (for association options). Projecting only
    // identifying fields — including `item` blows past the 6 MB SDK response cap because the
    // page-item trees are huge across hundreds of versioned questionnaires. Intake forms are
    // instead identified below via URL pattern, which is reliable for Ottehr's canonical
    // intake-paperwork-{inperson,virtual} URL convention.
    const all = (
      await oystehr.fhir.search<Questionnaire>({
        resourceType: 'Questionnaire',
        params: [
          { name: 'status', value: 'active' },
          { name: '_elements', value: 'id,url,name,title' },
          { name: '_count', value: '500' },
        ],
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
      // Only include patient-facing intake questionnaires. Ottehr's intake URLs follow the
      // convention `…/Questionnaire/intake-paperwork-{inperson,virtual}` — matching on that
      // pattern is reliable and lets us avoid pulling the full `item` tree (8.5 MB across
      // versioned questionnaires) just to check linkId structure.
      if (!q.url.includes('intake-paperwork')) continue;
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
