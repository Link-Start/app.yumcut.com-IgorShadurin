export type AdminCharacterImportValidationLimits = {
  slugMax: number;
  nameMax: number;
  titleMax: number;
  bioMax: number;
  fileMinBytes: number;
  fileMaxBytes: number;
  allowedImageExtensions: string[];
  allowedImageMimeTypes: string[];
};

export const ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS: AdminCharacterImportValidationLimits = {
  slugMax: 191,
  nameMax: 191,
  titleMax: 191,
  bioMax: 300,
  fileMinBytes: 10 * 1024,
  fileMaxBytes: 10 * 1024 * 1024,
  allowedImageExtensions: ['.webp'],
  allowedImageMimeTypes: ['image/webp'],
};

export type AdminCharacterImportFileInfo = {
  name: string;
  size: number;
  type?: string | null;
};

export type AdminCharacterImportRowValidationInput = {
  slug: string;
  name: string;
  title: string;
  bio?: string | null;
  preparedFile?: AdminCharacterImportFileInfo | null;
  emptyFile?: AdminCharacterImportFileInfo | null;
};

export type AdminCharacterImportIssueField =
  | 'slug'
  | 'name'
  | 'title'
  | 'bio'
  | 'preparedFile'
  | 'emptyFile';

export type AdminCharacterImportIssue = {
  field: AdminCharacterImportIssueField;
  message: string;
};

export type AdminCharacterImportRowValidationResult = {
  issues: AdminCharacterImportIssue[];
  fieldErrors: Partial<Record<AdminCharacterImportIssueField, string>>;
  normalized: {
    slug: string;
    name: string;
    title: string;
    bio: string;
  };
};

function toMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

function validateImageFile(
  file: AdminCharacterImportFileInfo | null | undefined,
  field: 'preparedFile' | 'emptyFile',
  limits: AdminCharacterImportValidationLimits,
  issues: AdminCharacterImportIssue[],
) {
  if (!file) {
    issues.push({ field, message: `${field === 'preparedFile' ? 'prepared' : 'empty'} file is required` });
    return;
  }

  const fileName = (file.name || '').trim();
  if (!fileName) {
    issues.push({ field, message: `${field === 'preparedFile' ? 'prepared' : 'empty'} file name is required` });
  } else {
    const lowerName = fileName.toLowerCase();
    const extAllowed = limits.allowedImageExtensions.some((ext) => lowerName.endsWith(ext.toLowerCase()));
    if (!extAllowed) {
      issues.push({
        field,
        message: `${field === 'preparedFile' ? 'prepared' : 'empty'} file must use ${limits.allowedImageExtensions.join(', ')}`,
      });
    }
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) {
    issues.push({ field, message: `${field === 'preparedFile' ? 'prepared' : 'empty'} file size is invalid` });
  } else {
    if (size < limits.fileMinBytes) {
      issues.push({
        field,
        message: `${field === 'preparedFile' ? 'prepared' : 'empty'} file is too small (min ${Math.floor(limits.fileMinBytes / 1024)}KB)`,
      });
    }
    if (size > limits.fileMaxBytes) {
      issues.push({
        field,
        message: `${field === 'preparedFile' ? 'prepared' : 'empty'} file is too large (max ${toMb(limits.fileMaxBytes)})`,
      });
    }
  }

  const type = (file.type || '').trim().toLowerCase();
  if (type && !limits.allowedImageMimeTypes.includes(type)) {
    issues.push({
      field,
      message: `${field === 'preparedFile' ? 'prepared' : 'empty'} file type must be ${limits.allowedImageMimeTypes.join(', ')}`,
    });
  }
}

export function validateAdminCharacterImportRow(
  input: AdminCharacterImportRowValidationInput,
  limits: AdminCharacterImportValidationLimits = ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS,
): AdminCharacterImportRowValidationResult {
  const slug = (input.slug || '').trim().toLowerCase();
  const name = (input.name || '').trim();
  const title = (input.title || '').trim();
  const bio = (input.bio || '').trim();

  const issues: AdminCharacterImportIssue[] = [];

  if (!slug) {
    issues.push({ field: 'slug', message: 'slug is required' });
  } else {
    if (slug.length > limits.slugMax) {
      issues.push({ field: 'slug', message: `slug must be at most ${limits.slugMax} characters` });
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      issues.push({ field: 'slug', message: 'slug format is invalid' });
    }
  }

  if (!name) {
    issues.push({ field: 'name', message: 'name is required' });
  } else if (name.length > limits.nameMax) {
    issues.push({ field: 'name', message: `name must be at most ${limits.nameMax} characters` });
  }

  if (!title) {
    issues.push({ field: 'title', message: 'title is required' });
  } else if (title.length > limits.titleMax) {
    issues.push({ field: 'title', message: `title must be at most ${limits.titleMax} characters` });
  }

  if (bio.length > limits.bioMax) {
    issues.push({ field: 'bio', message: `short description must be at most ${limits.bioMax} characters (current: ${bio.length})` });
  }

  validateImageFile(input.preparedFile, 'preparedFile', limits, issues);
  validateImageFile(input.emptyFile, 'emptyFile', limits, issues);

  const fieldErrors: Partial<Record<AdminCharacterImportIssueField, string>> = {};
  for (const issue of issues) {
    if (!fieldErrors[issue.field]) {
      fieldErrors[issue.field] = issue.message;
    }
  }

  return {
    issues,
    fieldErrors,
    normalized: {
      slug,
      name,
      title,
      bio,
    },
  };
}
