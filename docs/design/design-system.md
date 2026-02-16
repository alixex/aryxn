# Aryxn 设计系统 - 黑白主题

## 🎨 设计理念

**极简、高级、专业**

采用纯粹的黑白配色方案，强调层次感和对比度，打造高端 Web3 应用体验。

---

## 🌓 核心配色方案

### Light Mode (浅色模式)

```css
/* 背景层次 */
--background-primary: #ffffff /* 纯白 - 主背景 */
  --background-secondary: #f8f8f8 /* 极浅灰 - 卡片背景 */
  --background-tertiary: #f0f0f0 /* 浅灰 - hover 状态 */
  --background-elevated: #ffffff /* 纯白 - 弹窗/浮层 */ /* 文字层次 */
  --text-primary: #000000 /* 纯黑 - 标题/重要文字 */ --text-secondary: #404040
  /* 深灰 - 正文 */ --text-tertiary: #808080 /* 中灰 - 辅助文字 */
  --text-disabled: #c0c0c0 /* 浅灰 - 禁用文字 */ /* 边框与分割线 */
  --border-default: #e0e0e0 /* 浅灰边框 */ --border-strong: #c0c0c0
  /* 深灰边框 */ --border-focus: #000000 /* 黑色焦点边框 */ /* 交互状态 */
  --hover-overlay: rgba(0, 0, 0, 0.04) /* 黑色半透明 hover */
  --active-overlay: rgba(0, 0, 0, 0.08) /* 黑色半透明 active */
  --selected-bg: #000000 /* 黑色选中背景 */ --selected-text: #ffffff
  /* 白色选中文字 */;
```

### Dark Mode (深色模式)

```css
/* 背景层次 */
--background-primary: #000000 /* 纯黑 - 主背景 */
  --background-secondary: #0a0a0a /* 极深灰 - 卡片背景 */
  --background-tertiary: #141414 /* 深灰 - hover 状态 */
  --background-elevated: #1a1a1a /* 浮层背景 */ /* 文字层次 */
  --text-primary: #ffffff /* 纯白 - 标题/重要文字 */ --text-secondary: #c0c0c0
  /* 浅灰 - 正文 */ --text-tertiary: #808080 /* 中灰 - 辅助文字 */
  --text-disabled: #404040 /* 深灰 - 禁用文字 */ /* 边框与分割线 */
  --border-default: #2a2a2a /* 深灰边框 */ --border-strong: #404040
  /* 中灰边框 */ --border-focus: #ffffff /* 白色焦点边框 */ /* 交互状态 */
  --hover-overlay: rgba(255, 255, 255, 0.04)
  --active-overlay: rgba(255, 255, 255, 0.08) --selected-bg: #ffffff
  --selected-text: #000000;
```

### 强调色（仅用于关键操作）

```css
/* 主要操作按钮 - 保留一个强调色 */
--accent-primary: #000000 (Light) / #ffffff (Dark) --accent-hover: #2a2a2a
  (Light) / #e0e0e0 (Dark) /* 状态色 - 使用黑白灰色调 */ --success: #404040
  --warning: #808080 --error: #000000 --info: #606060;
```

---

## 📐 间距系统

采用 8px 基础网格系统：

```css
--spacing-xs: 4px /* 0.5 */ --spacing-sm: 8px /* 1 */ --spacing-md: 16px /* 2 */
  --spacing-lg: 24px /* 3 */ --spacing-xl: 32px /* 4 */ --spacing-2xl: 48px
  /* 6 */ --spacing-3xl: 64px /* 8 */ --spacing-4xl: 96px /* 12 */;
```

---

## 🔤 字体系统

### 字体族

```css
/* 主字体 - 极简几何无衬线 */
--font-primary:
  "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

/* 等宽字体 - 用于地址、代码 */
--font-mono: "JetBrains Mono", "Fira Code", "Courier New", monospace;

/* 显示字体 - 用于大标题 */
--font-display: "Inter", system-ui, sans-serif;
```

### 字号与字重

```css
/* 标题层级 */
--text-h1: 48px / 700 /* Display - 页面主标题 */ --text-h2: 36px / 700
  /* Heading 1 */ --text-h3: 24px / 600 /* Heading 2 */ --text-h4: 20px / 600
  /* Heading 3 */ --text-h5: 16px / 600 /* Heading 4 */ /* 正文层级 */
  --text-body-lg: 18px / 400 /* 大正文 */ --text-body: 16px / 400 /* 标准正文 */
  --text-body-sm: 14px / 400 /* 小正文 */ --text-caption: 12px / 400
  /* 辅助说明 */ --text-overline: 11px / 500 /* 上标文字 */ /* 行高 */
  --line-height-tight: 1.2 /* 标题 */ --line-height-normal: 1.5 /* 正文 */
  --line-height-relaxed: 1.7 /* 长文本 */ /* 字重 */ --font-light: 300
  --font-regular: 400 --font-medium: 500 --font-semibold: 600 --font-bold: 700;
```

---

## 🎭 阴影系统

使用黑色阴影营造深度，避免彩色阴影：

```css
/* Light Mode */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04) --shadow-md: 0 2px 8px
  rgba(0, 0, 0, 0.06) --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.08) --shadow-xl: 0
  8px 32px rgba(0, 0, 0, 0.12) --shadow-2xl: 0 16px 64px rgba(0, 0, 0, 0.16)
  /* Dark Mode */ --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2) --shadow-md: 0 2px
  8px rgba(0, 0, 0, 0.3) --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.4)
  --shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.5) --shadow-2xl: 0 16px 64px
  rgba(0, 0, 0, 0.6) /* 内阴影 - 用于输入框 */ --shadow-inner: inset 0 1px 2px
  rgba(0, 0, 0, 0.06);
```

---

## 🔘 圆角系统

```css
--radius-none: 0px --radius-sm: 4px /* 小元素：标签、徽章 */ --radius-md: 8px
  /* 中等元素：按钮、输入框 */ --radius-lg: 12px /* 大元素：卡片 */
  --radius-xl: 16px /* 特大元素：模态框 */ --radius-full: 9999px
  /* 圆形：头像、图标按钮 */;
```

**建议**：整体使用 `8px` 圆角，保持现代简洁感。

---

## ⚡ 动画系统

### 持续时间

```css
--duration-instant: 100ms /* 微交互 */ --duration-fast: 150ms /* 快速响应 */
  --duration-normal: 250ms /* 标准过渡 */ --duration-slow: 350ms /* 复杂动画 */
  --duration-slower: 500ms /* 页面切换 */;
```

### 缓动函数

```css
--ease-in: cubic-bezier(0.4, 0, 1, 1) --ease-out: cubic-bezier(0, 0, 0.2, 1)
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
  --ease-sharp: cubic-bezier(0.4, 0, 0.6, 1) /* 快速进入 */
  --ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1) /* 平滑过渡 */;
```

### 动画类

```css
/* Hover 交互 */
.hover-lift {
  transition: transform var(--duration-fast) var(--ease-out);
}
.hover-lift:hover {
  transform: translateY(-2px);
}

/* 淡入动画 */
.fade-in {
  animation: fadeIn var(--duration-normal) var(--ease-smooth);
}

/* 滑入动画 */
.slide-up {
  animation: slideUp var(--duration-normal) var(--ease-out);
}
```

---

## 🧩 组件规范

### 按钮

```css
/* Primary Button - 黑底白字 (Light) / 白底黑字 (Dark) */
.btn-primary {
  background: var(--selected-bg);
  color: var(--selected-text);
  border: 1px solid var(--selected-bg);
  padding: 12px 24px;
  font-weight: 500;
  transition: all var(--duration-fast) var(--ease-out);
}
.btn-primary:hover {
  background: var(--background-tertiary);
  color: var(--text-primary);
}

/* Secondary Button - 描边 */
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-strong);
}
.btn-secondary:hover {
  background: var(--hover-overlay);
}

/* Ghost Button - 无边框 */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
}
.btn-ghost:hover {
  background: var(--hover-overlay);
  color: var(--text-primary);
}
```

### 卡片

```css
.card {
  background: var(--background-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-normal) var(--ease-out);
}
.card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--border-strong);
}
```

### 输入框

```css
.input {
  background: var(--background-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 10px 16px;
  color: var(--text-primary);
  font-size: 16px;
  transition: all var(--duration-fast) var(--ease-out);
}
.input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05);
  outline: none;
}
```

### 导航栏

```css
.navbar {
  background: var(--background-elevated);
  border-bottom: 1px solid var(--border-default);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 50;
}
```

---

## 📱 响应式断点

```css
--breakpoint-sm: 640px /* 手机 */ --breakpoint-md: 768px /* 平板 */
  --breakpoint-lg: 1024px /* 笔记本 */ --breakpoint-xl: 1280px /* 桌面 */
  --breakpoint-2xl: 1536px /* 大屏 */;
```

---

## ♿ 可访问性标准

### 对比度要求

- 正文文字：至少 **7:1** (AAA 级别)
- 大号文字（18px+）：至少 **4.5:1** (AA 级别)
- 图标和图形：至少 **3:1**

### 焦点状态

```css
*:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
```

### 触摸目标

- 最小尺寸：**44px × 44px**
- 间距：至少 **8px**

---

## 🎯 设计原则

### 1. 极简主义

- 去除所有不必要的装饰
- 使用留白创造呼吸感
- 专注于内容和功能

### 2. 层次清晰

- 通过颜色深浅区分信息层级
- 使用字号和字重建立视觉层级
- 利用间距分组相关内容

### 3. 高对比度

- 确保文字清晰易读
- 明确区分交互元素
- 强调关键操作

### 4. 一致性

- 统一的圆角和间距
- 统一的动画时长和缓动
- 统一的交互反馈

### 5. 性能优先

- 避免过度动画
- 使用 transform 和 opacity 进行动画
- 减少阴影和模糊效果的使用

---

## 🚫 设计反模式（避免）

❌ 使用彩色渐变背景
❌ 过多的阴影效果
❌ 不一致的圆角大小
❌ 低对比度的文字颜色
❌ 过于花哨的动画效果
❌ 使用 emoji 作为图标
❌ 不统一的间距系统

---

## 📦 技术实现

### Tailwind CSS 配置

参考 [tailwind.config.js](#) 中的主题配置

### CSS 变量

参考 [index.css](#) 中的 `:root` 和 `.dark` 选择器

### 组件库

使用 shadcn/ui + Radix UI，配合黑白主题定制

---

## 🔄 实施计划

### Phase 1: 核心样式迁移

- [ ] 更新 CSS 变量为黑白配色
- [ ] 调整 Tailwind 配置
- [ ] 更新全局基础样式

### Phase 2: 组件优化

- [ ] 重构按钮组件
- [ ] 重构卡片组件
- [ ] 重构表单组件
- [ ] 重构导航组件

### Phase 3: 页面适配

- [ ] 首页/Dashboard
- [ ] 账户管理页
- [ ] 上传页面
- [ ] DEX 交易页面
- [ ] 设置页面

### Phase 4: 细节打磨

- [ ] 动画优化
- [ ] 响应式适配
- [ ] 可访问性测试
- [ ] 性能优化

---

## 📚 参考资源

- [Inter 字体](https://rsms.me/inter/)
- [Tailwind CSS 文档](https://tailwindcss.com)
- [shadcn/ui 组件库](https://ui.shadcn.com)
- [WCAG 可访问性指南](https://www.w3.org/WAI/WCAG21/quickref/)

---

**设计系统版本**: v1.0.0
**最后更新**: 2026-01-27
**维护者**: Claude & Team
