import Oystehr from '@oystehr/sdk';
import { GetUnsolicitedResultsResourcesForIcon } from 'utils';

export const handleRequestForIcon = async (oystehr: Oystehr): Promise<GetUnsolicitedResultsResourcesForIcon> => {
  console.log('making search request for unsolicited results tasks and drs');
  const resourceSearch = (
    await oystehr.fhir.search({
      resourceType: 'DiagnosticReport',
      params: [
        {
          name: '_tag',
          value: 'unsolicited',
        },
        { name: '_has:Task:based-on:status', value: 'ready' },
        { name: '_revinclude', value: 'Task:based-on' },
      ],
    })
  ).unbundle();

  console.log('resourceSearch.length', resourceSearch.length);

  return {
    tasksAreReady: resourceSearch.length > 0,
  };
};
