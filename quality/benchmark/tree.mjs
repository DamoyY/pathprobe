import { mkdir, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import pLimit from "p-limit";

function noisePath(index) {
  const shard = String(index % 128).padStart(3, "0");
  switch (index % 6) {
    case 0: {
      return `noise/node_modules/package-${index % 256}/dist/chunk-${index}.js`;
    }
    case 1: {
      return `noise/workspaces/team-${index % 32}/project-${index % 128}/src/module-${index}.ts`;
    }
    case 2: {
      return `noise/cache/${shard}/asset-${index}.bin`;
    }
    case 3: {
      return `noise/docs/${shard}/meeting note ${index}.md`;
    }
    case 4: {
      return `noise/unicode/项目-${index % 64}/资料-${index}.txt`;
    }
    default: {
      return `noise/build/${shard}/artifact-${index}`;
    }
  }
}
export async function createFileTree(root, files, noiseFiles, writeConcurrency) {
  const relativePaths = [
      ...files,
      ...Array.from({ length: noiseFiles }, (_, index) => noisePath(index)),
    ],
    directories = new Set(relativePaths.map((relative) => nodePath.dirname(relative)));
  await Promise.all(
    [...directories].map((relative) => mkdir(nodePath.join(root, relative), { recursive: true })),
  );
  const limit = pLimit(writeConcurrency);
  await limit.map(relativePaths, (relative) => writeFile(nodePath.join(root, relative), relative));
  return {
    directories: directories.size,
    files: relativePaths.length,
  };
}
