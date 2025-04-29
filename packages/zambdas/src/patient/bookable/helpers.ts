import { BookableResource, SLUG_SYSTEM } from 'utils';

export const getSlugForBookableResource = (resource: BookableResource): string | undefined => {
  return resource.identifier?.find((id) => {
    return id.system === SLUG_SYSTEM;
  })?.value;
};
