// @ts-check
'use strict';

const path = require('node:path');
const ts = require('typescript');
const { ESLintUtils } = require('@typescript-eslint/utils');

/**
 * Billing zambdas read and write only billing-tagged resources, through the client createBillingClient
 * makes (packages/zambdas/src/billing/shared.ts). That scoping is client-side SDK config over one M2M
 * token, so nothing server-side backs it up: any other client in billing code silently sees, and
 * writes, the wrong resources.
 *
 * So what a client can see is part of its type. createBillingClient returns the branded BillingOystehr,
 * and the other clients billing code may need are branded too (ClinicalOystehr, UnscopedOystehr), each
 * by the one function that makes it. This rule uses TypeScript's types to check every SDK client billing
 * code touches, however it was made:
 * - the billing client is used freely;
 * - getting another branded client takes a justified exception, on the call that returns it (or, where
 *   a function returns the client as its own, on the calls to that function). The client's type carries
 *   the exception from there, so using it or handing it on takes none:
 *
 *     // eslint-disable-next-line ottehr/billing-fhir-client-only -- checks the clinical encounter exists
 *     const clinicalOystehr = createClinicalOystehrClient(m2mToken, secrets);
 *
 * - a client whose type doesn't say what it can see (`new Oystehr`, a plain Oystehr from any helper, a
 *   value typed any) is reported wherever it is used for FHIR or handed to other code;
 * - asserting a branded type, and passing a value typed any where a client is expected, are reported,
 *   since either lets any client pass as a branded one;
 * - wrapTaskHandler marks the Task through the client createClient makes (the clinical one by default)
 *   and hands it to the handler, so it is checked like a call that returns that client.
 */

/**
 * @typedef {import('@typescript-eslint/utils').TSESTree.Node} Node
 * @typedef {import('@typescript-eslint/utils').TSESTree.CallExpression} CallExpression
 * @typedef {import('@typescript-eslint/utils').TSESTree.NewExpression} NewExpression
 * @typedef {import('@typescript-eslint/utils').TSESTree.MemberExpression} MemberExpression
 * @typedef {import('@typescript-eslint/utils').TSESTree.Property} Property
 * @typedef {'fhirUse' | 'untypedFhirUse' | 'clientHandOff' | 'untypedClient' | 'clientAcquired' | 'forgedClient' | 'taskHandlerClient'} MessageId
 * @typedef {{ type: string; file: string }} ClientType a branded client type, and the absolute path of the module that declares it
 * @typedef {[{ billingClient: ClientType; otherScopedClients?: ClientType[] }]} Options
 * @typedef {'billing' | 'branded' | 'unbranded' | 'any'} ClientScope
 */

// The SDK's client, recognised by its own `fhir` property so subclasses and intersections count too.
const SDK_PACKAGE_PATH = `${path.sep}@oystehr${path.sep}sdk${path.sep}`;
const TASK_HANDLER = 'wrapTaskHandler';

/** @type {ClientScope[]} */
const LEAST_SCOPED_FIRST = ['unbranded', 'any', 'branded', 'billing'];

const CLIENT_TYPE_SCHEMA = {
  type: 'object',
  properties: { type: { type: 'string' }, file: { type: 'string' } },
  required: ['type', 'file'],
  additionalProperties: false,
};

/** @type {import('@typescript-eslint/utils').TSESLint.RuleModule<MessageId, Options>} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Billing zambdas use FHIR only through the billing client, or a branded one got under a justified exception',
    },
    schema: [
      {
        type: 'object',
        properties: {
          billingClient: CLIENT_TYPE_SCHEMA,
          // The other branded clients billing code may get under a justified exception.
          otherScopedClients: { type: 'array', items: CLIENT_TYPE_SCHEMA },
        },
        required: ['billingClient'],
        additionalProperties: false,
      },
    ],
    messages: {
      fhirUse: "FHIR through a client whose type doesn't say what it can see ({{client}}). {{remedy}}",
      untypedFhirUse: "FHIR through a client typed any, which can't be shown to be billing-scoped. {{remedy}}",
      clientHandOff:
        "This hands a client whose type doesn't say what it can see ({{client}}) to code that can read and write through it. {{remedy}}",
      untypedClient:
        "A value typed any where a client is expected ({{client}}) can't be shown to be that client: get it from the function that makes it.",
      clientAcquired:
        "This gets a client that isn't billing-scoped ({{client}}). If billing code really needs it, disable this line and say why; using the client from there takes no further exception.",
      forgedClient:
        'Only the function that makes a {{client}} gives that type: asserting it would let any client pass as one.',
      taskHandlerClient:
        "wrapTaskHandler marks the Task through, and hands the handler, a client that isn't billing-scoped ({{client}}). Pass { createClient: createBillingClient }, or if the handler really needs this client, disable this line and say why.",
    },
  },
  defaultOptions: [{ billingClient: { type: 'BillingOystehr', file: '' }, otherScopedClients: [] }],
  create(context) {
    const [{ billingClient, otherScopedClients = [] }] = context.options;
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    /** @type {{ type: string; file: string; scope: ClientScope }[]} */
    const brands = [
      { type: billingClient.type, file: path.resolve(billingClient.file), scope: 'billing' },
      ...otherScopedClients.map(({ type, file }) => ({
        type,
        file: path.resolve(file),
        scope: /** @type {ClientScope} */ ('branded'),
      })),
    ];
    const otherTypes = otherScopedClients.map((client) => client.type).join(' or ');
    const remedy = otherTypes
      ? `Use the billing client, typed ${billingClient.type}; if this really needs another, get one typed ${otherTypes} from the function that makes it, and justify that.`
      : `Use the billing client, typed ${billingClient.type}.`;

    /**
     * Whether a value of this type is an SDK client and, if so, what its type says it can see. Undefined
     * for anything else; a union counts as its least scoped member.
     * @param {import('typescript').Type} type
     * @returns {ClientScope | undefined}
     */
    function clientScope(type) {
      if (type.flags & ts.TypeFlags.Any) return 'any';
      // Flag checks rather than isTypeParameter()/isUnion(), whose type guards narrow Type to never.
      if (type.flags & ts.TypeFlags.TypeParameter) {
        const constraint = checker.getBaseConstraintOfType(type);
        return constraint ? clientScope(constraint) : undefined;
      }
      if (type.flags & ts.TypeFlags.Union) {
        const scopes = /** @type {import('typescript').UnionType} */ (type).types.map(clientScope);
        return LEAST_SCOPED_FIRST.find((scope) => scopes.includes(scope));
      }
      const fhir = type.getProperty('fhir');
      if (!fhir?.declarations?.some((d) => d.getSourceFile().fileName.includes(SDK_PACKAGE_PATH))) return undefined;
      return brandOf(type)?.scope ?? 'unbranded';
    }

    /**
     * The brand a client type carries: one of the configured types, declared in its configured module.
     * @param {import('typescript').Type} type
     */
    function brandOf(type) {
      for (const part of type.isIntersection() ? type.types : [type]) {
        const symbol = part.getSymbol();
        const brand =
          symbol &&
          brands.find(
            ({ type: name, file }) =>
              symbol.getName() === name &&
              !!symbol.declarations?.some((d) => path.resolve(d.getSourceFile().fileName) === file)
          );
        if (brand) return brand;
      }
      return undefined;
    }

    /**
     * @param {Node} node where the FHIR use starts
     * @param {Node} client the expression or pattern holding the client
     */
    function checkFhirUse(node, client) {
      const type = services.getTypeAtLocation(client);
      const scope = clientScope(type);
      if (scope === 'unbranded') {
        context.report({ node, messageId: 'fhirUse', data: { client: checker.typeToString(type), remedy } });
      } else if (scope === 'any') {
        context.report({ node, messageId: 'untypedFhirUse', data: { remedy } });
      }
    }

    /** @param {Node | null | undefined} node an expression whose value goes to other code */
    function checkHandOff(node) {
      if (!node || node.type === 'SpreadElement') return;
      const type = services.getTypeAtLocation(node);
      const scope = clientScope(type);
      if (scope === 'unbranded') {
        context.report({ node, messageId: 'clientHandOff', data: { client: checker.typeToString(type), remedy } });
      } else if (scope === 'any') {
        checkUntypedClient(node);
      }
    }

    /** @param {Node} node an expression typed any */
    function checkUntypedClient(node) {
      const tsNode = /** @type {import('typescript').Expression} */ (services.esTreeNodeToTSNodeMap.get(node));
      const expected = checker.getContextualType(tsNode);
      const scope = expected && clientScope(expected);
      if (expected && scope && scope !== 'any') {
        context.report({ node, messageId: 'untypedClient', data: { client: checker.typeToString(expected) } });
      }
    }

    /** @param {CallExpression | NewExpression} node */
    function checkAcquired(node) {
      if (returnedToCaller(node)) return;
      const type = services.getTypeAtLocation(node);
      const client = checker.getAwaitedType(type) ?? type;
      if (clientScope(client) === 'branded') {
        context.report({ node, messageId: 'clientAcquired', data: { client: checker.typeToString(client) } });
      }
    }

    /** @param {CallExpression} call */
    function checkTaskHandler(call) {
      const client = taskHandlerClient(call);
      if (!client || clientScope(client) !== 'billing') {
        context.report({
          node: call.callee,
          messageId: 'taskHandlerClient',
          data: { client: client ? checker.typeToString(client) : 'of a type the rule cannot tell' },
        });
      }
    }

    /**
     * The client wrapTaskHandler hands this call's handler: its handler parameter's second parameter, in
     * the overload the call resolves to.
     * @param {CallExpression} call
     */
    function taskHandlerClient(call) {
      const signature = checker.getResolvedSignature(services.esTreeNodeToTSNodeMap.get(call));
      const handler = signature?.getParameters()[1];
      const client = handler && checker.getTypeOfSymbol(handler).getCallSignatures()[0]?.getParameters()[1];
      return client && checker.getTypeOfSymbol(client);
    }

    /** @param {CallExpression} call */
    function callsTaskHandler(call) {
      let symbol = services.getSymbolAtLocation(call.callee);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      return symbol?.getName() === TASK_HANDLER;
    }

    /**
     * @param {Node} node
     * @param {import('typescript').Type} asserted
     * @param {import('typescript').Type} [operand] the asserted value's own type; none for a type predicate
     */
    function checkAssertion(node, asserted, operand) {
      const scope = clientScope(asserted);
      if (scope !== 'billing' && scope !== 'branded') return;
      if (!operand || operand.flags & ts.TypeFlags.Any || !checker.isTypeAssignableTo(operand, asserted)) {
        context.report({ node, messageId: 'forgedClient', data: { client: checker.typeToString(asserted) } });
      }
    }

    return {
      MemberExpression(node) {
        if (memberName(node) === 'fhir') checkFhirUse(node, node.object);
      },
      ObjectPattern(node) {
        if (node.properties.some((property) => property.type === 'Property' && keyName(property) === 'fhir')) {
          checkFhirUse(node, node);
        }
      },
      CallExpression(node) {
        node.arguments.forEach(checkHandOff);
        if (callsTaskHandler(node)) checkTaskHandler(node);
        else checkAcquired(node);
      },
      NewExpression(node) {
        node.arguments.forEach(checkHandOff);
        checkAcquired(node);
      },
      'ObjectExpression > Property'(/** @type {Property} */ node) {
        checkHandOff(node.value);
      },
      ArrayExpression(node) {
        node.elements.forEach(checkHandOff);
      },
      ReturnStatement(node) {
        checkHandOff(node.argument);
      },
      ArrowFunctionExpression(node) {
        if (node.expression) checkHandOff(node.body);
      },
      AssignmentExpression(node) {
        checkHandOff(node.right);
      },
      VariableDeclarator(node) {
        if (node.init && clientScope(services.getTypeAtLocation(node.init)) === 'any') checkUntypedClient(node.init);
      },
      'TSAsExpression, TSTypeAssertion'(
        /** @type {import('@typescript-eslint/utils').TSESTree.TSAsExpression} */ node
      ) {
        checkAssertion(node, services.getTypeAtLocation(node), services.getTypeAtLocation(node.expression));
      },
      TSTypePredicate(node) {
        if (node.typeAnnotation) checkAssertion(node, services.getTypeAtLocation(node.typeAnnotation.typeAnnotation));
      },
    };
  },
};

/**
 * Whether the enclosing function returns this value as its own, so its callers are the ones who get it.
 * @param {Node} node
 */
function returnedToCaller(node) {
  let value = node;
  while (value.parent?.type === 'AwaitExpression') value = value.parent;
  const { parent } = value;
  return parent?.type === 'ReturnStatement' || (parent?.type === 'ArrowFunctionExpression' && parent.body === value);
}

/** @param {MemberExpression} member */
function memberName(member) {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (member.computed && member.property.type === 'Literal' && typeof member.property.value === 'string') {
    return member.property.value;
  }
  return undefined;
}

/** @param {Property} property */
function keyName(property) {
  if (!property.computed && property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') return property.key.value;
  return undefined;
}
