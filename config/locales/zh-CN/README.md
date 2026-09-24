语言选项 / Language Option：

[English](README.md) | **简体中文**

---

# pathprobe

`pathprobe` 用于从自然语言文本中找出真实存在的文件或目录路径。

它可以识别绝对路径、相对路径、带引号的路径、环境变量形式的路径，以及文本中较不明显的路径引用，并验证目标是否真实存在。

## 使用

```ts
import { findExistingPaths, MAX_LEVEL } from "pathprobe";

const matches = await findExistingPaths({
  text: "请检查 src/index.ts 和 ./config/settings.json",
  directories: [process.cwd()],
  level: 2,
});

console.log(matches);
```

返回结果示例：

```ts
[
  {
    kind: "file",
    path: "/project/src/index.ts",
    position: { start: 3, end: 15 },
  },
];
```

## API

```ts
findExistingPaths(options): Promise<PathMatch[]>
```

主要选项：

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

`text` 是需要分析的文本。

`directories` 是解析相对路径和执行搜索时使用的根目录。至少需要提供一个目录。

`level` 控制搜索范围，取值为 `1` 到 `MAX_LEVEL`。级别越高，越倾向于从不明显的文本中识别路径，同时搜索成本也可能增加。

`variables` 可提供变量值，用于解析诸如 `$HOME/project`、`${WORKSPACE}/src`、`%TEMP%\file.txt` 等路径。

`respectIgnore` 控制是否遵守 `.gitignore` 等忽略规则。

`searchHidden` 控制是否搜索隐藏文件和目录。

默认值由包的配置决定。

## 搜索级别

较低级别适合格式明确的路径，速度也更可预测。

```ts
level: 1;
```

适用于 `/tmp/file.txt`、`C:\work\file.ts`、`./src/index.ts` 或 `"docs/My File.md"` 等明显路径。

```ts
level: 2;
```

还会尝试识别更多类似路径的文本和变量路径。

`level >= 3` 会进一步尝试从连续文本片段中解析带空格的路径。

`MAX_LEVEL` 启用最完整的搜索，包括根据搜索目录中的实际文件和目录识别文本里的路径名称。

如果不确定，从 `1` 或 `2` 开始，仅在需要更宽松的匹配时提高级别。

## 行号和列号

路径后可以带位置：

```text
src/index.ts:20
src/index.ts:20:8
src/index.ts#L20
```

匹配结果会包含：

```ts
location: { line: 20, column: 8 }
```

## 变量

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

未在 `variables` 中提供的变量也可能从当前进程环境变量中解析。

## 返回值

每个 `PathMatch` 包含：

```ts
{
  kind: "file" | "directory";
  path: string;
  position: { start: number; end: number };
  location?: { line: number; column?: number };
}
```

`position` 是原始输入 `text` 中匹配内容的位置。

只返回实际存在且符合当前隐藏文件、忽略规则等搜索条件的路径。

## 平台

支持常见的 POSIX 和 Windows 路径格式。

在 Windows 上还支持盘符、可解析的 UNC 路径以及 Windows 隐藏属性。
