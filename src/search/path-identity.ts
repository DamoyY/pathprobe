import process from "node:process";

const caseInsensitive = process.platform === "win32";
export function pathKey(value: string): string {
  return caseInsensitive ? value.toLowerCase() : value;
}
export function uniquePaths(values: Iterable<string>): string[] {
  const paths = new Map<string, string>();
  for (const value of values) {
    paths.set(pathKey(value), value);
  }
  return [...paths.values()];
}
