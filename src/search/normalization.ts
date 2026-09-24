import process from "node:process";

export interface NormalizedSource {
  offsets?: (number | undefined)[];
  value: string;
}
export function normalizeSource(text: string): NormalizedSource {
  if (process.platform !== "win32") {
    return { value: text };
  }
  const value = text.toLowerCase();
  if (value.length === text.length) {
    return { value };
  }
  const offsets: (number | undefined)[] = [0];
  let normalizedOffset = 0,
    sourceOffset = 0;
  for (const character of text) {
    const normalizedLength = character.toLowerCase().length;
    offsets[normalizedOffset] = sourceOffset;
    for (let index = 1; index < normalizedLength; index += 1) {
      offsets[normalizedOffset + index] = undefined;
    }
    normalizedOffset += normalizedLength;
    sourceOffset += character.length;
    offsets[normalizedOffset] = sourceOffset;
  }
  if (normalizedOffset !== value.length) {
    throw new Error("Unicode case normalization produced an unmappable source");
  }
  return { offsets, value };
}
export function originalOffset(source: NormalizedSource, offset: number): number | undefined {
  return source.offsets === undefined ? offset : source.offsets[offset];
}
