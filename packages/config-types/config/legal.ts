import z from 'zod';
import { DisplayTextSchema, LinkDefSchema, TextWithLinkComposition } from './display-text';

/**
 * TextWithLinkCompositionSchema - Validates arrays of display text and links
 * Used for legal text blocks that contain embedded links
 */
export const TextWithLinkCompositionSchema: z.ZodType<TextWithLinkComposition> = z.array(
  z.union([DisplayTextSchema, LinkDefSchema])
);

/**
 * LegalConfigSchema - Configuration for legal text throughout the application
 * Maps location keys to arrays of text/link compositions
 *
 * Common location keys:
 * - REVIEW_PAGE: Legal text shown on the booking review page
 * - PAPERWORK_REVIEW_PAGE: Legal text shown on paperwork review
 */
export const LegalConfigSchema = z.record(z.string(), TextWithLinkCompositionSchema);

export type LegalConfig = z.infer<typeof LegalConfigSchema>;
