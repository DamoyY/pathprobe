# pathprobe

`pathprobe` 是一个用于从自然语言文本中提取路径的工具。

它可以识别绝对路径、相对路径、引号中的路径、带环境变量的路径，以及形如 `file.ts:12:8` 的行列位置。

## 基本用法

```ts
import { findExistingPaths } from "pathprobe";

const matches = await findExistingPaths(
  `
  请检查 src/index.ts:12，
  以及 "./src/types.ts"。
  `,
  2,
  [process.cwd()],
);

console.log(matches);
```

返回结果类似：

```ts
[
  {
    kind: "file",
    path: "/project/src/index.ts",
    position: {
      start: 8,
      end: 23,
    },
    location: {
      line: 12,
    },
  },
];
```

## API

### `findExistingPaths()`

```ts
findExistingPaths(
  text,
  level,
  directories,
  variables?,
  respectIgnore?,
  searchHidden?,
): Promise<PathMatch[]>
```

参数：

- `text`：需要扫描的文本。
- `level`：搜索级别。
- `directories`：用于解析相对路径的搜索目录，可以提供多个目录。
- `variables`：可选的变量映射，用于展开文本中的环境变量。
- `respectIgnore`：是否遵循 `.gitignore` 等忽略规则。
- `searchHidden`：是否允许搜索隐藏文件和隐藏目录。

### 搜索级别

`level` 从 `1` 开始，最高值可通过 `MAX_LEVEL` 获取。

级别越高，识别范围越宽，同时可能需要更多文件系统扫描。

```ts
import { MAX_LEVEL } from "pathprobe";
```

## 支持的路径形式

例如：

```text
/src/index.ts
./src/index.ts
../config/settings.js
C:\project\src\index.ts
\\server\share\file.txt
file:///tmp/example.txt
"src/types.ts"
src/index.ts:15
src/index.ts:15:8
```

也支持多种变量写法，例如：

```text
$HOME/project/file.txt
${HOME}/project/file.txt
$env:HOME/project/file.txt
%USERPROFILE%\project\file.txt
{{ HOME }}/project/file.txt
${{ env.HOME }}/project/file.txt
```

可以通过 `variables` 显式提供变量：

```ts
const matches = await findExistingPaths("$PROJECT_ROOT/src/index.ts", 2, [process.cwd()], {
  PROJECT_ROOT: "/workspace/project",
});
```

没有在 `variables` 中提供的变量会继续尝试从 `process.env` 中读取。

## 返回值

每个匹配项的类型为：

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

其中：

- `path` 是解析并标准化后的实际路径。
- `kind` 表示目标是文件还是目录。
- `position` 表示原始文本中路径所在的字符范围，`end` 为结束位置的后一位。
- `location` 保存路径后附带的行号、列号信息。

## Ignore 与隐藏文件

默认行为由库配置决定，也可以在调用时覆盖：

```ts
await findExistingPaths(
  text,
  2,
  [process.cwd()],
  {},
  true, // respectIgnore
  false, // searchHidden
);
```

启用 `respectIgnore` 后，搜索会考虑 Git ignore 和配置的 ignore 文件。

关闭 `searchHidden` 后，诸如 `.git/`、`.cache/` 之类的隐藏路径不会参与匹配。

## TypeScript

库同时导出常用类型：

```ts
import type {
  PathKind,
  PathLocation,
  PathMatch,
  PathPosition,
  SearchLevel,
  Variables,
} from "pathprobe";
```

`pathprobe` 面向 Node.js 文件系统使用，并采用 ESM/NodeNext 模块方式。
