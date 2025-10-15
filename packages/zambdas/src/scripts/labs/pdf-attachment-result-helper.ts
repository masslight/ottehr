import { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { CodeableConcept, DiagnosticReport, Observation, ServiceRequest } from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import { LAB_DR_TYPE_TAG } from 'utils';
import { createOystehrClient, getAuth0Token } from '../../shared';

// Creates a DiagnosticReport and an Observation to mock a pdf attachment
// npm run mock-pdf-result ['local' | 'dev' | 'development' | 'testing' | 'staging'] [serviceRequest Id]

const EXAMPLE_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];
// this is taken from LabCorp messages
const PDF_ATTACHMENT_CODE: CodeableConcept = {
  coding: [
    {
      code: 'PDFReport1',
      system: 'https://terminology.fhir.oystehr.com/CodeSystem/oystehr-lab-local-codes',
      display: 'PDF Report1',
    },
  ],
};

const main = async (): Promise<void> => {
  if (process.argv.length !== 4) {
    console.log(`exiting, incorrect number of arguments passed\n`);
    console.log(`Usage: npm run mock-pdf-result [${EXAMPLE_ENVS.join(' | ')}] [serviceRequest Id]\n`);
    process.exit(1);
  }

  const ENV = process.argv[2];
  const serviceRequestId = process.argv[3];

  let envConfig;
  try {
    envConfig = JSON.parse(fs.readFileSync(`.env/${ENV}.json`, 'utf8'));
  } catch (error) {
    console.error(`Error parsing secrets for ENV '${ENV}'. Error: ${JSON.stringify(error)}`);
  }

  const token = await getAuth0Token(envConfig);
  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }
  const oystehr = createOystehrClient(token, envConfig);

  let serviceRequest: ServiceRequest | undefined;
  try {
    serviceRequest = await oystehr.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
    });
  } catch {
    console.log(`exiting, no service request found with that ID in this env\n`);
    process.exit(1);
  }
  if (!serviceRequest) {
    console.log(`exiting, no service request found with that ID in this env\n`);
    process.exit(1);
  }

  const resultResources = (
    await oystehr.fhir.search({
      resourceType: 'DiagnosticReport',
      params: [
        {
          name: 'based-on',
          value: `ServiceRequest/${serviceRequestId}`,
        },
      ],
    })
  ).unbundle();
  if (!resultResources.length || !resultResources) {
    console.log(`exiting, no diagnostic reports found for that service request in this env\n`);
    process.exit(1);
  }

  const requests: BatchInputPostRequest<DiagnosticReport | Observation>[] = [];

  // grab first related diagnostic report thats not a reflex nor pdf attachment
  const drToDuplicate = resultResources.find(
    (resource) =>
      resource.resourceType === 'DiagnosticReport' &&
      !resource.meta?.tag?.some(
        (tag) =>
          tag.system === LAB_DR_TYPE_TAG.system &&
          (tag.display === LAB_DR_TYPE_TAG.display.reflex || tag.display === LAB_DR_TYPE_TAG.display.attachment)
      )
  ) as DiagnosticReport;
  console.log('DiagnosticReport that will be used to make the pdf attachment result DR - ', drToDuplicate.id);

  const obsFullUrl = `urn:uuid:${randomUUID()}`;
  const resultRefs = [{ reference: obsFullUrl }];
  const newObsResource: Observation = {
    resourceType: 'Observation',
    status: 'final',
    code: PDF_ATTACHMENT_CODE,
    extension: [
      {
        url: 'https://extensions.fhir.oystehr.com/observation-value-attachment-pre-release',
        valueAttachment: {
          data: 'JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgaHR0cDovL3d3dy5yZXBvcnRsYWIuY29tCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtQm9sZE9ibGlxdWUgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgOSAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDggMCBSIC9SZXNvdXJjZXMgPDwKL0V4dEdTdGF0ZSA8PAovZ1JMczAgPDwKL2NhIC4yOAo+PiAvZ1JMczEgPDwKL2NhIC41NQo+PiAvZ1JMczIgPDwKL2NhIDEKPj4gL2dSTHMzIDw8Ci9jYSAuNDUKPj4KPj4gL0ZvbnQgMSAwIFIgL1Byb2NTZXQgWyAvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJIF0KPj4gL1JvdGF0ZSAwIC9UcmFucyA8PAoKPj4gCiAgL1R5cGUgL1BhZ2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL1BhZ2VNb2RlIC9Vc2VOb25lIC9QYWdlcyA4IDAgUiAvVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKNyAwIG9iago8PAovQXV0aG9yIChhbm9ueW1vdXMpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNTEwMDgyMTEyMzkrMDAnMDAnKSAvQ3JlYXRvciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gd3d3LnJlcG9ydGxhYi5jb20pIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI1MTAwODIxMTIzOSswMCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gd3d3LnJlcG9ydGxhYi5jb20pIAogIC9TdWJqZWN0ICh1bnNwZWNpZmllZCkgL1RpdGxlICh1bnRpdGxlZCkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9Db3VudCAxIC9LaWRzIFsgNSAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjkgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMjQ5MAo+PgpzdHJlYW0KR2F0PSxnTiklLiZxL0E1aSREQ0Y8LmtmQT88bUA/Olc+SnFFYnFySFI0JFRlZDFTIU1RX00sPGpjJkJncEc7bCVQW2VGPylvbCEzbG9vaDk1V0AlJi9BW0JkSWhzJ0Q6MmVnYDFWbmBUW2d1L0dZMWAyJnFyTiJwVCxCOWpqK1k/Z2IxYkQ0ZSo/ZUI5QSQ4Nm5OOU1aTTNpdEEnRHJgZi5TNiVbbm1YQ3JXIlElY0xFMDRdPlFiK0w7NT8+IWZqJGdVX3FuYSxJKGQyZl5pJzFrRExXa1xJZ2RHQDZPalo0XFVUUVIhJGpTYiwxZkcjVSxZRnQjdG40XUpYXkUvWWsuRyJAczpnX20tIWN1WiplQiVGT2NSZD03KDFBPk11aShDY3VkIVcwOGRhbSxdVk0xYyNUVT1dMktLYmE/bU8yNUdnU09ub2p1Xiwkb0RUOTxWamZPRXRnbUJmRz9kVF9bLWBcPDBdOERBRUA8KCMoVE1NPTBbUig8OzA4X1xUa0src2k6VlAjZzk/SGghLExTJjBAUERoInE4Lyd1XCk6Z1RycCpSb2M6VUVZMWsqVHBvQCc7SDZeXUZsVjcvLk5IMmQ0RSI7QyRVdEA0N1xIUEdROm1fSzpnKFU+UmZCSDRkYTlCNmBZaTdHR24saU0lYjQ5bnJdRCY8K0ohbjhaOG03amxRYzglJFFkNXNoRmBoWUtjNiwnS1YxTXJCNCZBbidtLDNwNzA6IVlcWzQlImpbISIua15MKEw/aTw2bUotaElcKzluNjMqPVA1VGNraig2cnBMKUlca09LNUQsQC5GdTgsJi8oZT8ldFEhSDhMcERBJXU9SVMwYXBFOXAjND1pblhNLiI7cWEzLyVuZFwvXF06OjQxYDlILTBNa0MyMVhsZHVvbiRYTT5hJ1RVblM7QWxyV3RSLDZqaGpDYmQsNklCWlspXE9zTUg2TGRELzlQNz1fM10uYW9hMEhUXzNBRj48NSchb2hQISYwYVdycnMhQjlLaVhmOydpSCwpI0kyKkFKPDVKJXQrcGI5LEchPyxpTnM4VlAoM1IuQlJRJDBPJkVWazwsWU5jODBLcmgrakItQFZRMzRnOD42UT5cNSpXLit1YCsiaCgyU2AydCQ3TTJcX2UxQ0EsITtKSUJvXWQkZDlgRDZZPWReXj1ITFxJL2puYzRoZiYocnQkKCZsMV8wcEgxTlAoR1U1bkA7bnRbNl5JYWBWXT1SO0xYQzJhZSdZMUoxJlk/YSVFTnRkXj1NWVtRWE5hamItb0dTQm5HdE4oQitaU25QWUY0a1FjRjIjXkRIKDIkIT9nSTYlSTVabVs1SGVZaE9zMllLMUZUaDdmckFlcSFwNkJMaydEQVFpYlFbWjlmbTdxXkYiazZVMmlrQFhcJ0wtL0tcYi8uX0NpTWJdNmlHPVgraTNMclM8N0hyZltvL2psbSdiVyZGN2NpO1hEKF87SyksZ2Y5OTRDZWlWITpxZykhRmhSMT9CNCo+SkQkNTRdSDJbSVQkTGAxVDM0TG1OJEVRPkw4PzE/O2dgIiYzKkhMQ29nKToqXkglTk42bFgoL2lBdSFxYm08OC4nNF1QMksqYyxVMlNGdEtGWmEsQUtGIzVrV2JMUVgpLSNvYVhbR0JARF1AUGR1W18kLi4ndHI+O0gqX2EtP15tbmpqM1lCSyEhQzZFZVM1UTJtI3NzTVdPay1CM2lXSVQxWDIsP1dkJ2ZqYDVQLj06ZGg3QElTbjdSU1glOVZwJ0M+YXIsJydRL0pAQFRsXyZPO3I9N0JtbDVRW1RiJlEiZERWYHFUKEhcR11GMnRrTFE/UVdDOlk3WnRWYCNZR1tZM0hLRyFWMSQxamMzS0xgTD5bTVB0bmxxPXJcOUcxQlhsMUg3UiU+STFLUS09JDYwVVwiVGpOJXJeTWtqQFZjaihaLihbciksNVVXMiFOZjtJcDE+dF1rXjRJW0I7aF0zcSJmXURxQF9sVFJGYnV1OkpdbiZyQFwpQWQxWVxkQ2ttIU4jOFpNXStEZ1NgUyE2SjhVLS0yUmVUcStsLWQ9NCRtYlVELl8lcUAyNFheSGsqRUE4JSs5LWdbcWovYyQpTVFAN0omKS4kMktMOzI3MyNxOWlXKz1LXyhNZiQnbGx1VmxYYWU5K2FDayRrO2gvOlNiMFZ1LCZcclxhXz8iY2NvPmlDaFg+OExqTUJPLFJpJEVYXEE3ZVUlJk5EKEtgcUJUbyo1WnJoIktPLSM+XT5VQy8xTjxuPi1VYkdbYjRCVHBlP1UmUz4ySWdFayZhTkExPC1iOSIrKSRBZ1pITys/VDg4c0RUPjhpNExKT2kuJz4vZnIlWXBtUnIqZCdhODBwcE5JIzNrSCt0dSRIMjMra1w6VTs6JmYvQklZaDVbYDIuUVw2KykwQjplYnVZU1JNRy50JG1pJGBBVldAYGopQiUnWWosKT8laWYiW2EyNkdeIz9SZEpnZVs4W0N1KFBnRFQ9WnMxVjosdFtJYk5uczAtQSFEY281J2I/XXUhKkF0ciVbRTBQM0c1OjdTa0dvKTopW2BDRCFCLTIiV2FqcDpHPyQoLiRpQVNDcFt0Nk8oJCVcIltXRGp0Ry1QVGRlQWw8VFNVVmFRVDRYZVA8L21AXWJcP05gQWMvX0pDLVF1RFc4RjRrckhkNCFJcHJjUVQyL2RmVzBgOzkiQFZHY0tsMEkxIjRfOyxERStFR00vQGBRUFM0YGhvJzpycWBMX04tK2BRPE07UitcVkk/LW1Yb29GUjJYLz86bmtAPUZNaWhpVjhXZEIkY2hBQz4uSkwqWS4/W2QoNSRZMkFwL24mRWFQXStHcGMtZDtvVDJDNmA7XFREV2RRQGVLUm9CJXQzR0d1aV9qXSRbUz4zN2E7VDdmTVY3ZmZhXScpbFAlUy8wYmAsdHQjVzlhRDtBcHFQJFI+RWFzLDljbXNgV0hlYEAwL0hfU11CNUNlLlshXkU6PixAVDI/VjYjZkA3NV8iOT1PMEZVJ01VRjhqMDg0JURKb2doc0Y1WitQRFUvVmVgMWlWcTA3Jk5tJl5ldERwJlhYVy4kLHNePzIyWSEyTUJrVGY4clhPTSQ1Q25ZNz5hXTQuKzVvSVA3WDlTRlo6YFc3a2sobzZUcStbR2U/TENYJERmI2tgaWVNKGF1KzNvYj1lTi47Q1QyOC05KW02P0Ytck5IUS4uTFtTUlNNV0FkLDxYMSZsKSg2Q2BUa01BOGQ+L3JDUCokcS9gZmopUVdBO19gQT5EYTVOYWAtZ0xONV45bjhLKXBtKGBJZGg7QX4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTAKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDczIDAwMDAwIG4gCjAwMDAwMDAxMjQgMDAwMDAgbiAKMDAwMDAwMDIzMSAwMDAwMCBuIAowMDAwMDAwMzQzIDAwMDAwIG4gCjAwMDAwMDA0NjIgMDAwMDAgbiAKMDAwMDAwMDc1NCAwMDAwMCBuIAowMDAwMDAwODIyIDAwMDAwIG4gCjAwMDAwMDExMTggMDAwMDAgbiAKMDAwMDAwMTE3NyAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzxlZDcwMWZhOTNhYTA4NTg4ODc1ZmZkYzY5ZTc1YTYxZj48ZWQ3MDFmYTkzYWEwODU4ODg3NWZmZGM2OWU3NWE2MWY+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAoaHR0cDovL3d3dy5yZXBvcnRsYWIuY29tKQoKL0luZm8gNyAwIFIKL1Jvb3QgNiAwIFIKL1NpemUgMTAKPj4Kc3RhcnR4cmVmCjM3NTgKJSVFT0YK',
          contentType: 'AP/PDF',
          creation: DateTime.now().toISO(),
        },
      },
    ],
  };
  requests.push({
    method: 'POST',
    url: '/Observation',
    resource: newObsResource,
    fullUrl: obsFullUrl,
  });

  const pdfAttachmentDR: DiagnosticReport = { ...drToDuplicate, code: PDF_ATTACHMENT_CODE };
  pdfAttachmentDR.meta = {
    tag: [
      {
        system: LAB_DR_TYPE_TAG.system,
        code: LAB_DR_TYPE_TAG.code.attachment,
        display: LAB_DR_TYPE_TAG.display.attachment,
      },
    ],
  };
  pdfAttachmentDR.result = resultRefs;

  // remove existing id and basedOn
  delete pdfAttachmentDR.id;
  delete pdfAttachmentDR.basedOn;

  requests.push({
    method: 'POST',
    url: '/DiagnosticReport',
    resource: pdfAttachmentDR,
  });

  console.log('making transaction request');
  const bundle = await oystehr.fhir.transaction({ requests });

  console.log('Successfully created all resources:');
  bundle.entry?.forEach((entry) => {
    console.log(`${entry.resource?.resourceType}/${entry.resource?.id}`);
  });
};

main().catch((error) => {
  console.log(error, JSON.stringify(error, null, 2));
  throw error;
});
