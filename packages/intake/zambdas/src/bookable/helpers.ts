import { BookableResource, OTTEHR_SLUG_ID_SYSTEM } from 'utils';

export const getSlugForBookableResource = (resource: BookableResource): string | undefined => {
  return resource.identifier?.find((id) => {
    return id.system === OTTEHR_SLUG_ID_SYSTEM;
  })?.value;
};
