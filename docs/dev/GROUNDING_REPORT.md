# 文档 Grounding 检查报告

**检查日期**: 2026-02-09  
**检查范围**: docs/dev/ 下的技术文档与代码实现的一致性  
**检查方法**: 代码级比对验证

---

## 总体摘要

| 文档 | 状态 | 关键问题 |
|------|------|----------|
| ARCHITECTURE.md | ✅ 准确 | 概念正确，缺少部分实现细节 |
| THEME_SWITCH_GUIDE.md | ✅ 准确 | 核心逻辑正确，行号已过时 |
| REBUILD_MECHANISMS.md | ✅ 准确 | 5层机制描述正确，示例简化 |
| TRACKS_CONFIGURATION.md | ⚠️ 部分 | Solution B/C未实现，描述的是设计而非实际代码 |
| SELECTION_SYNC.md | ✅ 准确 | 核心机制正确，有少量实现差异 |
| LSP_INTEGRATION.md | ⚠️ 部分 | Hover已实现，高亮实现方式不同 |

---

## 详细验证结果

### 1. ARCHITECTURE.md - 系统架构分析

**状态**: ✅ **概念准确**

#### 已确认的内容
- ✅ Worker线程在初始化时缓存颜色配置
- ✅ 简单修改+render()无效（Worker缓存问题）
- ✅ 完全重建（destroy + new API）是必要方案
- ✅ 数据流: CSS变量 → JS → Worker
- ✅ 使用MutationObserver检测主题变化

#### 重要缺失
1. **trackConfigRef机制**: 文档提到"保存用户Tracks配置"但未详细说明`trackConfigRef`的实现
2. **TAB Probe机制**: 首次加载时的TAB偏好探测完全未提及
3. **API实例追踪**: `bumpApiInstanceId()`未提及
4. **错误恢复**: `scheduleTexTimeout`等错误处理机制未提及
5. **选区清除**: `clearScoreSelection()`在重建时的调用未提及

#### 建议
文档作为架构概览是合格的，但应添加一节"Implementation Details"补充上述缺失内容。

---

### 2. THEME_SWITCH_GUIDE.md - 主题切换指南

**状态**: ✅ **核心逻辑准确**

#### 已确认的内容
- ✅ 主题切换需要完全重建
- ✅ trackConfigRef保存/恢复tracks配置
- ✅ scoreLoaded回调应用配置
- ✅ void (async () => {})()异步模式
- ✅ 7步重建流程准确

#### 行号过时
文档引用`Preview.tsx`第162-225行，实际代码在906-994行。建议删除具体行号引用，改用函数名引用。

#### 建议
更新行号引用，添加TAB Probe机制的说明。

---

### 3. REBUILD_MECHANISMS.md - 重建机制

**状态**: ✅ **5层机制描述准确**

#### 已确认的内容
- ✅ Level 1: render() - 不适用于主题切换
- ✅ Level 2: renderTracks() - 用于tracks显示切换
- ✅ Level 3: tex() - 用于内容变化
- ✅ Level 4: 完全重建 - 用于主题切换
- ✅ Level 5: 播放状态保留 - 标记为未实现（正确）

#### 重要缺失
1. **trackConfigRef持久化**: 未提及配置如何在重建间保持
2. **selection清除**: 重建时的`clearScoreSelection()`调用
3. **错误恢复集成**: `scheduleTexTimeout`机制
4. **Zoom使用render()**: Zoom功能使用render()且工作正常（应说明例外情况）

#### 建议
在Level 1说明Zoom是render()的有效使用场景。

---

### 4. TRACKS_CONFIGURATION.md - Tracks配置

**状态**: ⚠️ **描述的是设计而非实现**

#### 问题：Solution B 和 C 未实现
文档描述了3个解决方案：
- ✅ Solution A (Ref + applyTracksConfig): **已实现**（有修改）
- ❌ Solution B (initializeAlphaTabInstance): **未实现**
- ❌ Solution C (状态管理): **未实现**

#### 实际实现与文档差异
1. **toggle函数**: 文档显示组件内函数，实际使用`toggleFirstStaffOption`库函数
2. **applyTracksConfig**: 实际代码有复杂的TAB Probe机制，文档简化版未涵盖
3. **状态管理**: 使用Zustand store而非本地useState

#### 建议
重写此文档，删除未实现的Solution B/C，详细说明实际采用的Solution A的完整实现（包括TAB Probe）。

---

### 5. SELECTION_SYNC.md - 选区同步

**状态**: ✅ **核心机制准确**

#### 已确认的内容
- ✅ playbackRangeHighlightChanged事件使用
- ✅ AST解析器用于位置映射
- ✅ 双重检查机制（isHighlightFromEditorCursorRef）
- ✅ CodeMirror装饰效果
- ✅ 安全dispatch模式

#### 实现差异
1. **safeDispatch**: 文档显示`requestAnimationFrame`，实际使用`setTimeout(0)`（带注释说明原因）
2. **applyPlaybackRangeFromHighlight**: 文档提及此方法，但代码中未使用
3. **文件引用**: 文档引用`docs/dev/SelectionAPI.md`，实际文件名为`SELECTION_SYNC.md`

#### 重要缺失
1. **双高亮系统**: 未提及绿色（播放）和黄色（暂停小节）两种高亮
2. **enableCursorBroadcast**: 控制同步的flag未提及
3. **Cursor Tracking模块**: 作为独立模块的事实未提及

#### 建议
更新safeDispatch说明，添加双高亮系统文档。

---

### 6. LSP_INTEGRATION.md - LSP集成

**状态**: ⚠️ **部分信息过时**

#### 已确认的内容
- ✅ Local-first + upstream-fallback策略
- ✅ Worker加载alphatex-commands.json
- ✅ LSP消息处理（initialize, completion）
- ✅ CodeMirror补全集成
- ✅ JSON-RPC 2.0格式
- ✅ 请求超时处理

#### 实现差异
1. **语法高亮**: 文档说使用TextMate+WASM，实际使用StreamLanguage（更简单的方式）
2. **Hover实现**: 文档标记为"占位"，实际已完整实现

#### 重要缺失
1. **自定义barlines方法**: 非标准LSP方法`textDocument/barlines`未提及
2. **fallback命令列表**: 32个硬编码fallback命令未提及
3. **Snippet支持**: 补全支持`${}`占位符未提及
4. **注释感知**: 在注释中抑制补全的逻辑未提及

#### 数据不符
`alphatex-commands.json`实际只有1个命令和空properties数组，文档暗示内容更丰富。

#### 建议
更新Hover状态为"已实现"，添加缺失的实现细节。

---

## 优先修复建议

### 高优先级

1. **TRACKS_CONFIGURATION.md 重写**
   - 删除未实现的Solution B/C
   - 详细记录实际采用的Solution A
   - 添加TAB Probe机制说明

2. **更新行号引用**
   - THEME_SWITCH_GUIDE.md: 删除或更新行号
   - REBUILD_MECHANISMS.md: 删除或更新行号

### 中优先级

3. **SELECTION_SYNC.md 更新**
   - 修正safeDispatch实现说明
   - 添加双高亮系统文档
   - 修正文件引用路径

4. **LSP_INTEGRATION.md 更新**
   - 修正Hover实现状态
   - 修正高亮实现方式
   - 添加缺失的实现细节

### 低优先级

5. **所有文档添加"Implementation Notes"章节**
   - 记录重要的实现细节
   - 说明与文档的差异
   - 提供代码定位建议（函数名而非行号）

---

## 结论

总体而言，文档在**架构层面**是准确的，正确描述了：
- 为什么需要完全重建（Worker缓存问题）
- 5层重建/刷新机制的区别
- 选区同步的核心机制
- LSP的local-first策略

但在**实现细节**层面存在差距：
- TAB Probe机制完全缺失
- 部分行号严重过时
- 一个文档描述的是设计而非实际代码
- Hover等功能状态描述不准确

**建议**：将文档定位为"架构指南"而非"实现手册"，并添加明确的实现细节章节来补充差距。

---

**检查人**: Sisyphus Agent  
**代码版本**: 2026-02-09
