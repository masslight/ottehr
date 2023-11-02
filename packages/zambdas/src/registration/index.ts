/* eslint-disable sort-keys */
import { APIGatewayProxyResult } from 'aws-lambda';
import fetch from 'node-fetch'; // Make sure to install this package if not already installed
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
import { getAuth0Token } from '../shared';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, postProviderProfile);
};

// interface PostProviderProfileInput {
//   checkboxes: boolean;
//   email: string;
//   firstName: string;
//   lastName: string;
//   slug: string;
//   title: 'Mr' | 'Ms' | 'Mrs' | 'Dr' | 'Nurse' | 'Assistant';
// }

const postProviderProfile = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const { secrets } = input;
  // const { checkboxes, email, firstName, lastName, slug, title } = body as PostProviderProfileInput;

  const authToken = await getAuth0Token(secrets);

  console.log(authToken);

  // const patientResource = {
  //   resourceType: 'Patient',
  //   id: '00000000-0000-0000-0000-000000000000',
  //   text: {
  //     status: 'generated',
  //     div: '<div xmlns="http://www.w3.org/1999/xhtml"> Patient MINT_TEST, ID = MINT1234. Age = 56y, Size =\n      1.83m, Weight = 72.58kg </div>',
  //   },
  //   extension: [
  //     {
  //       url: 'http://nema.org/fhir/extensions#0010:1010',
  //       valueQuantity: {
  //         value: 56,
  //         unit: 'Y',
  //       },
  //     },
  //     {
  //       url: 'http://nema.org/fhir/extensions#0010:1020',
  //       valueQuantity: {
  //         value: 1.83,
  //         unit: 'm',
  //       },
  //     },
  //     {
  //       url: 'http://nema.org/fhir/extensions#0010:1030',
  //       valueQuantity: {
  //         value: 72.58,
  //         unit: 'kg',
  //       },
  //     },
  //   ],
  //   identifier: [
  //     {
  //       system: 'http://nema.org/examples/patients',
  //       value: 'MINT1234',
  //     },
  //   ],
  //   active: true,
  //   name: [
  //     {
  //       family: 'MINT_TEST',
  //     },
  //   ],
  //   gender: 'male',
  //   _gender: {
  //     extension: [
  //       {
  //         url: 'http://nema.org/examples/extensions#gender',
  //         valueCoding: {
  //           system: 'http://nema.org/examples/gender',
  //           code: 'M',
  //         },
  //       },
  //     ],
  //   },
  //   managingOrganization: {
  //     reference: 'Organization/1',
  //   },
  //   meta: {
  //     versionId: '00000000-0000-0000-0000-000000000000',
  //     lastUpdated: '2023-01-01T00:00:00.000Z',
  //   },
  // };

  try {
    const response = await fetch(`https://fhir-api.zapehr.com/r4/Patient`, {
      body: JSON.stringify({
        resourceType: 'Patient',
        id: '00000000-0000-0000-0000-000000000000',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"> Patient MINT_TEST, ID = MINT1234. Age = 56y, Size =1.83m, Weight = 72.58kg </div>',
        },
        extension: [
          {
            url: 'http://nema.org/fhir/extensions#0010:1010',
            valueQuantity: {
              value: 56,
              unit: 'Y',
            },
          },
          {
            url: 'http://nema.org/fhir/extensions#0010:1020',
            valueQuantity: {
              value: 1.83,
              unit: 'm',
            },
          },
          {
            url: 'http://nema.org/fhir/extensions#0010:1030',
            valueQuantity: {
              value: 72.58,
              unit: 'kg',
            },
          },
        ],
        identifier: [
          {
            system: 'http://nema.org/examples/patients',
            value: 'MINT1234',
          },
        ],
        active: true,
        name: [
          {
            family: 'MINT_TEST',
          },
        ],
        gender: 'male',
        _gender: {
          extension: [
            {
              url: 'http://nema.org/examples/extensions#gender',
              valueCoding: {
                system: 'http://nema.org/examples/gender',
                code: 'M',
              },
            },
          ],
        },
        managingOrganization: {
          reference: 'Organization/1',
        },
        meta: {
          versionId: '00000000-0000-0000-0000-000000000000',
          lastUpdated: '2023-01-01T00:00:00.000Z',
        },
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    console.log('response', response);
    if (response.status === 201) {
      const responseData = await response.json();
      return {
        error: undefined,
        response: responseData,
      };
    } else {
      const errorData = await response.json();
      return {
        error: errorData,
        response: undefined,
      };
    }
  } catch (error: any) {
    return {
      error: error.message,
      response: undefined,
    };
  }
};
