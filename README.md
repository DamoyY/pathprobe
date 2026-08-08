# pathprobe

`pathprobe` 用于从自然语言文本中识别并验证真实存在的文件或目录路径。

## 基本用法

```ts
import { findExistingPaths } from "pathprobe";

const matches = await findExistingPaths(
  `
  Please check ./src/index.ts
  and C:\\projects\\demo\\README.md:10:5
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
      start: 16,
      end: 30,
    },
  },
];
```

每个匹配项包含：

- `path`：解析后的绝对路径
- `kind`：`"file"` 或 `"directory"`
- `position`：路径在原始文本中的字符范围
- `location`：可选的行号、列号信息

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

需要扫描的文本。

### `level`

搜索等级。等级越高，识别范围越宽，但需要进行的文件系统搜索也越多。

可通过以下方式获取当前最高等级：

```ts
import { MAX_LEVEL } from "pathprobe";
```

### `directories`

用于解析相对路径的搜索根目录。

```ts
await findExistingPaths(text, 2, [process.cwd(), "/another/project"]);
```

### `variables`

可选的变量值：

```ts
await findExistingPaths("$PROJECT/src/index.ts", 2, [process.cwd()], {
  PROJECT: "/home/user/project",
});
```

支持多种常见写法，例如：

```text
$HOME/project
${HOME}/project
$env:HOME/project
%HOME%\project
!HOME!\project
{{ HOME }}/project
${{ env.HOME }}/project
$(HOME)/project
@HOME@/project
```

未显式提供的变量也会尝试从 `process.env` 中读取。

### `respectIgnore`

是否遵守 Git ignore 规则及配置的 ignore 文件。

默认值由库配置决定。

### `searchHidden`

是否搜索隐藏文件和隐藏目录。

默认值由库配置决定。

## 支持的路径形式

例如：

```text
./src/index.ts
../config/settings.json
~/Documents/test.txt
/usr/local/bin/tool
C:\Users\me\project\README.md
\\localhost\share\file.txt
file:///tmp/example.txt
src/index.ts:42
src/index.ts:42:8
"$HOME/My Project/file.txt"
```

路径只有在文件系统中实际存在时才会出现在最终结果中。

## TypeScript 类型

库同时导出：

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

## 注意事项

在 Windows 上，UNC 路径仅会解析指向本机的共享路径，以避免意外访问远程网络位置。
