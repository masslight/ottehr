/**
 * Derive a stable kebab-case slug from a display name: lowercase, runs of
 * non-alphanumerics collapse to single dashes, no leading/trailing dashes.
 * Used for paperwork-flow slugs and practice-managed questionnaire canonical names.
 */
export function slugify(name: string, options: { maxLength?: number } = {}): string {
  let slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (options.maxLength !== undefined && slug.length > options.maxLength) {
    slug = slug.slice(0, options.maxLength).replace(/-+$/g, '');
  }
  return slug;
}
