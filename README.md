Language Option / 语言选项 / Opción de idioma：

**English** | [简体中文](./config/locales/zh-CN/README.md) | [Español](./config/locales/ES/README.md)

---

# pathprobe

`pathprobe` extracts path-like references from text and returns the references that resolve to existing files or directories.

It accepts one or more search directories, supports several path syntaxes, and reports the original text position of each match.

## Usage

```ts
import { findExistingPaths, MAX_LEVEL } from "pathprobe";

const matches = await findExistingPaths({
  text: "Open src/index.ts and ./package.json.",
  directories: [process.cwd()],
  level: 2,
});

console.log(matches);
```

`findExistingPaths()` returns a `Promise<PathMatch[]>`.

## Options

```ts
findExistingPaths({
  text,
  directories,
  level,
  variables,
  respectIgnore,
  searchHidden,
});
```

`text` is the text to inspect.

`directories` is a non-empty array of directories used to resolve relative paths.

`level` is an integer from `1` through `MAX_LEVEL`.

`variables` is an optional object containing string values used when expanding variable references.

`respectIgnore` controls whether ignore files are respected.

`searchHidden` controls whether hidden files and directories are searchable.

## Search levels

Level `1` recognizes explicit paths and quoted text that resolves to an existing path.

Level `2` additionally recognizes path-like tokens and paths containing supported variable references.

Levels `3` and above additionally examine multi-word text spans. Higher levels allow progressively larger spans.

`MAX_LEVEL` enables the broadest text-span search and filesystem inventory matching.

The available maximum can be read directly from the package:

```ts
import { MAX_LEVEL } from "pathprobe";
```

## Relative and absolute paths

Relative paths are resolved against every directory supplied in `directories`.

```ts
const matches = await findExistingPaths({
  text: "src/index.ts",
  directories: ["/workspace/project-a", "/workspace/project-b"],
  level: 2,
});
```

Absolute paths are resolved directly.

Supported input can include normal platform paths, `file://` URLs, home-relative paths such as `~/file.txt`, and supported variable-based paths.

## Variables

Variable references can use values supplied through `variables` or values available in the process environment.

```ts
const matches = await findExistingPaths({
  text: "$PROJECT_ROOT/src/index.ts",
  directories: [process.cwd()],
  level: 2,
  variables: {
    PROJECT_ROOT: "/workspace/example",
  },
});
```

Supported forms include `$NAME`, `${NAME}`, `%NAME%`, `!NAME!`, `$env:NAME`, `{{NAME}}`, `${{ NAME }}`, `$(NAME)`, and `@NAME@`.

Home-relative paths use `HOME` or `USERPROFILE` when available.

## Line and column locations

Path references may include a source location suffix.

Examples include:

```text
src/index.ts:12
src/index.ts:12:4
src/index.ts#L12
```

When present, the parsed location is returned separately from the filesystem path.

## Result format

Each result has the following shape:

```ts
interface PathMatch {
  kind: "file" | "directory";
  path: string;
  position: {
    start: number;
    end: number;
  };
  location?: {
    line: number;
    column?: number;
  };
}
```

`path` is the resolved existing filesystem path.

`kind` identifies whether the path is a file or directory.

`position` contains the start and end offsets of the reference in the original input text.

`location` contains an optional line and column extracted from the reference.

## Hidden and ignored paths

`searchHidden` defaults to the package configuration and determines whether hidden paths are included.

On Unix-like systems, dot-prefixed path segments are treated as hidden.

On Windows, filesystem hidden attributes are taken into account.

`respectIgnore` determines whether configured ignore files, including Git ignore rules, affect matches inside the search directories.

Both values can be set explicitly:

```ts
const matches = await findExistingPaths({
  text,
  directories: [process.cwd()],
  level: MAX_LEVEL,
  respectIgnore: true,
  searchHidden: false,
});
```

## Windows paths

Windows drive paths and UNC references are accepted as path candidates.

Mapped network paths and local administrative shares may be represented as corresponding drive-based paths when they can be resolved locally.

Path matching on Windows follows case-insensitive filesystem path semantics.

## Exports

The package exports:

```ts
findExistingPaths
MAX_LEVEL

FindExistingPathsOptions
PathKind
PathLocation
PathMatch
PathPosition
SearchLevel
Variables
```

Invalid option types, invalid search levels, or invalid search directories cause the returned operation to reject with an error.