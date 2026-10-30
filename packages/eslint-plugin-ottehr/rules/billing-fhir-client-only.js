// @ts-check
'use strict';

/**
 * Billing zambdas read and write only billing-tagged resources, through createBillingClient
 * (packages/zambdas/src/billing/shared.ts). That scoping is client-side SDK config over one M2M token,
 * so nothing server-side backs it up: a clinical or unscoped client in billing code silently sees, and
 * writes, the wrong resources.
 *
 * This rule reports each place billing code gets any other FHIR client, so a justified exception is
 * disabled where the client is made, one call at a time:
 *
 *   // eslint-disable-next-line ottehr/billing-fhir-client-only -- reads the clinical encounter
 *   const clinicalOystehr = createClinicalOystehrClient(m2mToken, secrets);
 *
 * It reports every use of a non-billing client factory (a call, or passing it on), however the factory
 * was imported (named, aliased, through a namespace) or declared; every `new` of the SDK client; and
 * every wrapTaskHandler call that doesn't choose its client, since it defaults to the clinical one.
 */

/**
 * @typedef {import('@typescript-eslint/utils').TSESTree.Node} Node
 * @typedef {import('@typescript-eslint/utils').TSESTree.MemberExpression} MemberExpression
 * @typedef {import('@typescript-eslint/utils').TSESTree.CallExpressionArgument} CallExpressionArgument
 * @typedef {import('@typescript-eslint/utils').TSESLint.Scope.Variable} Variable
 * @typedef {'clinicalClient' | 'unscopedClient' | 'sdkClient' | 'taskHandlerClient'} MessageId
 */

/** @type {ReadonlyMap<string, MessageId>} the factories that build a client not scoped to billing */
const NON_BILLING_FACTORIES = new Map([
  ['createClinicalOystehrClient', 'clinicalClient'],
  ['createOystehrClient', 'clinicalClient'],
  ['createEraReadClient', 'unscopedClient'],
]);
const SDK_MODULE = '@oystehr/sdk';
const TASK_HANDLER = 'wrapTaskHandler';
const TASK_HANDLER_CLIENT_OPTION = 'createClient';

/** @type {import('@typescript-eslint/utils').TSESLint.RuleModule<MessageId>} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Billing zambdas get FHIR clients only from createBillingClient',
    },
    schema: [],
    messages: {
      clinicalClient:
        '{{name}} creates a clinical client: it reads and writes only untagged resources. Billing zambdas use createBillingClient (src/billing/shared.ts). If this really needs clinical data, disable this line and say why.',
      unscopedClient:
        '{{name}} creates an unscoped client: it reads untagged and billing resources alike and writes untagged ones. Only code that must see resources before they are tagged needs it; otherwise use createBillingClient (src/billing/shared.ts). If it is really needed here, disable this line and say why.',
      sdkClient:
        'Billing zambdas get FHIR clients from createBillingClient (src/billing/shared.ts), not new {{name}}. If this really needs its own client, disable this line and say why.',
      taskHandlerClient: 'wrapTaskHandler defaults to the clinical client: pass { createClient: createBillingClient }.',
    },
  },
  defaultOptions: [],
  create(context) {
    const { sourceCode } = context;

    /**
     * @param {Node} node
     * @param {string} name the factory's own name, which an alias or namespace access may not show
     */
    function reportFactoryUse(node, name) {
      const messageId = NON_BILLING_FACTORIES.get(name);
      if (messageId) context.report({ node, messageId, data: { name } });
    }

    /**
     * @param {Variable} variable a binding to a non-billing client factory
     * @param {string} name the factory's own name
     */
    function checkFactoryBinding(variable, name) {
      for (const { identifier } of variable.references) {
        if (isTypeQuery(identifier) || identifier.parent?.type === 'ExportSpecifier') continue;
        reportFactoryUse(identifier, name);
      }
    }

    /** @param {Variable} variable a binding to the SDK client class */
    function checkSdkBinding(variable) {
      for (const { identifier } of variable.references) {
        const { parent } = identifier;
        if (parent?.type === 'NewExpression' && parent.callee === identifier) {
          context.report({ node: parent, messageId: 'sdkClient', data: { name: identifier.name } });
        }
      }
    }

    /** @param {Node} callee a reference to wrapTaskHandler */
    function checkTaskHandlerCall(callee) {
      const { parent } = callee;
      if (parent?.type !== 'CallExpression' || parent.callee !== callee) return;
      if (!choosesClient(parent.arguments[2])) context.report({ node: callee, messageId: 'taskHandlerClient' });
    }

    /** @param {Variable} variable a binding to a module namespace (`import * as helpers`) */
    function checkNamespaceBinding(variable) {
      for (const { identifier } of variable.references) {
        const member = identifier.parent;
        if (member?.type !== 'MemberExpression' || member.object !== identifier) continue;
        const name = staticPropertyName(member);
        if (name === TASK_HANDLER) checkTaskHandlerCall(member);
        else if (name) reportFactoryUse(member, name);
      }
    }

    /** @param {Node} node */
    function declaredVariable(node) {
      return sourceCode.getDeclaredVariables(node)[0];
    }

    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') return;
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier' && specifier.importKind === 'type') continue;
          const variable = declaredVariable(specifier);
          if (!variable) continue;

          if (specifier.type === 'ImportNamespaceSpecifier') {
            checkNamespaceBinding(variable);
            continue;
          }
          const importedName =
            specifier.type === 'ImportDefaultSpecifier'
              ? 'default'
              : specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value;
          if (node.source.value === SDK_MODULE && importedName === 'default') {
            checkSdkBinding(variable);
          } else if (importedName === TASK_HANDLER) {
            for (const { identifier } of variable.references) checkTaskHandlerCall(identifier);
          } else if (NON_BILLING_FACTORIES.has(importedName)) {
            checkFactoryBinding(variable, importedName);
          }
        }
      },

      // The module that declares a factory: a call there makes the client just the same.
      FunctionDeclaration(node) {
        if (node.id && NON_BILLING_FACTORIES.has(node.id.name)) {
          const variable = sourceCode.getDeclaredVariables(node).find((v) => v.name === node.id?.name);
          if (variable) checkFactoryBinding(variable, variable.name);
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && NON_BILLING_FACTORIES.has(node.id.name)) {
          const variable = declaredVariable(node);
          if (variable) checkFactoryBinding(variable, variable.name);
        }
      },
    };
  },
};

/**
 * Whether wrapTaskHandler's options name a createClient, so the call chooses its client.
 * @param {CallExpressionArgument | undefined} options
 */
function choosesClient(options) {
  return (
    options?.type === 'ObjectExpression' &&
    options.properties.some(
      (property) =>
        property.type === 'Property' &&
        !property.computed &&
        (property.key.type === 'Identifier' ? property.key.name : property.key.value) === TASK_HANDLER_CLIENT_OPTION
    )
  );
}

/** @param {MemberExpression} member */
function staticPropertyName(member) {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (member.computed && member.property.type === 'Literal' && typeof member.property.value === 'string') {
    return member.property.value;
  }
  return undefined;
}

/**
 * `typeof createEraReadClient` in a type names the factory without making a client.
 * @param {Node} identifier
 */
function isTypeQuery(identifier) {
  /** @type {Node | undefined} */
  let node = identifier.parent;
  while (node?.type === 'TSQualifiedName') node = node.parent;
  return node?.type === 'TSTypeQuery';
}
