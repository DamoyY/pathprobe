# pathprobe

`pathprobe` 用于从自然语言、日志、错误信息或其他文本中找出真实存在于文件系统中的文件和目录路径。

它支持显式路径、相对路径、带环境变量的路径、被引号包裹的路径，以及更宽松的文本片段匹配；还可以遵循 `.gitignore` 等忽略规则。

## 使用

```ts
import { findExistingPaths } from "pathprobe";

const matches = await findExistingPaths(
  "配置文件位于 ./config/settings.json，请检查后再启动。",
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
    path: "/project/config/settings.json",
    position: {
      start: 6,
      end: 28,
    },
  },
];
```

其中：

- `kind`：路径类型，`file` 或 `directory`
- `path`：解析后的绝对路径
- `position`：原始文本中匹配内容的起止位置

## API

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

### `text`

需要搜索的文本。

### `level`

搜索强度，从 `1` 开始。级别越高，识别范围越宽，同时可能需要更多文件系统扫描。

可以通过导出的 `MAX_LEVEL` 获取当前支持的最高级别：

```ts
import { MAX_LEVEL } from "pathprobe";
```

### `directories`

用于解析相对路径的搜索根目录，可指定多个：

```ts
const matches = await findExistingPaths(text, 2, [process.cwd(), "/another/project"]);
```

相对路径会分别基于这些目录进行解析。

### `variables`

可选的变量值：

```ts
await findExistingPaths("打开 $PROJECT_ROOT/src/index.ts", 2, [process.cwd()], {
  PROJECT_ROOT: "/workspace/project",
});
```

支持多种常见变量写法。

未在 `variables` 中提供的变量会尝试从 `process.env` 获取。

### `respectIgnore`

是否遵循忽略规则。

启用后，搜索目录中的 `.gitignore` 等规则可以阻止被忽略的路径出现在结果中。

### `searchHidden`

是否搜索隐藏文件和隐藏目录。

## 类型

主要类型均可直接导入：

```ts
import type { PathKind, PathMatch, PathPosition, SearchLevel, Variables } from "pathprobe";
```

`pathprobe` 不负责读取文件内容；它只负责从文本中发现路径、解析路径并确认对应文件或目录是否存在。
