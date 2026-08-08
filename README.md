# pathprobe

`pathprobe` 用于从自然语言、日志、报错信息或其他文本中识别路径。

它支持绝对路径、相对路径、`file://` URL、环境变量形式的路径，以及较宽松的文本路径匹配，并可选择遵循 `.gitignore` 等忽略规则。

## 使用

```ts
import { findExistingPaths } from "pathprobe";

const matches = await findExistingPaths(
  `
  Please check src/index.ts and "./src/types.ts".
  The config may also be under $HOME/project/config.json.
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
      end: 28,
    },
  },
];
```

`position` 表示原始文本中匹配内容的起止位置。

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

参数：

- `text`：需要扫描的文本。
- `level`：搜索级别，范围为 `1` 到 `MAX_LEVEL`。
- `directories`：允许搜索的根目录。相对路径只会在这些目录中解析。
- `variables`：可选的变量值，例如 `{ PROJECT_ROOT: "/work/app" }`。
- `respectIgnore`：是否遵循 Git ignore 等忽略规则。
- `searchHidden`：是否搜索隐藏文件和目录。

## 搜索级别

搜索级别越高，识别范围越宽。
较高等级通常能找到更多路径，但也会增加文件系统扫描工作量。

## 变量路径

支持多种常见变量写法，例如：

```text
$HOME/project/file.txt
${HOME}/project/file.txt
${{ env.HOME }}/project/file.txt
{{ PROJECT_ROOT }}/src
%USERPROFILE%\project
$env:USERPROFILE\project
```

也可以显式传入变量：

```ts
await findExistingPaths("$PROJECT_ROOT/src/index.ts", 2, ["/workspace"], {
  PROJECT_ROOT: "/workspace/project",
});
```

未在 `variables` 中提供的变量会尝试从 `process.env` 获取。

## 安全范围

`pathprobe` 只返回位于指定 `directories` 范围内的路径。

例如：

```ts
await findExistingPaths("../../etc/passwd", 2, ["/workspace/project"]);
```

即使目标文件存在，只要解析结果超出了允许的根目录，也不会作为匹配结果返回。

## 返回类型

```ts
interface PathMatch {
  kind: "file" | "directory";
  path: string;
  position: {
    start: number;
    end: number;
  };
}
```
