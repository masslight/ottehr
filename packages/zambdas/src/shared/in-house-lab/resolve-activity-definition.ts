import { ActivityDefinition } from 'fhir/r4b';
import { getTag, IN_HOUSE_LAB_LATEST_TAG_DEFINITION } from 'utils';

/**
 * Group ADs by canonical URL and ensure version within each group.
 * Returns a Map keyed by ad.url -> the latest-version AD for that url.
 */
export const indexLatestActivityDefinitionsByUrl = (ads: ActivityDefinition[]): Map<string, ActivityDefinition> => {
  const out = new Map<string, ActivityDefinition>();
  ads.forEach((ad) => {
    if (ad.url && !!getTag(ad, IN_HOUSE_LAB_LATEST_TAG_DEFINITION.system, IN_HOUSE_LAB_LATEST_TAG_DEFINITION.code)) {
      out.set(ad.url, ad);
    }
  });
  return out;
};

/**
 * A canonical reference saved on a plan ServiceRequest may be either a bare
 * url ("https://...") or include a version ("https://...|1.2.3"). Newer
 * templates save the bare url so resolution can float to the latest AD; older
 * templates may still carry a versioned ref. Either way we look up by the url
 * part - the version segment is ignored.
 */
export const urlFromInstantiatesCanonical = (ref: string): string => ref.split('|')[0];
