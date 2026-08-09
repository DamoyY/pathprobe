import type { PathMatch } from "../types.js";

export function removeContainedMatches(matches: readonly PathMatch[]): PathMatch[] {
  const ordered = matches
    .map((match, index) => ({ index, match }))
    .toSorted(
      ({ match: left }, { match: right }) =>
        left.position.start - right.position.start || right.position.end - left.position.end,
    );
  const kept = new Set<number>();
  let maxEndBeforeStart = -1;
  let groupStart = -1;
  let maxEndInGroup = -1;
  for (const { index, match } of ordered) {
    const { start, end } = match.position;
    if (start !== groupStart) {
      maxEndBeforeStart = Math.max(maxEndBeforeStart, maxEndInGroup);
      groupStart = start;
      maxEndInGroup = -1;
    }
    if (maxEndBeforeStart < end && maxEndInGroup <= end) {
      kept.add(index);
    }
    maxEndInGroup = Math.max(maxEndInGroup, end);
  }
  return matches.filter((_, index) => kept.has(index));
}
