import type { Variables } from "./types.js";

const nameSource = String.raw`[A-Za-z_][A-Za-z0-9_.-]*`;
export const variableReferenceSource = String.raw`(?:\$\{\{\s*(?:(?:env|vars|variables)[.:])?${nameSource}\s*\}\}|\{\{\s*${nameSource}\s*\}\}|\$\{(?:env[.:])?${nameSource}\}|\$env:${nameSource}|\$[A-Za-z_][A-Za-z0-9_]*|%${nameSource}%|!${nameSource}!|\$\(\s*${nameSource}\s*\)|@${nameSource}@)`;
const expressionPatterns = [
  new RegExp(String.raw`\$\{\{\s*(?:(?:env|vars|variables)[.:])?(${nameSource})\s*\}\}`, "giu"),
  new RegExp(String.raw`\{\{\s*(${nameSource})\s*\}\}`, "gu"),
  new RegExp(String.raw`\$\{(?:env[.:])?(${nameSource})\}`, "giu"),
  new RegExp(String.raw`\$env:(${nameSource})`, "giu"),
  new RegExp(String.raw`\$(?!env:)([A-Za-z_][A-Za-z0-9_]*)`, "giu"),
  new RegExp(String.raw`%(${nameSource})%`, "gu"),
  new RegExp(String.raw`!(${nameSource})!`, "gu"),
  new RegExp(String.raw`\$\(\s*(${nameSource})\s*\)`, "gu"),
  new RegExp(String.raw`@(${nameSource})@`, "gu"),
];
function resolveVariable(name: string, variables: Variables): string | undefined {
  const direct = variables[name] ?? process.env[name];
  if (direct !== undefined) {
    return direct;
  }
  const unscoped = /^(?:env|vars|variables)[.:](.+)$/iu.exec(name)?.[1];
  return unscoped === undefined ? undefined : (variables[unscoped] ?? process.env[unscoped]);
}
export function expandVariables(value: string, variables: Variables): string {
  let result = value;
  for (const pattern of expressionPatterns) {
    result = result.replace(pattern, (match, name: string) => {
      const replacement = resolveVariable(name, variables);
      return replacement === undefined ? match : replacement;
    });
  }
  return result;
}
