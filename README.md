# pathprobe

`pathprobe` 用于从一段文本中找出其中提到的、真实存在于文件系统中的文件或目录路径。

## 安装

```bash
npm install pathprobe
```

## 基本用法

```ts
import { findExistingPaths } from "pathprobe";

const matches = await findExistingPaths({
  text: `
  请检查 src/index.ts:12
  以及 "./config/settings.json"
  `,
  level: 2,
  directories: [process.cwd()],
});

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
      end: 20,
    },
    location: {
      line: 12,
    },
  },
];
```

## API

```ts
findExistingPaths({
  text,
  level,
  directories,
  variables?,
  respectIgnore?,
  searchHidden?,
}): Promise<PathMatch[]>
```

参数说明：

- `text`：需要扫描的文本。
- `level`：搜索强度，值越高，识别越宽松。
- `directories`：解析相对路径时使用的搜索目录。
- `variables`：可选的变量值。
- `respectIgnore`：是否遵守 `.gitignore` 等忽略规则。
- `searchHidden`：是否搜索隐藏文件和目录。

`directories` 中的目录必须真实存在。

## 搜索级别

级别越高，能够识别更多自然文本中的路径，也可能产生更多文件系统检查。

可通过：

```ts
import { MAX_LEVEL } from "pathprobe";
```

获取当前最高级别。

## 路径位置

路径后可以附带行号或行列号：

```text
src/index.ts:42
src/index.ts:42:8
```

匹配结果会包含：

```ts
{
  location: {
    line: 42,
    column: 8,
  }
}
```

同时，`position.start` 和 `position.end` 表示路径在原始文本中的字符范围。

## 变量展开

可以在文本中使用常见的变量表达式：

```text
$HOME/project/file.txt
${HOME}/project/file.txt
$env:HOME/project/file.txt
%HOME%\project\file.txt
{{ HOME }}/project/file.txt
${{ env.HOME }}/project/file.txt
```

也可以自行提供变量：

```ts
await findExistingPaths({
  text: "$PROJECT_ROOT/src/index.ts",
  level: 2,
  directories: [process.cwd()],
  variables: {
    PROJECT_ROOT: "/projects/demo",
  },
});
```

未显式提供的变量会尝试从 `process.env` 中读取。

## Windows / UNC

在 Windows 上，`pathprobe` 可以处理：

```text
\\server\share\project\file.txt
```

对于映射到本机盘符的网络共享，以及本机管理共享（如 `\\localhost\C$\...`），会尽可能转换成可由本机文件系统验证的路径。

无法映射为本地可访问路径的 UNC 地址会被忽略。

## 返回类型

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

`pathprobe` 只返回经过文件系统验证、当前真实存在的文件或目录。
