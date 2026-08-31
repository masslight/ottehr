import z from 'zod';

/**
 * DisplayText - Text content that can be either a literal string or a reference to a key path
 * Used throughout config for text that may need to be resolved from a translations/content store
 */
export const DisplayTextSchema = z
  .object({
    nodeType: z.literal('DisplayText'),
    literal: z.string().optional(),
    keyPath: z.string().optional(),
  })
  .refine((data) => Boolean(data.literal) || Boolean(data.keyPath), {
    message: 'Either literal or keyPath must be provided',
  });

export type DisplayTextDef = z.infer<typeof DisplayTextSchema>;

/**
 * LinkDef - Definition for a hyperlink with text and optional metadata
 */
export const LinkDefSchema = z.object({
  nodeType: z.literal('Link'),
  url: z.string(),
  textToDisplay: DisplayTextSchema,
  testId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type LinkDef = z.infer<typeof LinkDefSchema>;

/**
 * TextWithLinkComposition - Array of display text and links that compose a text block
 * Used for legal text, consent forms, and other content with embedded links
 */
export type TextWithLinkComposition = Array<DisplayTextDef | LinkDef>;
