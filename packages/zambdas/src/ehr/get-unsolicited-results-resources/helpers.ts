import Oystehr, { BatchInputGetRequest, Bundle } from '@oystehr/sdk';
import { FhirResource } from 'fhir/r4b';
import { GetUnsolicitedResultsResourcesForIcon } from 'utils';
import { parseBundleResources } from '../get-chart-data/helpers';

export const handleRequestForIcon = async (oystehr: Oystehr): Promise<GetUnsolicitedResultsResourcesForIcon> => {
  const getUnsolicitedDRsWithTasks: BatchInputGetRequest = {
    method: 'GET',
    url: `/DiagnosticReport?_tag=unsolicited&_has:Task:based-on:status=ready&_revinclude=Task:based-on`,
  };

  console.log('making transaction request for unsolicited results tasks and drs');
  const bundle: Bundle<FhirResource> = await oystehr.fhir.transaction({
    requests: [getUnsolicitedDRsWithTasks],
  });
  const resources = parseBundleResources(bundle);
  console.log('resources.length', resources.length);

  return {
    tasksAreReady: resources.length > 0,
  };
};
