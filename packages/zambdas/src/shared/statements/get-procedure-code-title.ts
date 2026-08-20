import Oystehr from '@oystehr/sdk';

export async function getProcedureCodeTitle(params: {
  code: string;
  oystehr: Oystehr;
  display?: string;
}): Promise<string> {
  const { code, oystehr, display } = params;
  if (!code) return '';

  let name = display;
  if (!name) {
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
    name =
      cptResponse.codes.find((c) => c.code === code)?.display ??
      hcpcsResponse.codes.find((c) => c.code === code)?.display;
  }

  return name ? `${code} - ${name}` : code;
}
