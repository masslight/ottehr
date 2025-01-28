import { generatePath } from 'react-router-dom';
import { ServiceMode, VisitType } from 'utils';
import { AvailableLocationInformation } from '../api/zapehrApi';
import { bookingBasePath } from '../App';
import { PROJECT_WEBSITE } from './constants';

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

export function getStartingPath(
  slugOrLocation: string | AvailableLocationInformation | object | undefined,
  visitType: VisitType | undefined,
  serviceType: ServiceMode | undefined,
  selectedSlot?: string
): string {
  let slug = (slugOrLocation || '') as string;
  const possiblyLocation = slugOrLocation as unknown as AvailableLocationInformation | undefined;
  if (possiblyLocation && possiblyLocation?.slug) {
    slug = possiblyLocation.slug || '';
  }

  if (visitType === VisitType.PreBook && possiblyLocation?.scheduleType && serviceType === ServiceMode.virtual) {
    return `/prebook/virtual?bookingOn=${slug}&scheduleType=${possiblyLocation?.scheduleType}${
      selectedSlot ? `&slot=${selectedSlot}` : ''
    }`;
  }

  if (visitType === VisitType.PreBook && possiblyLocation?.scheduleType && serviceType !== ServiceMode.virtual) {
    return `/prebook/in-person?bookingOn=${slug}&scheduleType=${possiblyLocation?.scheduleType}${
      selectedSlot ? `&slot=${selectedSlot}` : ''
    }`;
  }

  return generatePath(bookingBasePath, {
    slug: slug?.toLowerCase(),
    visit_type: visitType || VisitType.PreBook,
    service_mode: serviceType || ServiceMode['in-person'],
  });
}
