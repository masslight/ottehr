import { describe, expect, it } from 'vitest';
import { escapeTerraformTemplateSyntax } from './escape-terraform';

describe('escapeTerraformTemplateSyntax', () => {
  describe('basic escaping', () => {
    it('should escape %{ to %%{', () => {
      expect(escapeTerraformTemplateSyntax('%{foo}')).toBe('%%{foo}');
    });

    it('should escape ${ to $${ when not a terraform reference', () => {
      expect(escapeTerraformTemplateSyntax('${MY_VAR}')).toBe('$${MY_VAR}');
    });

    it('should return unchanged string without special characters', () => {
      expect(escapeTerraformTemplateSyntax('hello world')).toBe('hello world');
    });

    it('should handle empty string', () => {
      expect(escapeTerraformTemplateSyntax('')).toBe('');
    });
  });

  describe('terraform reference preservation', () => {
    it('should preserve ${oystehr_m2m.*} references', () => {
      const input = '${oystehr_m2m.ZAMBDAS_ADMIN.client_id}';
      expect(escapeTerraformTemplateSyntax(input)).toBe(input);
    });

    it('should preserve ${oystehr_secret.*} references', () => {
      const input = '${oystehr_secret.MY_SECRET.value}';
      expect(escapeTerraformTemplateSyntax(input)).toBe(input);
    });

    it('should preserve ${oystehr_fhir_resource.*} references', () => {
      const input = '${oystehr_fhir_resource.LOCATION.id}';
      expect(escapeTerraformTemplateSyntax(input)).toBe(input);
    });

    it('should preserve ${oystehr_application.*} references', () => {
      const input = '${oystehr_application.EHR_APP.id}';
      expect(escapeTerraformTemplateSyntax(input)).toBe(input);
    });

    it('should preserve ${oystehr_zambda.*} references', () => {
      const input = '${oystehr_zambda.MY_ZAMBDA.id}';
      expect(escapeTerraformTemplateSyntax(input)).toBe(input);
    });

    it('should preserve ${oystehr_role.*} references', () => {
      const input = '${oystehr_role.ADMIN_ROLE.id}';
      expect(escapeTerraformTemplateSyntax(input)).toBe(input);
    });
  });

  describe('mixed content', () => {
    it('should escape %{ but preserve oystehr_ references in same string', () => {
      const input = 'prefix %{directive} ${oystehr_m2m.client.id} suffix';
      expect(escapeTerraformTemplateSyntax(input)).toBe('prefix %%{directive} ${oystehr_m2m.client.id} suffix');
    });

    it('should escape non-terraform ${ but preserve oystehr_ references', () => {
      const input = '${ENV_VAR} and ${oystehr_secret.name.value}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('$${ENV_VAR} and ${oystehr_secret.name.value}');
    });

    it('should handle multiple occurrences', () => {
      const input = '%{a} %{b} ${c} ${oystehr_m2m.x.y}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('%%{a} %%{b} $${c} ${oystehr_m2m.x.y}');
    });
  });

  describe('edge cases - the original bug case', () => {
    it('should escape the exact password that caused the CI failure', () => {
      const input = '$%{sIcr8zCNH&>v|1H;{Jne-,l#vT/#zoj6a3Uaw|,OH}ek&L&Uw;m1C;t{DI<bT';
      const result = escapeTerraformTemplateSyntax(input);
      // %{ should be escaped to %%{ (Terraform interprets %% as literal %)
      expect(result).toBe('$%%{sIcr8zCNH&>v|1H;{Jne-,l#vT/#zoj6a3Uaw|,OH}ek&L&Uw;m1C;t{DI<bT');
    });

    it('should handle password with both ${ and %{ sequences', () => {
      const input = 'pass${word}%{secret}123';
      expect(escapeTerraformTemplateSyntax(input)).toBe('pass$${word}%%{secret}123');
    });
  });

  describe('edge cases - potential bugs', () => {
    it('should correctly escape %%{ by doubling each %', () => {
      // Each % before { must be doubled: %%{ → %%%%{
      // Terraform: %%%% = %%, then { = literal %%{
      const input = '%%{already-escaped}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('%%%%{already-escaped}');
    });

    it('should correctly escape %%%{ by doubling each %', () => {
      // %%%{ → %%%%%%{ (6 percent signs)
      const input = '%%%{test}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('%%%%%%{test}');
    });

    it('should correctly escape $${ by doubling each $', () => {
      // Each $ before { must be doubled: $${ → $$$${
      // Terraform: $$$$ = $$, then { = literal $${
      const input = '$${already-escaped}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('$$$${already-escaped}');
    });

    it('should correctly escape $$${ by doubling each $', () => {
      // $$${ → $$$$$${  (6 dollar signs)
      const input = '$$${test}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('$$$$$${test}');
    });

    it('should handle $ without following {', () => {
      const input = 'cost is $100';
      expect(escapeTerraformTemplateSyntax(input)).toBe('cost is $100');
    });

    it('should handle % without following {', () => {
      const input = '100% complete';
      expect(escapeTerraformTemplateSyntax(input)).toBe('100% complete');
    });

    it('should handle { without preceding $ or %', () => {
      const input = 'object: {key: value}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('object: {key: value}');
    });

    it('should handle consecutive special sequences', () => {
      const input = '${${nested}}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('$${$${nested}}');
    });

    it('should handle %{ at the very start', () => {
      const input = '%{if condition}value%{endif}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('%%{if condition}value%%{endif}');
    });

    it('should handle ${ at the very end (unclosed)', () => {
      const input = 'trailing ${';
      expect(escapeTerraformTemplateSyntax(input)).toBe('trailing $${');
    });

    it('should handle %{ at the very end (unclosed)', () => {
      const input = 'trailing %{';
      expect(escapeTerraformTemplateSyntax(input)).toBe('trailing %%{');
    });

    it('should handle string with only ${', () => {
      const input = '${';
      expect(escapeTerraformTemplateSyntax(input)).toBe('$${');
    });

    it('should handle string with only %{', () => {
      const input = '%{';
      expect(escapeTerraformTemplateSyntax(input)).toBe('%%{');
    });
  });

  describe('unicode and special characters', () => {
    it('should handle unicode characters', () => {
      const input = '${emoji: 🎉} and %{emoji: 🚀}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('$${emoji: 🎉} and %%{emoji: 🚀}');
    });

    it('should handle newlines', () => {
      const input = '${var}\n%{directive}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('$${var}\n%%{directive}');
    });

    it('should handle tabs', () => {
      const input = '${var}\t%{directive}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('$${var}\t%%{directive}');
    });
  });

  describe('custom terraform prefixes', () => {
    it('should allow custom terraform resource prefixes', () => {
      const input = '${custom_resource.name.field}';
      expect(escapeTerraformTemplateSyntax(input, ['custom_'])).toBe(input);
    });

    it('should allow multiple custom prefixes', () => {
      const input = '${oystehr_m2m.x} ${aws_s3.y} ${other.z}';
      expect(escapeTerraformTemplateSyntax(input, ['oystehr_', 'aws_'])).toBe(
        '${oystehr_m2m.x} ${aws_s3.y} $${other.z}'
      );
    });

    it('should escape all ${ when empty prefix array provided', () => {
      const input = '${oystehr_m2m.x} ${other.y}';
      expect(escapeTerraformTemplateSyntax(input, [])).toBe('$${oystehr_m2m.x} $${other.y}');
    });

    it('should handle prefix with regex special characters', () => {
      // Edge case: if someone has a prefix with regex special chars
      const input = '${test.value}';
      expect(escapeTerraformTemplateSyntax(input, ['test.'])).toBe(input);
    });
  });

  describe('real-world terraform scenarios', () => {
    it('should handle terraform resource reference in FHIR path', () => {
      const input =
        '${oystehr_fhir_resource.DEFAULT_BILLING_RESOURCE.type}/${oystehr_fhir_resource.DEFAULT_BILLING_RESOURCE.id}';
      expect(escapeTerraformTemplateSyntax(input)).toBe(input);
    });

    it('should handle terraform replace function', () => {
      // This is a real terraform function call that should be preserved
      // But since it doesnt start with oystehr_, it will be escaped
      // This is expected - such functions should be in the terraform config directly
      const input = '${replace("value", " ", "_")}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('$${replace("value", " ", "_")}');
    });

    it('should handle complex secret values with all special chars', () => {
      const input = 'P@ss${word}%{123}!#$%^&*()_+{}|:"<>?';
      const result = escapeTerraformTemplateSyntax(input);
      expect(result).toBe('P@ss$${word}%%{123}!#$%^&*()_+{}|:"<>?');
    });

    it('should handle base64-like strings', () => {
      const input = 'c29tZSBzZWNyZXQgdmFsdWU=';
      expect(escapeTerraformTemplateSyntax(input)).toBe(input);
    });

    it('should handle JWT-like tokens', () => {
      const input =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
      expect(escapeTerraformTemplateSyntax(input)).toBe(input);
    });
  });

  describe('systematic escaping - all $ and % counts', () => {
    it('should correctly escape any number of $ before {', () => {
      // Each $ must be doubled to escape it in Terraform
      expect(escapeTerraformTemplateSyntax('${')).toBe('$${');
      expect(escapeTerraformTemplateSyntax('$${')).toBe('$$$${');
      expect(escapeTerraformTemplateSyntax('$$${')).toBe('$$$$$${');
      expect(escapeTerraformTemplateSyntax('$$$${')).toBe('$$$$$$$${');
      expect(escapeTerraformTemplateSyntax('$$$$${')).toBe('$$$$$$$$$${');
    });

    it('should correctly escape any number of % before {', () => {
      // Each % must be doubled to escape it in Terraform
      expect(escapeTerraformTemplateSyntax('%{')).toBe('%%{');
      expect(escapeTerraformTemplateSyntax('%%{')).toBe('%%%%{');
      expect(escapeTerraformTemplateSyntax('%%%{')).toBe('%%%%%%{');
      expect(escapeTerraformTemplateSyntax('%%%%{')).toBe('%%%%%%%%{');
      expect(escapeTerraformTemplateSyntax('%%%%%{')).toBe('%%%%%%%%%%{');
    });

    it('should only escape $ and % directly before {, not standalone braces', () => {
      // Multiple { after the sequence - only the first { triggers escaping
      expect(escapeTerraformTemplateSyntax('$${{{{{')).toBe('$$$${{{{{');
      expect(escapeTerraformTemplateSyntax('%%{{{{{')).toBe('%%%%{{{{{');
    });

    it('should handle mixed $ and % sequences', () => {
      // $%{ - $ is not before {, only %{ is escaped
      expect(escapeTerraformTemplateSyntax('$%{')).toBe('$%%{');
      // %${ - % is not before {, only ${ is escaped
      expect(escapeTerraformTemplateSyntax('%${')).toBe('%$${');
      // Only the character directly before { matters
      expect(escapeTerraformTemplateSyntax('$$$%{')).toBe('$$$%%{');
      expect(escapeTerraformTemplateSyntax('%%%${')).toBe('%%%$${');
    });
  });

  describe('complex real-world patterns', () => {
    it('should handle chaotic mix of $, %, and { characters', () => {
      const input = '$${{{$$$$${{{{%{%{%{%%%{{{{%%%%{{';
      const output = escapeTerraformTemplateSyntax(input);
      // $${ → $$$${ (2→4), $$$$${ → $$$$$$$$$${ (5→10)
      // %{ → %%{ (1→2) x3, %%%{ → %%%%%%{ (3→6), %%%%{ → %%%%%%%%{ (4→8)
      expect(output).toBe('$$$${{{$$$$$$$$$${{{{%%{%%{%%{%%%%%%{{{{%%%%%%%%{{');
    });

    it('should handle mix with oystehr_ references interspersed', () => {
      const input = '$${oystehr_*}${{{$$${oystehr_*}$$${{{{%{%{%{%%%{{{{%%%%{{';
      const output = escapeTerraformTemplateSyntax(input);
      // $${oystehr_*} → $$$${oystehr_*} (2 dollars, >1 so escaped)
      // ${ before {{{ → $${ (not oystehr_, escaped)
      // $$${oystehr_*} → $$$$$${oystehr_*} (3 dollars, >1 so escaped)
      // $$${ before {{{{ → $$$$$${ (not oystehr_, escaped)
      expect(output).toBe('$$$${oystehr_*}$${{{$$$$$${oystehr_*}$$$$$${{{{%%{%%{%%{%%%%%%{{{{%%%%%%%%{{');
    });
  });

  describe('regression tests', () => {
    it('should correctly handle the oystehr_ prefix at different positions', () => {
      // oystehr_ right after ${
      expect(escapeTerraformTemplateSyntax('${oystehr_test}')).toBe('${oystehr_test}');

      // Something before oystehr_
      expect(escapeTerraformTemplateSyntax('${not_oystehr_test}')).toBe('$${not_oystehr_test}');

      // oystehr without underscore
      expect(escapeTerraformTemplateSyntax('${oystehr}')).toBe('$${oystehr}');

      // Partial match
      expect(escapeTerraformTemplateSyntax('${oystehr}')).toBe('$${oystehr}');
    });

    it('should handle adjacent terraform sequences', () => {
      const input = '${oystehr_a.x}${oystehr_b.y}';
      expect(escapeTerraformTemplateSyntax(input)).toBe(input);
    });

    it('should handle terraform reference followed by %{', () => {
      const input = '${oystehr_m2m.id}%{if true}';
      expect(escapeTerraformTemplateSyntax(input)).toBe('${oystehr_m2m.id}%%{if true}');
    });
  });
});
