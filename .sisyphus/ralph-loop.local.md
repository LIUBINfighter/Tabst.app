---
active: true
iteration: 2
max_iterations: 100
completion_promise: "DONE"
started_at: "2026-02-02T18:05:58.995Z"
session_id: "ses_3e07798d9ffegeHmqULhrbigcD"
---
ulw ultra-work 全面重构此项目，
 
 1. 质量门 pnpm+format lint check build make，阅读README.md和Agents.md用于了解整个项目和行动要求
 2. 先分析整个应用的情况和代码组织形式，将组件进行拆解，将纯逻辑和UI逻辑分离，拆解过大的组件文件，提取可复用的组件，整理代码逻辑，组织良好的代码框架和逻辑，使用README.md中提供的技术栈和对应的社区最佳实践，比如React，electron，tailwindcss v3，codemirror6等，这是最重要的一部分，这一步不能失败。在完成了这一步的时候，质量门+提交+写一份重构报告并打一个tag。这是下一步的基础。完成了这一步后不需要汇报（我会看重构报告），直接进行第三步
 3. 在组织代码结构良好的基础上，使用 包括 https://github.com/Effect-TS/effect 在内的 effect 库，替换原有的原生promise等nodejs传统原生写法，涉及到主进程事件处理，纯逻辑（比如language server）等，将主进程和纯逻辑打造的绝对稳固。停火线：绝对不要在 React 组件（`.tsx`）内部直接编写复杂的 `Effect` 管道；Renderer Process (渲染进程/浏览器环境)要克制使用effect。React 组件会频繁卸载（Unmount），而 Effect 里的某些操作（比如大文件读取流）可能需要手动释放资源。Effect 原生支持 `AbortSignal`，这比你以前手动写 `isMounted` 标志位要优雅且健壮得多。一旦组件卸载，Effect 里的文件句柄会自动通过 `Scope` 释放，不会导致内存泄漏。
