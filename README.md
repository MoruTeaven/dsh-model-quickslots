# dsh-model-quickslots

在 DeepSeek Harness (DSH) 输入框上方添加一排模型快捷切换按钮。每个按钮对应一套预设配置（提供方 + 模型 + 思考强度），左键点击即可快速切换当前会话模型，右键点击可打开编辑弹窗修改预设。

## 功能

- **快捷切换**：左键点击预设按钮，一键切换当前会话的模型和思考强度
- **自定义备注**：每个预设可以设置自定义名称，不一定必须用模型名
- **右键编辑**：右键点击按钮打开编辑弹窗，可修改预设的提供方、模型、思考强度和备注
- **模型目录联动**：编辑弹窗中的提供方、模型、思考强度下拉列表自动读取当前会话可用的模型目录
- **本地持久化**：预设保存在浏览器 localStorage，无需额外配置

## 截图

*(待补充)*

## 安装

### 方式一：从 npm 安装（正式版发布后）

```bash
pnpm add @moruteaven/dsh-model-quickslots
```

### 方式二：从源码构建

```bash
git clone https://github.com/MoruTeaven/dsh-model-quickslots.git
cd dsh-model-quickslots
pnpm install
pnpm build
```

### 方式三：从 Git 安装

在 DSH 的插件管理页面中，输入本仓库的 Git 地址进行安装。

## 在 DSH 中启用

1. 打开 DSH 设置 → 插件页面
2. 找到 `@moruteaven/dsh-model-quickslots`
3. 启用该插件
4. 刷新页面后，输入框上方将出现快捷按钮栏

## 使用方法

- **左键点击**按钮 → 切换到该预设的模型配置
- **右键点击**按钮 → 打开编辑弹窗
- 点击 **+** 按钮 → 添加新预设

## 技术细节

- 纯客户端 Web 插件，注册到 `conversation.input.dock` 扩展位
- 模型切换通过 `session.selectModel` API 实现
- 图标使用 [Lucide](https://lucide.dev)（ISC 协议）的 SVG 路径
- 样式使用 DSH 主题 CSS 变量，自动适配亮/暗主题

## 许可证

[MIT](./LICENSE)

## 作者

抹露茶柒 (MoruTeaven) — me@MoruTeaven.com — www.MoruTeaven.com
