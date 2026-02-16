# 黑白主题实施指南

本指南将帮助你完成项目从彩色主题到黑白主题的完整迁移。

---

## 🎨 核心变更说明

### 1. CSS 变量系统

#### Light Mode（浅色模式）

- **主色**: `--primary: 0 0% 0%` (纯黑)
- **背景**: `--background: 0 0% 100%` (纯白)
- **卡片**: `--card: 0 0% 97%` (#F8F8F8)
- **边框**: `--border: 0 0% 88%` (#E0E0E0)
- **文字**: `--foreground: 0 0% 0%` (纯黑)

#### Dark Mode（深色模式）

- **主色**: `--primary: 0 0% 100%` (纯白)
- **背景**: `--background: 0 0% 0%` (纯黑)
- **卡片**: `--card: 0 0% 4%` (#0A0A0A)
- **边框**: `--border: 0 0% 16%` (#2A2A2A)
- **文字**: `--foreground: 0 0% 100%` (纯白)

### 2. 组件变更模式

#### 按钮组件

```tsx
// 之前：彩色渐变
bg-gradient-to-br from-indigo-600 to-purple-600

// 现在：纯色 + 语义化
bg-primary text-primary-foreground hover:bg-primary/90
```

#### 卡片组件

```tsx
// 之前：固定颜色
border-slate-200 bg-white

// 现在：语义化变量
border-border bg-card
```

#### 布局组件

```tsx
// 之前：彩色渐变背景
bg-gradient-to-br from-slate-50 via-white to-indigo-50/30

// 现在：纯色背景
bg-background
```

---

## 🔧 需要更新的组件清单

### 优先级 1：核心组件（已完成）✅

- [x] Button (`client/src/components/ui/button.tsx`)
- [x] Card (`client/src/components/ui/card.tsx`)
- [x] AppLayout (`client/src/components/layout/AppLayout.tsx`)

### 优先级 2：导航组件

- [ ] Navbar (`client/src/components/layout/Navbar.tsx`)
- [ ] DesktopNav (`client/src/components/layout/DesktopNav.tsx`)
- [ ] MobileNav (`client/src/components/layout/MobileNav.tsx`)
- [ ] NavLogo (`client/src/components/layout/NavLogo.tsx`)

**更新要点**:

- 移除彩色 Logo/图标，改用黑白或灰度版本
- 背景改为 `bg-background` 或 `bg-card`
- 边框改为 `border-border`
- 文字改为 `text-foreground` / `text-muted-foreground`

### 优先级 3：表单组件

- [ ] Input (`client/src/components/ui/input.tsx`)
- [ ] Select (`client/src/components/ui/select.tsx`)
- [ ] Checkbox (`client/src/components/ui/checkbox.tsx`)
- [ ] Label (`client/src/components/ui/label.tsx`)
- [ ] Dialog (`client/src/components/ui/dialog.tsx`)

**更新要点**:

- Input 边框：`border-input` → `border-border`
- 焦点状态：`focus:ring-indigo-500` → `focus:ring-ring`
- 背景：`bg-white` → `bg-background`

### 优先级 4：页面组件

- [ ] Dashboard (`client/src/pages/Dashboard.tsx`)
- [ ] Account (`client/src/pages/Account.tsx`)
- [ ] Upload (`client/src/pages/Upload.tsx`)
- [ ] Dex (`client/src/pages/Dex.tsx`)
- [ ] Settings (`client/src/pages/Settings.tsx`)
- [ ] Home (`client/src/routes/home.tsx`)

**更新要点**:

- 移除所有彩色渐变背景
- 标题文字使用 `text-foreground`
- 副标题使用 `text-muted-foreground`
- 卡片使用 `bg-card border-border`

### 优先级 5：业务组件

#### Account 相关

- [ ] AccountList (`client/src/components/account/AccountList.tsx`)
- [ ] AccountCard (`client/src/components/account/AccountCard.tsx`)
- [ ] AddAccountSection (`client/src/components/account/AddAccountSection.tsx`)
- [ ] BalanceDisplay (`client/src/components/account/BalanceDisplay.tsx`)
- [ ] TokenBalances (`client/src/components/account/TokenBalances.tsx`)
- [ ] ExternalWalletConnector (`client/src/components/account/ExternalWalletConnector.tsx`)

#### Upload 相关

- [ ] FileUploadSection (`client/src/components/upload/FileUploadSection.tsx`)
- [ ] DragDropUpload (`client/src/components/ui/drag-drop-upload.tsx`)
- [ ] UploadButton (`client/src/components/upload/UploadButton.tsx`)
- [ ] FeeEstimate (`client/src/components/upload/FeeEstimate.tsx`)
- [ ] ArweaveFeeInfo (`client/src/components/upload/ArweaveFeeInfo.tsx`)

#### 其他

- [ ] HistoryTable (`client/src/components/history-table.tsx`)
- [ ] LanguageSwitcher (`client/src/components/language-switcher.tsx`)
- [ ] LoadingFallback (`client/src/components/loading-fallback.tsx`)
- [ ] Icons (`client/src/components/icons.tsx`)

---

## 🎯 快速更新模式

### 查找替换指南

使用以下模式快速更新现有代码：

#### 1. 背景颜色

```tsx
// 查找
bg-white
bg-slate-50
bg-slate-100
bg-gradient-to-br from-slate-50 via-white to-indigo-50

// 替换为
bg-background  // 主背景
bg-card        // 卡片背景
bg-secondary   // 次要背景
```

#### 2. 文字颜色

```tsx
// 查找
text - slate - 900
text - slate - 800
text - slate - 600
text - slate - 400
text - indigo - 600

// 替换为
text - foreground // 主要文字
text - secondary // 次要文字
text - muted - foreground // 辅助文字
```

#### 3. 边框颜色

```tsx
// 查找
border - slate - 200
border - slate - 300
border - indigo - 300

// 替换为
border - border // 标准边框
border - foreground / 20 // 强调边框
```

#### 4. Hover 状态

```tsx
// 查找
hover: bg - slate - 50
hover: bg - indigo - 50
hover: text - indigo - 600

// 替换为
hover: bg - accent
hover: text - accent - foreground
hover: border - foreground / 20
```

#### 5. 阴影效果

```tsx
// 查找
shadow - primary - glow
shadow - indigo - 500 / 20

// 替换为
shadow - sm // 轻微阴影
shadow - md // 中等阴影
shadow - lg // 重度阴影
```

---

## 🧪 测试检查清单

### 视觉测试

- [ ] 浅色模式下所有页面正常显示
- [ ] 深色模式下所有页面正常显示
- [ ] 主题切换过渡流畅
- [ ] 所有文字可读性良好（对比度 ≥ 4.5:1）
- [ ] 所有边框清晰可见
- [ ] 所有 hover 状态有明确反馈

### 功能测试

- [ ] 按钮点击正常
- [ ] 表单输入正常
- [ ] 卡片交互正常
- [ ] 导航功能正常
- [ ] 对话框显示正常
- [ ] 加载状态显示正常

### 响应式测试

- [ ] 移动端（375px）显示正常
- [ ] 平板端（768px）显示正常
- [ ] 桌面端（1024px+）显示正常
- [ ] 触摸目标大小 ≥ 44px

### 可访问性测试

- [ ] 键盘导航正常
- [ ] 焦点状态清晰
- [ ] 屏幕阅读器友好
- [ ] 色盲友好（不依赖颜色区分）

---

## 💡 最佳实践

### 1. 使用语义化颜色变量

```tsx
// ❌ 不推荐：硬编码颜色
<div className="bg-white text-black border-gray-200">

// ✅ 推荐：语义化变量
<div className="bg-background text-foreground border-border">
```

### 2. 保持一致的圆角

```tsx
// ✅ 统一使用 8px (rounded-lg)
<Button className="rounded-lg">
<Card className="rounded-lg">
<Input className="rounded-lg">
```

### 3. 阴影层次分明

```tsx
// 轻度提升 - 卡片
className = "shadow-sm"

// 中度提升 - hover 状态
className = "hover:shadow-md"

// 重度提升 - 模态框
className = "shadow-lg"
```

### 4. 动画保持克制

```tsx
// ✅ 简洁的过渡
className = "transition-all duration-200"

// ❌ 避免过度动画
className = "transition-all duration-500 hover:scale-110 hover:rotate-3"
```

### 5. 保持高对比度

```tsx
// ✅ 主要内容用 foreground
<h1 className="text-foreground">

// ✅ 次要内容用 muted-foreground
<p className="text-muted-foreground">

// ❌ 避免低对比度
<p className="text-gray-300">  // 在白色背景上难以阅读
```

---

## 🔍 常见问题排查

### 问题 1: 深色模式下文字看不清

**原因**: 没有正确使用语义化颜色
**解决**: 使用 `text-foreground` 替代硬编码颜色

### 问题 2: 边框在深色模式下不可见

**原因**: 使用了浅色边框
**解决**: 使用 `border-border` 变量，会自动适配主题

### 问题 3: 按钮 hover 没有反馈

**原因**: 移除了 hover 状态样式
**解决**: 添加 `hover:bg-primary/90` 或 `hover:bg-accent`

### 问题 4: 卡片在深色模式下融入背景

**原因**: 背景和卡片颜色太接近
**解决**: 使用 `bg-card` (会自动使用 #0A0A0A 在深色模式)

### 问题 5: 图标颜色不协调

**原因**: SVG 图标使用了硬编码颜色
**解决**: 给图标添加 `className="text-current"` 继承父元素颜色

---

## 📚 参考资源

- **设计系统**: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- **Tailwind CSS 文档**: https://tailwindcss.com
- **Radix UI 组件**: https://www.radix-ui.com
- **shadcn/ui**: https://ui.shadcn.com
- **WCAG 对比度检查**: https://webaim.org/resources/contrastchecker/

---

## ✅ 验收标准

项目迁移完成后，应满足以下标准：

1. ✅ 所有组件使用语义化颜色变量（无硬编码颜色）
2. ✅ 浅色/深色模式完美切换
3. ✅ 所有文字对比度 ≥ 4.5:1 (WCAG AA 标准)
4. ✅ 所有交互元素有明确的 hover/focus 状态
5. ✅ 响应式布局在所有断点正常工作
6. ✅ 无视觉 bug 或样式错位
7. ✅ 性能无明显下降
8. ✅ 通过可访问性基础检查

---

**文档版本**: v1.0.0
**创建日期**: 2026-01-27
**维护者**: Claude & Team

祝迁移顺利！🚀
