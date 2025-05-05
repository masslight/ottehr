import { PROJECT_WEBSITE } from 'utils';

interface RedirectResult {
  relative?: string;
  absolute?: string;
}

export const getRedirectPath = (params: Record<string, string | undefined>, path: string): RedirectResult => {
  if (path === '/') {
    // console.log('handling base path');
    return { absolute: PROJECT_WEBSITE };
  }
  const { slug: slugParam, visit_type: visitTypeParam, schedule_type: scheduleTypeParam } = params;
  if (!slugParam || !visitTypeParam) {
    return {};
  }
  const oldPathForm = `/${scheduleTypeParam}/${slugParam}/${visitTypeParam ?? 'prebook'}`;
  const newPathForm = `/${scheduleTypeParam}/${slugParam}/${visitTypeParam ?? 'prebook'}`;
  if (path.startsWith(oldPathForm)) {
    return { relative: path.replace(oldPathForm, newPathForm) };
  }

  return {};
};
