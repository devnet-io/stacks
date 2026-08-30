import type {
  CapabilityExport,
  CapabilityRequirement,
  ContextPath,
  Guidance,
  StackComponent,
  StackManifest,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const PORTABLE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function validateContextPath(value: unknown, at: string, errors: string[]): value is ContextPath {
  if (!isRecord(value)) {
    errors.push(`${at} must be an object.`);
    return false;
  }
  if (!isNonEmptyString(value.path)) errors.push(`${at}.path must be a non-empty string.`);
  if (value.strength !== undefined && !["required", "preferred", "reference"].includes(String(value.strength))) {
    errors.push(`${at}.strength must be required, preferred, or reference.`);
  }
  if (value.priority !== undefined && (typeof value.priority !== "number" || !Number.isFinite(value.priority))) {
    errors.push(`${at}.priority must be a finite number.`);
  }
  if (value.tags !== undefined && (!Array.isArray(value.tags) || value.tags.some((tag) => !isNonEmptyString(tag)))) {
    errors.push(`${at}.tags must be an array of non-empty strings.`);
  }
  return true;
}

function validateGuidance(value: unknown, at: string, errors: string[]): value is Guidance {
  const valid = validateContextPath(value, at, errors);
  if (isRecord(value) && value.appliesTo !== undefined) {
    if (!Array.isArray(value.appliesTo) || value.appliesTo.some((item) => !isNonEmptyString(item))) {
      errors.push(`${at}.appliesTo must be an array of non-empty capability names.`);
    }
  }
  return valid;
}

function validateExport(value: unknown, at: string, errors: string[]): value is CapabilityExport {
  if (!isRecord(value)) {
    errors.push(`${at} must be an object.`);
    return false;
  }
  if (!isNonEmptyString(value.capability)) errors.push(`${at}.capability must be a non-empty string.`);
  if (value.context !== undefined) {
    if (!Array.isArray(value.context)) errors.push(`${at}.context must be an array.`);
    else value.context.forEach((item, index) => validateContextPath(item, `${at}.context[${index}]`, errors));
  }
  return true;
}

function validateRequirement(value: unknown, at: string, errors: string[]): value is CapabilityRequirement {
  if (!isRecord(value)) {
    errors.push(`${at} must be an object.`);
    return false;
  }
  if (!isNonEmptyString(value.capability)) errors.push(`${at}.capability must be a non-empty string.`);
  if (value.from !== undefined && !isNonEmptyString(value.from)) errors.push(`${at}.from must be a non-empty string.`);
  if (value.optional !== undefined && typeof value.optional !== "boolean") errors.push(`${at}.optional must be boolean.`);
  return true;
}

function validateComponent(value: unknown, index: number, errors: string[]): value is StackComponent {
  const at = `components[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${at} must be an object.`);
    return false;
  }
  if (!isNonEmptyString(value.id)) errors.push(`${at}.id must be a non-empty string.`);
  else if (!PORTABLE_NAME.test(value.id)) errors.push(`${at}.id must contain only letters, numbers, dots, underscores, and hyphens.`);
  if (!isRecord(value.source)) {
    errors.push(`${at}.source must be an object.`);
  } else if (value.source.type === "path") {
    if (!isNonEmptyString(value.source.path)) errors.push(`${at}.source.path must be a non-empty string.`);
  } else if (value.source.type === "git") {
    if (!isNonEmptyString(value.source.url)) errors.push(`${at}.source.url must be a non-empty string.`);
    if (value.source.ref !== undefined && !isNonEmptyString(value.source.ref)) errors.push(`${at}.source.ref must be a non-empty string.`);
    if (value.source.checkout !== undefined && !isNonEmptyString(value.source.checkout)) errors.push(`${at}.source.checkout must be a non-empty string.`);
  } else {
    errors.push(`${at}.source.type must be path or git.`);
  }
  if (value.access !== undefined && !["read-only", "read-write"].includes(String(value.access))) {
    errors.push(`${at}.access must be read-only or read-write.`);
  }
  if (value.provides !== undefined) {
    if (!Array.isArray(value.provides)) errors.push(`${at}.provides must be an array.`);
    else value.provides.forEach((item, itemIndex) => validateExport(item, `${at}.provides[${itemIndex}]`, errors));
  }
  if (value.consumes !== undefined) {
    if (!Array.isArray(value.consumes)) errors.push(`${at}.consumes must be an array.`);
    else value.consumes.forEach((item, itemIndex) => validateRequirement(item, `${at}.consumes[${itemIndex}]`, errors));
  }
  if (value.dependsOn !== undefined && (!Array.isArray(value.dependsOn) || value.dependsOn.some((item) => !isNonEmptyString(item)))) {
    errors.push(`${at}.dependsOn must be an array of component IDs.`);
  }
  if (value.guidance !== undefined) {
    if (!Array.isArray(value.guidance)) errors.push(`${at}.guidance must be an array.`);
    else value.guidance.forEach((item, itemIndex) => validateGuidance(item, `${at}.guidance[${itemIndex}]`, errors));
  }
  return true;
}

export function validateManifest(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["Manifest must be an object."] };

  if (value.apiVersion !== "stacks.dev/v0alpha1") errors.push("apiVersion must be stacks.dev/v0alpha1.");
  if (value.kind !== "Stack") errors.push("kind must be Stack.");

  if (!isRecord(value.metadata)) errors.push("metadata must be an object.");
  else {
    if (!isNonEmptyString(value.metadata.id)) errors.push("metadata.id must be a non-empty stable identifier.");
    if (!isNonEmptyString(value.metadata.namespace)) errors.push("metadata.namespace must be a non-empty string.");
    else if (!PORTABLE_NAME.test(value.metadata.namespace)) errors.push("metadata.namespace must contain only letters, numbers, dots, underscores, and hyphens.");
    if (!isNonEmptyString(value.metadata.name)) errors.push("metadata.name must be a non-empty string.");
    else if (!PORTABLE_NAME.test(value.metadata.name)) errors.push("metadata.name must contain only letters, numbers, dots, underscores, and hyphens.");
  }

  if (!Array.isArray(value.components)) errors.push("components must be an array.");
  else value.components.forEach((component, index) => validateComponent(component, index, errors));

  if (isRecord(value.context) && value.context.always !== undefined) {
    if (!Array.isArray(value.context.always)) errors.push("context.always must be an array.");
    else value.context.always.forEach((item, index) => validateContextPath(item, `context.always[${index}]`, errors));
  }

  if (Array.isArray(value.components)) {
    const ids = value.components
      .map((component) => (isRecord(component) && isNonEmptyString(component.id) ? component.id : undefined))
      .filter((id): id is string => id !== undefined);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    for (const duplicate of new Set(duplicates)) errors.push(`Duplicate component id: ${duplicate}.`);

    const idSet = new Set(ids);
    for (const [index, component] of value.components.entries()) {
      if (!isRecord(component)) continue;
      if (Array.isArray(component.dependsOn)) {
        for (const dependency of component.dependsOn) {
          if (typeof dependency === "string" && !idSet.has(dependency)) {
            errors.push(`components[${index}].dependsOn references unknown component ${dependency}.`);
          }
        }
      }
      if (Array.isArray(component.consumes)) {
        for (const [requirementIndex, requirement] of component.consumes.entries()) {
          if (isRecord(requirement) && typeof requirement.from === "string" && !idSet.has(requirement.from)) {
            errors.push(`components[${index}].consumes[${requirementIndex}].from references unknown component ${requirement.from}.`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidManifest(value: unknown): asserts value is StackManifest {
  const result = validateManifest(value);
  if (!result.valid) throw new Error(`Invalid Stack manifest:\n- ${result.errors.join("\n- ")}`);
}
