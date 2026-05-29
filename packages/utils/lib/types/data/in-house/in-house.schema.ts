import { ProcedureModifier } from 'candidhealth/api/index.js';
import { z } from 'zod';
import { REFLEX_TEST_CONDITION_LANGUAGES } from './in-house.constants';

const nonEmptyString = (message?: string): z.ZodString => z.string().trim().nonempty(message);

const reflexLanguages = Object.values(REFLEX_TEST_CONDITION_LANGUAGES) as [string, ...string[]];

const ReflexLogicSchema = z.object({
  testToRun: z.object({
    testName: nonEmptyString('Test name is required'),
    testCanonicalUrl: nonEmptyString('Canonical URL is required'),
  }),
  triggerAlert: nonEmptyString('Trigger alert is required'),
  condition: z.object({
    description: z.string(),
    language: z.enum(reflexLanguages),
    expression: nonEmptyString('Expression is required'),
  }),
});

const BaseComponentSchema = z.object({
  componentName: nonEmptyString('Test component name required'),
  loincCode: z.array(z.string()).optional(),
  reflexLogic: z
    .union([
      ReflexLogicSchema,
      z.object({
        parentTestUrl: nonEmptyString(),
      }),
    ])
    .optional(),
});

const CodeableConceptComponentSchema = BaseComponentSchema.extend({
  dataType: z.literal('CodeableConcept'),
  valueSet: z
    .array(
      z.object({
        isAbnormal: z.boolean(),
        code: nonEmptyString('Selectable component must have a value'),
        display: nonEmptyString('Selectable component must have a value'),
      })
    )
    .min(1, 'Must contain at least one selectable value'),
  display: z.object({
    type: z.enum(['Radio', 'Select']),
    nullOption: z.boolean(),
  }),
  unit: nonEmptyString('Unit must be at least length 1').optional(),
  quantitativeReference: z.record(z.string()).optional(),
});

const QuantityComponentSchema = BaseComponentSchema.extend({
  dataType: z.literal('Quantity'),
  normalRange: z
    .object({
      low: z.coerce.number(), // coerce since forms somtimes submit as strings, prevents silent validation failures
      high: z.coerce.number(),
      precision: z.coerce.number({ invalid_type_error: 'Please enter a valid number.' }).optional(),
      unit: nonEmptyString('Quantity component must have a unit'),
    })
    .superRefine((val, ctx) => {
      if (val.low >= val.high) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Low must be less than high',
          path: ['low'], // attach error to specific field
        });

        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'High must be greater than low',
          path: ['high'],
        });
      }
    }),
  display: z.object({
    type: z.literal('Numeric'),
    nullOption: z.boolean(),
  }),
});

const StringComponentSchema = BaseComponentSchema.extend({
  dataType: z.literal('string'),
  display: z.object({
    type: z.literal('Free Text'),
    validations: z
      .object({
        format: z
          .object({
            value: z.union([z.string(), z.number()]),
            display: nonEmptyString('Validation display message must be at least 1 character if provided'),
          })
          .optional(),
      })
      .optional(),
  }),
});

const TestItemComponentSchema = z.discriminatedUnion('dataType', [
  CodeableConceptComponentSchema,
  QuantityComponentSchema,
  StringComponentSchema,
]);

const ProcedureModifierEnum = z.enum(Object.values(ProcedureModifier) as [string, ...string[]]);

const CptCodeInHouseLabDefinitionSchema = z.object({
  code: nonEmptyString('CPT Code required'),
  display: nonEmptyString('CPT display must be opulated when provided').optional(),
  modifier: z
    .array(
      z.object({
        code: ProcedureModifierEnum,
        display: nonEmptyString('Modifier display required'),
      })
    )
    .transform((modArray) => (modArray?.length ? modArray : undefined)) // make sure we don't get empty arrays
    .optional(),
});

export const AdminInHouseLabItemDefinitionSchema = z.object({
  name: nonEmptyString('Must include a non-empty name'),
  device: nonEmptyString('Device name must be non-empty if provided')
    .nullable()
    .transform((val) => val ?? undefined) // the FE will pass null if the field is cleared
    .optional(),
  methods: z
    .object({
      manual: z.object({ device: nonEmptyString('Device must be non-empty if provided') }).optional(),
      analyzer: z.object({ device: nonEmptyString('Device must be non-empty if provided') }).optional(),
      machine: z.object({ device: nonEmptyString('Device must be non-empty if provided') }).optional(),
    })
    .optional(),
  cptCode: z.array(CptCodeInHouseLabDefinitionSchema).min(1, 'Definition must contain at least one CPT Code'),
  loincCode: z
    .array(nonEmptyString('LOINC must be non-empty if provided'))
    .min(1, 'At least on LOINC code required when provided')
    .transform((loincArr) => (loincArr?.length ? loincArr : undefined)) // make sure we don't get empty arrays
    .optional(),
  repeatTest: z.boolean(),
  components: z.array(TestItemComponentSchema).min(1, 'Test must contain at least one component'),
  note: nonEmptyString('Note must be non-empty if provided').optional(),
});
