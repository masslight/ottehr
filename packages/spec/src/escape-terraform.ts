/**
 * Escapes Terraform template syntax characters in literal string values.
 *
 * Terraform interprets certain character sequences as template syntax:
 * - `${...}` - variable interpolation
 * - `%{...}` - template directives (conditionals, loops)
 *
 * This function escapes these sequences by doubling the leading character:
 * - `${` becomes `$${` (literal dollar-brace)
 * - `%{` becomes `%%{` (literal percent-brace)
 *
 * IMPORTANT: This function preserves valid Terraform resource references
 * that start with known prefixes (e.g., `${oystehr_*}`).
 *
 * @param value - The string value to escape
 * @param terraformResourcePrefixes - Array of prefixes that identify valid Terraform references
 *                                    (default: ['oystehr_'])
 * @returns The escaped string safe for use in Terraform JSON configuration
 *
 * @example
 * // Escapes template directives
 * escapeTerraformTemplateSyntax('password: $%{secret}') // 'password: $%%{secret}'
 *
 * @example
 * // Preserves valid Terraform references
 * escapeTerraformTemplateSyntax('${oystehr_m2m.client.id}') // '${oystehr_m2m.client.id}'
 *
 * @example
 * // Escapes non-Terraform interpolations
 * escapeTerraformTemplateSyntax('${MY_VAR}') // '$${MY_VAR}'
 */
export function escapeTerraformTemplateSyntax(
  value: string,
  terraformResourcePrefixes: string[] = ['oystehr_']
): string {
  // Process $ first (before %), looking at original positions
  // Escape all $ characters before { by doubling them, EXCEPT for valid Terraform references
  let escaped = value.replace(/(\$+)\{/g, (match, dollars, offset) => {
    // Check what comes immediately after the {
    const afterBrace = value.slice(offset + match.length);

    // Check if this is a valid Terraform reference (starts with known prefix)
    const isValidReference =
      terraformResourcePrefixes.length > 0 && terraformResourcePrefixes.some((prefix) => afterBrace.startsWith(prefix));

    // Check if this is a Terraform function call (e.g., replace(...), join(...), etc.)
    const isFunctionCall = afterBrace.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(/) !== null;

    if ((isValidReference || isFunctionCall) && dollars.length === 1) {
      // Single $ with valid prefix - preserve as-is
      return match;
    }

    // Double all $ characters
    // NOTE: In JS String.replace with string replacement, $$ produces single $
    // So to output $$, the replacement string must be $$$$
    return dollars.replace(/\$/g, '$$$$') + '{';
  });

  // Escape all % characters before { by doubling them
  // This handles: %{ → %%{, %%{ → %%%%{, %%%{ → %%%%%%{, etc.
  // Terraform interprets %% as literal %, so %%%%{ outputs %%{ literally
  escaped = escaped.replace(/(%+)\{/g, (_, percents) => percents.replace(/%/g, '%%') + '{');

  return escaped;
}
