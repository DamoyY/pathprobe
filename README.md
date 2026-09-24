Language Option / 语言选项：

**English** | [简体中文](config/locales/zh-CN/README.md)

---

# pathprobe

`pathprobe` finds references to existing files and directories inside natural-language text.

It can recognize absolute and relative paths, quoted paths, variable-based paths, and less explicit path references, then verify that the referenced filesystem entries actually exist.

## Usage

```ts
import { findExistingPaths, MAX_LEVEL } from "pathprobe";

const matches = await findExistingPaths({
  text: "Please check src/index.ts and ./config/settings.json",
  directories: [process.cwd()],
  level: 2,
});

console.log(matches);
```

Example result:

```ts
[
  {
    kind: "file",
    path: "/project/src/index.ts",
    position: { start: 13, end: 25 },
  },
];
```

## API

```ts
findExistingPaths(options): Promise<PathMatch[]>
```

Main options:

```ts
{
  text: string;
  directories: readonly string[];
  level: number;
  variables?: Record<string, string>;
  respectIgnore?: boolean;
  searchHidden?: boolean;
}
```

`text` is the text to inspect.

`directories` contains the search roots used to resolve relative paths. At least one directory is required.

`level` controls how aggressively paths are detected and must be between `1` and `MAX_LEVEL`. Higher levels can recognize less explicit references but may require more filesystem searching.

`variables` supplies values for references such as `$HOME/project`, `${WORKSPACE}/src`, or `%TEMP%\file.txt`.

`respectIgnore` controls whether ignore rules such as `.gitignore` are respected.

`searchHidden` controls whether hidden files and directories are searchable.

Optional defaults are determined by the package configuration.

## Search levels

Lower levels are useful when the input already contains clearly formatted paths.

```ts
level: 1;
```

Handles obvious references such as `/tmp/file.txt`, `C:\work\file.ts`, `./src/index.ts`, and `"docs/My File.md"`.

```ts
level: 2;
```

Also detects additional path-like tokens and variable-based paths.

`level >= 3` progressively considers longer text spans, which is useful for paths containing spaces.

`MAX_LEVEL` performs the broadest search and can recognize names using the actual contents of the configured search directories.

When in doubt, start with level `1` or `2` and increase it only when broader matching is needed.

## Line and column locations

A path may include a source location:

```text
src/index.ts:20
src/index.ts:20:8
src/index.ts#L20
```

The result can then contain:

```ts
location: { line: 20, column: 8 }
```

## Variables

```ts
await findExistingPaths({
  text: "$ROOT/src/index.ts",
  directories: [process.cwd()],
  level: 2,
  variables: {
    ROOT: "/project",
  },
});
```

Variables not supplied explicitly may also be resolved from the current process environment.

## Result

Each `PathMatch` has the following shape:

```ts
{
  kind: "file" | "directory";
  path: string;
  position: { start: number; end: number };
  location?: { line: number; column?: number };
}
```

`position` refers to the matching range in the original input `text`.

Only paths that exist and satisfy the active hidden-file and ignore policies are returned.

## Platforms

Common POSIX and Windows path formats are supported.

On Windows, drive paths, resolvable UNC paths, and Windows hidden attributes are also supported.
