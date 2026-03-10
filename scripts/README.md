## generate-alphatex-commands

这是用来导出 `coderline` 官方的 alphatex 相关LSP定义的脚本，导出 `src\renderer\data\alphatex-commands.generated.json`。

在编辑器的实际应用中，我们单独维护自己的 `src\renderer\data\alphatex-commands.json` 脚本，以实现自定义的命令和功能。

`src\renderer\workers\alphatex.worker.ts`

```ts
import { documentation } from "@coderline/alphatab-language-server";
import commandsJSON from "../data/alphatex-commands.json";
```

我们虽然写了merge逻辑，但是不太敢用，所以`package.json`里没写对应的 --merge 参数，比较害怕不知道那个commit直接给我弄没了。

```
获得官方json->手动同步->根据使用体验自定义<->手动merge
```

现在的工作流：
- （低频）如果alphaTex更新了对应的语言包，那么就 generate 一次获得 `alphatex-commands.generated.json`，然后手动进行diff和同步，检查git diff就行
- 一般的开发工作，如果需要自定义命令，那么就编辑 `src\renderer\data\alphatex-commands.json`就行。
- 总结：自动获得更新，手动对比json和自定义命令

我希望是这样的：
1.把 `alphatex-commands.json` 当作“本地标准”，所有字段都是，包括命令commands和属性properties
2.之前 properties 不是由Worker读取然后生成的吗？把Worker直接从库中提取，改为fallback机制（对命令commands和属性properties都生效）

这样一来，我们：
1.把 `alphatex-commands.json` 当作“本地标准”，我们可以进行任意自定义
2.如果`alphatex-commands.json`有缺失或者没跟上 @coderline/alphatab-language-server ，worker从库提取并填补作为fallback
3. `alphatex-commands.generated.json` 用作本地开发时参考，不需要改动

这样明白了吗？是不是清楚多了，我们既享受了官方包的全面性（fallback托底），同时又用我们自己的自定义为优先（在`alphatex-commands.json`中 自定义成功读取的不会被fallback）。

## codemix

一个用于将项目中指定目录或文件的文本内容合并为单一 Markdown 文档的工具，方便分享代码片段、调试或审阅。
默认输出 `dist/codemix.md`，支持通过 `--out` 指定输出路径，以及通过 `--omit` 省略大文件（例如 `alphaTab.min.js`）。

和以前一样，这里也要有一个/一系列codemix命令方便打包 debug。

添加以下命令：

```package.json
pnpm mix
pnpm mix:main
pnpm mix:render
pnpm mix:doc
pnpm mix:config
```

mix命令是为了将指定目录下满足一定规则的文本文件合并到一起，格式为

````text
<!-- 文件开头-->

./README.md以及其内容

所有合成文件相对.项目根目录的路径,一个一行

<!--文件主体-->

## ./path-to-file/some.code

```text
文件内容
```

<!-- 文件结尾 -->

============

````

### codemix 每个命令对应的合成内容

mix 包括 main render doc 和 config 的内容。

mix:main ./src-tauri
mix:render ./src/renderer

mix:doc ./docs
mix:config ./AGENTS.md ./biome.json ./package.json

使用说明：

- 默认会生成 `dist/codemix.md` 文件。
- 你可以通过 `--out` 参数指定输出文件（例如 `pnpm mix --out ./dist/share.md`）。
- 也可以把目录或路径直接传给脚本：`node scripts/codemix.js ./src/renderer`。

省略规则：

- 脚本默认会省略任何名为 `alphaTab.min.js` 的文件（通常是较大或压缩的 JS 文件），以避免把冗长内容合并到共享文档中。
- 如果需要额外省略某些文件名或模式，使用 `--omit` 参数，支持多个值或通配符（逗号分隔），例如：`--omit=alphaTab.min.js,*.min.js`。
- 也支持 `--omit` 后接空格参数：`--omit alphaTab.min.js`。

示例：

```bash
pnpm mix            # 合并 main+render+doc+config 到 dist/codemix.md
pnpm mix:main       # 合并 ./src-tauri 到 dist/codemix.md
pnpm mix:render     # 合并 ./src/renderer 到 dist/codemix.md
pnpm mix:doc        # 合并 ./docs 到 dist/codemix.md
pnpm mix:config     # 合并 AGENTS.md/biome.json/package.json
pnpm mix --out ./dist/share.md   # 指定输出文件
```

## 性能脚本状态

当前仓库默认桌面栈为 Tauri，性能门禁已切换到 Tauri-first 路径。

- `pnpm perf:tauri:baseline`：执行 `build:web` + Rust `release` 构建，并生成 `docs/dev/ops/tauri-performance-baseline-summary.json`
- `pnpm perf:tauri:assert`：根据 `.github/perf-thresholds.json` 校验 Tauri 构建时长与关键产物体积
- `pnpm perf:tauri:ci`：CI 使用的组合命令

迁移前的 multi-baseline / long-stress 数据仍保留在 `docs/dev/ops/` 作为历史记录，但当前主线 CI 不再依赖它们。
