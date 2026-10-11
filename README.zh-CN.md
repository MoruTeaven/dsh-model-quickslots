# dsh-model-quickslots

[English](README.md) · **简体中文** · [日本語](README.ja.md)

[![npm](https://img.shields.io/npm/v/@moruteaven/dsh-model-quickslots?color=4f46e5)](https://www.npmjs.com/package/@moruteaven/dsh-model-quickslots)
[![license](https://img.shields.io/npm/l/@moruteaven/dsh-model-quickslots?color=4f46e5)](./LICENSE)
[![DSH](https://img.shields.io/badge/DSH-plugin-4f46e5)](https://github.com/deepseek-ai)
[![Gitee](https://img.shields.io/badge/Gitee-%E9%95%9C%E5%83%8F-c71d23)](https://gitee.com/moruteaven/dsh-model-quickslots)

在 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）的输入框上方添加一排模型快捷切换按钮。每个按钮对应一套预设配置（提供方 + 模型 + 思考强度）：**左键点击**即可切换当前会话的模型，**右键点击**打开编辑弹窗。

## 功能

- **一键切换** — 左键点击预设，快速切换当前会话的模型与思考强度。
- **自定义备注** — 每个预设都可以有自己的名字，不一定必须用模型名。可以叫「快速」「深度思考」。
- **右键编辑** — 右键点击任意预设，修改它的提供方、模型、思考强度和备注。
- **模型目录联动** — 编辑弹窗的下拉列表自动读取当前会话真正可用的模型，不含写死的模型清单。
- **当前预设高亮** — 与当前会话模型一致的预设会描边显示。
- **失败提示** — 切换失败的预设会标红，不会静默失败。
- **本地持久化** — 预设保存在浏览器 `localStorage`，不需要账号，也不涉及同步服务。
- **自动适配主题** — 使用 DSH 主题变量，跟随亮色/暗色主题。

## 演示

左键点击预设，即可切换当前会话的模型：

![一键切换模型](docs/quick-switch.gif)

## 截图

预设按钮位于输入框正上方，与输入卡片对齐：

![输入框上方的预设按钮](docs/preset-row.jpg)

右键点击预设即可编辑，下拉列表来自当前真实的模型目录：

![编辑预设](docs/edit-dialog.png)

## 安装

### 从 npm 安装（推荐）

```bash
pnpm add @moruteaven/dsh-model-quickslots
```

然后把该包加入你 profile 的 `dsh.profile.bundles` 列表并重启 DSH。

### 通过 DSH 插件管理器

打开 **设置 → 插件**，搜索 `@moruteaven/dsh-model-quickslots` 并安装。

### 从源码构建

两个公开仓库保持同步，选择你访问更快的那个：

```bash
# GitHub
git clone https://github.com/MoruTeaven/dsh-model-quickslots.git

# Gitee（国内镜像，访问更快）
git clone https://gitee.com/moruteaven/dsh-model-quickslots.git

cd dsh-model-quickslots
pnpm install
pnpm build
```

## 使用方法

| 操作 | 结果 |
| --- | --- |
| **左键点击**预设 | 把当前会话切换到该预设的模型配置 |
| **右键点击**预设 | 打开该预设的编辑弹窗 |
| 点击 **+** | 新建一个预设 |
| 按 **Esc** | 关闭编辑弹窗 |
| 按 **Ctrl/Cmd + Enter** | 保存预设 |

还没有任何预设时，按钮栏会显示一个「模型预设」入口，点击它创建第一个预设。

按钮栏位于输入框正上方，右缘与输入卡片对齐。

## 开发

```bash
pnpm build   # 打包 lib/client.js（浏览器端）与 lib/index.js（宿主端）
pnpm dev     # 监听改动自动重建
pnpm test    # 运行自测
```

本插件是纯客户端 Web 插件，注册到 `conversation.input.dock` 扩展位。模型切换复用 DSH 内置的模型目录服务，因此行为与内置模型选择器完全一致，包括可用性判定与竞态处理。

## 许可证

[MIT](./LICENSE)

## 作者

抹露茶柒 (MoruTeaven) — me@MoruTeaven.com — www.MoruTeaven.com
