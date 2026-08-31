export function parseCommaSeparatedTags(tags?: string): { [key: string]: string } {
  if (!tags) {
    return {};
  }
  return tags.split(',').reduce(
    (tags, tagPair) => {
      const tag = tagPair.split('=').filter(Boolean);
      if (tag.length == 2) {
        tags[tag[0].trim()] = tag[1].trim();
      }
      return tags;
    },
    {} as { [key: string]: string }
  );
}
