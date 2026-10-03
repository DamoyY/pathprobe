Language Option / 语言选项 / Opción de idioma：

[English](../../../README.md) | **简体中文** | [Español](../ES/README.md)

---

# pathprobe

`pathprobe` 用于从文本中提取路径引用，并返回其中能够解析为现有文件或目录的内容。

它可以使用一个或多个搜索目录解析相对路径，支持多种路径写法，并保留匹配内容在原始文本中的位置。

## 使用方法

```ts
import { findExistingPaths, MAX_LEVEL } from "pathprobe";

const matches = await findExistingPaths({
  text: "打开 src/index.ts 和 ./package.json。",
  directories: [process.cwd()],
  level: 2,
});

console.log(matches);
```

`findExistingPaths()` 返回 `Promise<PathMatch[]>`。

## 参数

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

`text` 是需要检查的文本。

`directories` 是非空目录数组，用于解析相对路径。

`level` 是从 `1` 到 `MAX_LEVEL` 的整数。

`variables` 是可选的字符串键值对象，用于展开文本中的变量引用。

`respectIgnore` 控制搜索时是否遵循忽略文件。

`searchHidden` 控制隐藏文件和隐藏目录是否参与搜索。

## 搜索级别

级别 `1` 识别显式路径，以及能够解析为现有路径的引号内容。

级别 `2` 额外识别具有路径形式的文本片段和包含受支持变量引用的路径。

级别 `3` 及以上还会检查由多个单词组成的文本范围。级别越高，允许检查的文本范围越长。

`MAX_LEVEL` 启用范围最广的文本搜索以及文件系统清单匹配。

当前最大级别可以直接从包中读取：

```ts
import { MAX_LEVEL } from "pathprobe";
```

## 相对路径与绝对路径

相对路径会分别基于 `directories` 中的每个目录进行解析。

```ts
const matches = await findExistingPaths({
  text: "src/index.ts",
  directories: ["/workspace/project-a", "/workspace/project-b"],
  level: 2,
});
```

绝对路径直接按其自身位置解析。

输入可以包含普通平台路径、`file://` URL、`~/file.txt` 形式的主目录路径，以及受支持的变量路径。

## 变量

变量引用可以使用 `variables` 中提供的值，也可以使用当前进程的环境变量。

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

支持的形式包括 `$NAME`、`${NAME}`、`%NAME%`、`!NAME!`、`$env:NAME`、`{{NAME}}`、`${{ NAME }}`、`$(NAME)` 和 `@NAME@`。

主目录路径会使用可用的 `HOME` 或 `USERPROFILE`。

## 行号与列号

路径引用可以包含源码位置后缀。

例如：

```text
src/index.ts:12
src/index.ts:12:4
src/index.ts#L12
```

存在位置后缀时，行号和列号会与文件系统路径分开返回。

## 返回结果

每个结果具有以下结构：

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

`path` 是解析后实际存在的文件系统路径。

`kind` 表示该路径是文件还是目录。

`position` 表示该引用在原始输入文本中的起始和结束偏移量。

`location` 表示从路径引用中解析出的可选行号和列号。

## 隐藏路径与忽略规则

`searchHidden` 的默认值由包配置决定，用于控制是否包含隐藏路径。

在类 Unix 系统上，包含点号前缀路径段的路径会被视为隐藏路径。

在 Windows 上，会考虑文件系统的 Hidden 属性。

`respectIgnore` 用于控制搜索目录中的匹配是否受到已配置忽略文件及 Git ignore 规则的影响。

两个选项都可以显式设置：

```ts
const matches = await findExistingPaths({
  text,
  directories: [process.cwd()],
  level: MAX_LEVEL,
  respectIgnore: true,
  searchHidden: false,
});
```

## Windows 路径

Windows 盘符路径和 UNC 路径都可以作为路径候选。

当映射网络路径或本机管理共享能够在当前系统解析时，可以转换为对应的盘符路径。

Windows 上的路径匹配遵循大小写不敏感的文件系统路径语义。

## 导出内容

包提供以下导出：

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

参数类型无效、搜索级别超出范围或搜索目录无效时，操作会以错误结束。