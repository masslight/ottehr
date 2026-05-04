export type CustomFolderDefinition = {
  internalName: string;
  displayName: string;
};

export type CreateCustomFolderInput = {
  folderName: string;
};

export type CreateCustomFolderOutput = CustomFolderDefinition;

export type RenameCustomFolderInput = {
  internalName: string;
  newName: string;
};

export type RenameCustomFolderOutput = CustomFolderDefinition;
