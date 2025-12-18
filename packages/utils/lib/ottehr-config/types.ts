import z from 'zod';

export const DisplayTextSchema = z
  .object({
    nodeType: z.literal('DisplayText'),
    literal: z.string().optional(),
    keyPath: z.string().optional(),
  })
  .refine((data) => Boolean(data.literal) || Boolean(data.keyPath), {
    message: 'Either literal or keyPath must be provided',
  });

export const LinkDefSchema = z.object({
  nodeType: z.literal('Link'),
  url: z.string(),
  textToDisplay: DisplayTextSchema,
  testId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type DisplayTextDef = z.infer<typeof DisplayTextSchema>;

export type LinkDef = z.infer<typeof LinkDefSchema>;

export type TextWithLinkComposition = Array<DisplayTextDef | LinkDef>;
