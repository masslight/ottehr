export function removeHtmlTags(input: string): string {
  // Replace any HTML tags with an empty string
  return input.replace(/<\/?[^>]+(>|$)/g, '');
}
