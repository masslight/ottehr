export const fillReferences = (template: any, references: string[]): any => {
  let stringinfiedTemplate = JSON.stringify(template);
  references.forEach((reference) => {
    const [resourceType] = reference.split('/');
    // const resourceType regex in template looks like: {{resourceType.upperCased()_REF}}
    stringinfiedTemplate = stringinfiedTemplate.replace(
      new RegExp(`{{${resourceType.toUpperCase()}_REF}}`, 'g'),
      reference
    );
  });
  return JSON.parse(stringinfiedTemplate);
};
