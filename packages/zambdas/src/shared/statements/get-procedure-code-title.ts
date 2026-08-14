import Oystehr from '@oystehr/sdk';

export async function getProcedureCodeTitle(code: string, oystehr: Oystehr): Promise<string> {
  const [cptResponse, hcpcsResponse] = await Promise.all([
    oystehr.terminology.searchCpt({
      searchType: 'code',
      strictMatch: true,
      query: code,
    }),
    oystehr.terminology.searchHcpcs({
      searchType: 'code',
      strictMatch: true,
      query: code,
    }),
  ]);
  const name =
    cptResponse.codes.find((c) => c.code === code)?.display ??
    hcpcsResponse.codes.find((c) => c.code === code)?.display;
  return name ? `${code} - ${name}` : code;
}
