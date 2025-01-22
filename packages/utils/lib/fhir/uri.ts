enum BASE_SEARCH_PARAMS {
  _count = '_count',
  _sort = '_sort',
  _include = '_include',
  _revinclude = '_revinclude',
  _summary = '_summary',
  _total = '_total',
  _elements = '_elements',
  _contained = '_contained',
  _containedType = '_containedType',
}

interface BaseSearchParams {
  // ?_count=20
  [BASE_SEARCH_PARAMS._count]?: number;

  // ?_sort=date,-name
  [BASE_SEARCH_PARAMS._sort]?: string;

  // ?_include=Patient:organization
  // ?_include=Patient:organization&_include=Patient:generalPractitioner
  [BASE_SEARCH_PARAMS._include]?: string | string[];

  // ?_revinclude=Provenance:target
  [BASE_SEARCH_PARAMS._revinclude]?: string | string[];

  // ?_summary=true
  [BASE_SEARCH_PARAMS._summary]?: 'true' | 'text' | 'data' | 'count' | 'false';

  // ?_total=accurate
  [BASE_SEARCH_PARAMS._total]?: 'none' | 'estimate' | 'accurate';

  // ?_elements=identifier,active,name
  [BASE_SEARCH_PARAMS._elements]?: string | string[];

  // ?_contained=true
  [BASE_SEARCH_PARAMS._contained]?: 'true' | 'false' | 'both';

  // ?_containedType=container
  [BASE_SEARCH_PARAMS._containedType]?: 'container' | 'contained';
}

type AdvancedSearchParams = Record<
  string,
  {
    type: 'number' | 'date' | 'string' | 'token' | 'reference' | 'composite' | 'uri' | 'special';
    value: string | number | boolean;
  }
>;

const _SEARCH_BY_PROP_KEY = '_search_by';

interface SearchByUrlParams {
  [_SEARCH_BY_PROP_KEY]?: 'patient' | 'encounter';
}

export type SearchParams = (BaseSearchParams | AdvancedSearchParams) & SearchByUrlParams;

export function addSearchParams(url: string, searchParams?: SearchParams): string {
  if (!searchParams) return url;

  const params: string[] = [];

  // base search params
  if (searchParams[BASE_SEARCH_PARAMS._count] !== undefined)
    params.push(`_count=${searchParams[BASE_SEARCH_PARAMS._count]}`);
  if (searchParams[BASE_SEARCH_PARAMS._sort]) params.push(`_sort=${searchParams[BASE_SEARCH_PARAMS._sort]}`);

  if (searchParams[BASE_SEARCH_PARAMS._include]) {
    const includes = Array.isArray(searchParams[BASE_SEARCH_PARAMS._include])
      ? searchParams[BASE_SEARCH_PARAMS._include]
      : ([searchParams[BASE_SEARCH_PARAMS._include]] as string[]);
    includes.forEach((include) => params.push(`_include=${include}`));
  }

  if (searchParams[BASE_SEARCH_PARAMS._revinclude]) {
    const revincludes = Array.isArray(searchParams[BASE_SEARCH_PARAMS._revinclude])
      ? searchParams[BASE_SEARCH_PARAMS._revinclude]
      : ([searchParams[BASE_SEARCH_PARAMS._revinclude]] as string[]);
    revincludes.forEach((revinclude) => params.push(`_revinclude=${revinclude}`));
  }

  if (searchParams[BASE_SEARCH_PARAMS._summary]) params.push(`_summary=${searchParams[BASE_SEARCH_PARAMS._summary]}`);
  if (searchParams[BASE_SEARCH_PARAMS._total]) params.push(`_total=${searchParams[BASE_SEARCH_PARAMS._total]}`);

  if (searchParams[BASE_SEARCH_PARAMS._elements]) {
    const elements = Array.isArray(searchParams[BASE_SEARCH_PARAMS._elements])
      ? searchParams[BASE_SEARCH_PARAMS._elements]
      : [searchParams[BASE_SEARCH_PARAMS._elements]];
    params.push(`_elements=${elements.join(',')}`);
  }

  if (searchParams[BASE_SEARCH_PARAMS._contained])
    params.push(`_contained=${searchParams[BASE_SEARCH_PARAMS._contained]}`);
  if (searchParams[BASE_SEARCH_PARAMS._containedType])
    params.push(`_containedType=${searchParams[BASE_SEARCH_PARAMS._containedType]}`);

  // advanced search params
  Object.entries(searchParams).forEach(([key, param]) => {
    if (Object.values({ ...BASE_SEARCH_PARAMS, _SEARCH_BY_PROP_KEY }).includes(key as any)) return; // skip base and skipped search params
    if ('value' in param) {
      params.push(`${key}=${param.value}`);
    }
  });

  if (params.length > 0) {
    url += (url.includes('?') ? '&' : '?') + params.join('&');
  }

  return url;
}
