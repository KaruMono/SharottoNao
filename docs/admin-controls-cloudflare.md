# 后台控件迁移依据

参考目录：`D:/MyProject/SmartLab/cloudflare-ui-demo-20261009/cloudflare-ui-style`。

读取并采用 `SKILL.md`、`references/design-spec.md`、`references/components.md`、`references/interaction-spec.md`、`references/migration.md`，具体颜色和状态来自 `assets/tokens.css`、`assets/components.css`、`assets/interactions.css`，选择框行为参照 `assets/interactions.js`。Tabs 另参考 `references/motion-spec.md`、`assets/motion-tokens.json`，并在浏览器打开 `examples/motion.html` 观察指示器过渡。

## 已接入

- `components/admin/KumoButton.vue`：标准按钮 36px / 14px / 500 / 8px，工具栏 32px，小按钮 26px / 12px / 6px；主按钮采用参考的蓝色渐变、1px 外环和顶部高光，中性、ghost、危险操作沿用对应配方。兼容原来的 `emphasis`、`active`、`to`、`disabled`、`type`，补齐 `primary`。禁用的链接按钮也阻止导航。
- `components/admin/Select.vue`：36px 触发器、8px 浮层、33px 最小选项高度、4px 选项圆角。勾选与高亮分开；支持方向键、Home/End、Enter/Space、Escape、Tab、文字前缀查找、外部点击关闭。浮层传送到 body，按窗口边缘定位。
- 29 个后台页面迁入 147 处常规按钮/按钮链接、28 处单选框；原有 `AdminKumoButton` 调用同步采用新样式。数据请求、选项、权限、业务脚本保持原样。
- `components/admin/TabSwitch.vue`：用于“全部游戏／回收站”，采用 36px 轨道、32px 选项、2px 内边距、8px / 6px 圆角；选中背景与细环随指示器移动，位置和宽度采用 200ms `cubic-bezier(.4,0,.2,1)`。支持方向键、Home/End、禁用项、减少动态效果，徽标、容器尺寸或字体加载变化后重新定位。游戏页标题区允许换行，避免窄屏标题被挤成竖排。
- 26 个后台页面的 149 处原生输入框与文本域：标准输入 36px / 14px / 8px、左右 12px 内边距、1px 细环，聚焦 1.5px；文本域最小 88px，保留多行与纵向调整。保留图标留白、字段宽度、等宽字体、数字/日期类型、`v-model` 修饰符、校验及事件。
- 标签组合框、颜色组合框使用共享 input-group 配方。`TagAutocomplete` 的后台标签搜索以及 11 个后台页面中 `Pagination` 的跳转输入也采用该配方。标签组件通过 `appearance="admin"` 选择外观，与原来的 `admin` 数据权限属性分开；分页通过新增的 `admin` 外观属性选择。前台调用保留原样。
- `assets/css/admin-controls.css` 仅作用于显式的 `admin-*` 控件类，并跟随现有 `.dark` 主题。后台布局引入样式，覆盖传送到 body 的表单。沿用 Charlotte 字体；没有整体导入参考包的页面重置、侧栏或布局规则。

## 明确的适配

参考包本身将 danger 配方和 loading 标记为适配项。本轮沿用其中的危险文字/浅红悬停方案；loading 使用叠放的 spinner 和保留位置的内容。选择框用 Vue 渲染列表，隐藏的原生 select 保留原选项值、表单验证、表单字段和原生 `change` 事件，兼容数字选项、`v-model.number` 以及仅用 `:value` 的角色选择器。

未指定宽度的选择框依照最长选项计算宽度，并预留参考配方中的勾选与间距；这是保留原生 select 内容宽度行为的适配。测量区使用与选项一致的 14px 字号和 -.01em 字距。展开面板按实际选项内容计算宽度，以触发器宽度为下限、视口宽度为上限，避免被紧凑工具栏挤窄；超出视口的长文本仍可换行。普通按钮与 Select 的状态反馈均为 0ms，不添加按压缩放、箭头旋转或浮层入场动画。

输入框使用原生节点配合共享类；基础选择器高于 Preflight 的元素重置，低于现有宽度、等宽字体和图标内边距工具类，避免加载顺序改变内边距。标签多选容器在参考 input-group 上补充自动换行；审核弹层内搜索沿用无独立外框布局。Tabs 的徽标保留回收站数量语义，采用参考 danger tint；动画时序来自参考规范，Vue 测量和 ResizeObserver 为本项目适配。

标签内的移除图标、图片覆盖按钮、其他页面自定义页签、统计卡片、搜索建议列表、复选框及其余布局继续使用现有实现；这些有各自的组件语义，后续应按对应参考单独迁移。

## 验证（2026-10-09）

- Vue 单文件组件编译、迁移前后业务脚本及事件/选项核对。
- Edge 浏览器控件验证：尺寸、禁用链接、键盘导航、取消不提交、焦点恢复、禁用选项、数字模型、原生 change、必填验证、FormData、重置、动态选项、长列表、弹层防裁切、浅深色、减少动态效果；控件样例在 1440 / 900 / 390 宽度检查。
- 下拉宽度回归：采用实际页面的 16px 正文字号，在 1 / 1.5 / 2 像素比例下复现并修复“游戏发布日期”换行；将触发器缩至 100px 后，面板仍按内容展开，常规选项保持 33px 单行高度。
- 用实际游戏管理、用户管理页面源码及隔离数据验证筛选查询、数字分页、高级筛选按钮、角色更新请求；未调用真实业务 API。截图中的测试图标是占位，实际页面继续使用现有 Icon/FaIcon。
- Tabs / Input 补充验证：26 个页面模板、5 个共享组件编译通过；逐项核对页面只改变外观类、标签 `appearance` 和分页 `admin` 外观属性，业务脚本、绑定、原生校验及事件保持一致。实际游戏页验证搜索提交、切换回收站更新 URL 并清空搜索。
- 在动画中间帧记录指示器位置与宽度，验证连续过渡和中途反向；验证动态徽标、字体加载、窗口缩放、键盘跳过禁用项、减少动态效果。输入框验证默认/聚焦/错误/禁用/只读、图标间距、数字模型、必填邮箱、组合框及文本域；后台标签搜索键盘选取和分页跳转通过。深浅色及 1440 / 900 / 390 宽度检查通过。
- `vue-tsc --noEmit` 未报告本次改动的类型错误；全项目检查仍被原有的 `components/KumoButton.vue` 未定义 `NuxtLink` 和 `nuxt.config.ts` 的 `http2Push` 类型错误阻断，同时存在原有 Vue Router Volar 插件警告。

未以真实管理员账号执行线上保存、删除或审核；验证结果不代表实际数据库集成测试。
