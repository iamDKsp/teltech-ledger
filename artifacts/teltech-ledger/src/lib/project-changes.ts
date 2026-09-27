export interface EditableProject {
  name: string;
  color: string;
  icon?: string | null;
}

export function getProjectChanges(original: EditableProject, edited: EditableProject): Partial<EditableProject> {
  const changes: Partial<EditableProject> = {};
  const name = edited.name.trim();

  if (name !== original.name) changes.name = name;
  if (edited.color !== original.color) changes.color = edited.color;
  if ((edited.icon ?? null) !== (original.icon ?? null)) changes.icon = edited.icon ?? null;

  return changes;
}
