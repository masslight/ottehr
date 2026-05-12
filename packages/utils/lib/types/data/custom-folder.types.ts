import { z } from 'zod';
import { Secrets } from '../../secrets';

export type CustomFolderDefinition = {
  internalName: string;
  displayName: string;
};

// Sentinel prefix for a folder id that refers to a custom folder which exists
// in the catalog but does not yet have a per-patient List resource. The upload
// zambda creates the List lazily on first upload.
export const SYNTHETIC_FOLDER_ID_PREFIX = 'synthetic:';

export const makeSyntheticFolderId = (internalName: string): string => `${SYNTHETIC_FOLDER_ID_PREFIX}${internalName}`;

export const isSyntheticFolderId = (folderId: string | undefined | null): boolean =>
  !!folderId && folderId.startsWith(SYNTHETIC_FOLDER_ID_PREFIX);

export const parseSyntheticFolderId = (folderId: string | undefined | null): string | undefined =>
  isSyntheticFolderId(folderId) ? folderId!.slice(SYNTHETIC_FOLDER_ID_PREFIX.length) : undefined;

export const FOLDER_DISPLAY_NAME_REGEX = /^[a-zA-Z0-9+!\-_'().@$ ]+$/;
export const FOLDER_DISPLAY_NAME_MAX_LENGTH = 60;
export const FOLDER_DISPLAY_NAME_INVALID_CHARS_MSG =
  "must contain only letters, numbers, spaces, or + ! - _ ' ( ) . @ $";

const folderDisplayName = z
  .string()
  .trim()
  .min(1, `must be between 1 and ${FOLDER_DISPLAY_NAME_MAX_LENGTH} characters`)
  .max(FOLDER_DISPLAY_NAME_MAX_LENGTH, `must be between 1 and ${FOLDER_DISPLAY_NAME_MAX_LENGTH} characters`)
  .regex(FOLDER_DISPLAY_NAME_REGEX, FOLDER_DISPLAY_NAME_INVALID_CHARS_MSG);

const folderInternalName = z.string().trim().min(1);

export const CreateCustomFolderInputSchema = z.object({
  folderName: folderDisplayName,
});
export type CreateCustomFolderInput = z.infer<typeof CreateCustomFolderInputSchema>;

export const CreateCustomFolderInputValidatedSchema = CreateCustomFolderInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
  userToken: z.string(),
});
export type CreateCustomFolderInputValidated = z.infer<typeof CreateCustomFolderInputValidatedSchema>;

export type CreateCustomFolderOutput = CustomFolderDefinition;

export const RenameCustomFolderInputSchema = z.object({
  internalName: folderInternalName,
  newName: folderDisplayName,
});
export type RenameCustomFolderInput = z.infer<typeof RenameCustomFolderInputSchema>;

export const RenameCustomFolderInputValidatedSchema = RenameCustomFolderInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
  userToken: z.string(),
});
export type RenameCustomFolderInputValidated = z.infer<typeof RenameCustomFolderInputValidatedSchema>;

export type RenameCustomFolderOutput = CustomFolderDefinition;

export const DeleteCustomFolderInputSchema = z.object({
  internalName: folderInternalName,
});
export type DeleteCustomFolderInput = z.infer<typeof DeleteCustomFolderInputSchema>;

export const DeleteCustomFolderInputValidatedSchema = DeleteCustomFolderInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
  userToken: z.string(),
});
export type DeleteCustomFolderInputValidated = z.infer<typeof DeleteCustomFolderInputValidatedSchema>;

export type DeleteCustomFolderOutput = {
  internalName: string;
};
