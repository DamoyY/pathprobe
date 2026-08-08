export function pathKey(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
export function countPaths(paths) {
  const counts = new Map();
  for (const value of paths) {
    const key = pathKey(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
