# 风光摄影模拟器 · 项目交接文档

> **文档说明**
> 本文档由 `旧对话/` 目录下 8 份历史聊天记录整理生成，覆盖项目自"移动版页面创建"以来所有已记录的开发与修改内容。
> 文中代码片段为对话记录中确认过的关键实现（部分为近似还原），**具体行号与最终参数请以仓库现有文件为准**。
> 整理日期：2026-10-18 ｜ 目录说明：原 `MyOwnApps` 文件夹已取消，其下所有文件现直接位于**项目根目录**（如原 `MyOwnApps/index.html` 现在就是根目录下的 `index.html`）；本文档所有路径均相对项目根目录。

---

## 1. 项目概述

**项目名称**：风光摄影模拟器（在线网页版）

**一句话描述**：一个基于 CesiumJS 的在线风光摄影模拟器，用于模拟全球不同地点、不同时间下的光照、地形与相机拍摄（取景/变焦）情况，帮助摄影爱好者提前"踩点"规划拍摄。

**核心能力**：

| 能力 | 说明 |
|---|---|
| 全球 3D 地球与地形 | CesiumJS 数字地球；默认加载视角定位在中国上空（105°E, 36°N） |
| 时间与光照模拟 | Cesium 时钟驱动；时间面板显示模拟时刻（按北京时间 UTC+8 显示）；"地形光照"开关模拟昼夜光照效果 |
| 相机模拟 | 机位移动（方向键，WASD 排布）、镜头朝向（右遥感/摇杆）、镜头回正、离地高度（0–200m）、变焦倍数（0.5x–16x，含预设变焦），变焦通过相机视场角 FOV 实现 |
| 环境参数 | 能见度遮罩：以相机为中心放置竖直圆筒墙，模拟低能见度下"一定距离外景物不可见" |
| 双端支持 | 电脑版 `final.html`；移动版 `mobile/mobile.html`（上下分屏、触摸操作优化） |
| 辅助功能 | 隐藏 UI（纯净取景模式）、返回主页、常见问题（FAQ）、开发日志页 |

**交互流程概览**：进入页面 →（地球视图）点击选择地点 → 进入相机模式 → 通过方向键/遥感/滑块调整机位与镜头 → 通过时间、环境参数调整光照与天气 → 得到目标取景画面。

---

## 2. 文件结构与职责

> ⚠️ **目录调整（最新）**：原 `MyOwnApps` 文件夹已取消，其下所有文件现直接位于**项目根目录**；唯一保留的子文件夹是 `mobile/`（移动版专用）。以下结构据对话记录与实际目录整理：

```
项目根目录/
├── index.html          主页 / 入口页
├── final.html          电脑版模拟器主页面（自定义 UI 的 HTML/CSS 大多在此）
├── script.js           电脑版主逻辑脚本（final.html 引用，共享，谨慎修改）
├── faq.html            常见问题页
├── logs.html           开发日志页
├── server.js           本地开发服务器
└── mobile/
    ├── mobile.html     移动版模拟器页面（上下分屏布局）
    └── script.js       移动版逻辑脚本（独立维护）
```

| 文件/目录 | 职责 | 修改权限约定 |
|---|---|---|
| `index.html` | 主页 / 入口页 | — |
| `final.html` | **电脑版**模拟器主页面（自定义 UI 的 HTML/CSS 大多在此） | — |
| `script.js` | 电脑版主逻辑脚本（`final.html` 引用）。包含相机控制、时间显示、隐藏 UI、环境参数等大量逻辑 | ⚠️ 影响电脑版全部功能，修改需谨慎 |
| `mobile/mobile.html` | **移动版**模拟器页面（上下分屏布局） | 移动端修改只允许动 `mobile/` 内的文件 |
| `mobile/script.js` | 移动版逻辑脚本（由根目录 `script.js` 复制而来，**独立维护**） | ✅ 移动端所有脚本改动只允许改这一个 |
| `faq.html` | 常见问题页（包含如"地形光照模拟昼夜效果"等说明） | — |
| `logs.html` | 开发日志页（每次改动后需追加日志条目） | — |
| `server.js` | 项目自带的本地开发服务器 | — |

### 修改红线（用户多次强调，务必遵守）

1. **修改移动版时，严禁修改根目录的 `script.js`**（外部共享脚本）。移动版所有逻辑改动只能改 `mobile/script.js`。历史上曾因直接改外部 `script.js` 导致电脑版页面"无法拖动地球、无法选点"，被迫整段回滚。
2. 修改电脑版功能可以改 `script.js`，但必须回归验证已有功能不被破坏（曾发生"全局禁用 Cesium 默认相机控制"导致电脑版无法用鼠标拖动地球的严重事故）。
3. **每次功能改动完成后，在 `logs.html` 顶部追加一条开发日志**，格式为 `日期时间 + 内容`。已有先例：
   > `2026-05-02 14:00 在电脑版新增隐藏UI功能`

---

## 3. 技术栈与运行环境

- **三维引擎**：CesiumJS **1.139**（CDN 引入，历史报错栈中可见：`https://cesium.com/downloads/cesiumjs/releases/1.139/Build/Cesium/Cesium.js`）
- **前端**：纯原生 HTML + CSS + JavaScript，无框架、无构建工具
- **本地运行**：需通过本地 HTTP 服务器访问（Cesium 资源加载需要）。项目自带 `server.js` 启动开发服务器；对话中还使用过 `http-server`、`python -m http.server` 等作为替代。调试中使用的端口有 `8080`、`8081`、`8889` 等
- **移动端适配**：`viewport` meta 标签、Flex 布局、触摸事件（遥感使用 touch 事件）、各 UI 模块使用绝对定位（px 或百分比）

---

## 4. 页面布局说明

### 4.1 电脑版（`final.html`）

单页布局，地球画面全屏，各功能模块以半透明卡片形式绝对定位悬浮在上层：

| 模块 | CSS 选择器 | 位置（最终已知值，供参考） |
|---|---|---|
| 相机控制菜单（变焦等） | `#controls` | 左下角（`bottom: 20px; left: 20px;`），`min-width: 200px` |
| 时间控制模块 | `#timeControls` / `#timeDisplay` | 右上角（`top: 20px; right: 20px;`） |
| 相机信息显示 | `#cameraInfo` | 左上角（`top: 20px; left: 20px;`），紧凑小卡片，**无标题** |
| 高度控制模块 | `#heightSliderContainer` | 右下角（`bottom: 20px; right: 20px;`） |
| 方向键（WASD 排布） | `#directionPad` | `bottom: 120px; left: 40px;`，容器 150×100px，按键 50×50px |
| 右遥感（镜头朝向） | `#rightJoystick` | `bottom: 120px; right: 125px;`（经多轮微调），100×100px，内部圆点 40×40px |
| 镜头回正按钮 | `#resetCameraBtn` | `bottom: 120px; right: 285px;`（与遥感一起被多轮微调） |
| 环境参数菜单（弹窗） | `#envParamsMenu` 等 | 屏幕居中矩形菜单 + 半透明遮罩 |
| 隐藏 UI 退出按钮 | 自定义 | 左上角半透明红色圆形 ×（仅隐藏模式下显示） |

电脑版相机控制菜单中的按钮（同一行，从左到右）：**`环境参数`、`隐藏UI`、`返回主页`、`常见问题`**。

### 4.2 移动版（`mobile/mobile.html`）

页面**等分为上下两部分**：

- **上半部分**：Cesium 地球画面（`flex: 1`；注意 `#cesiumContainer` 与下方控制区的 `z-index` 层级，防止画布覆盖控制区）
- **下半部分**：灰色底色的"操控区"，包含：
  - 第一行：**方向键**（WASD 排布）、**镜头回正按钮**、**右遥感**
  - 其余模块：相机控制菜单（变焦/预设变焦/地形光照开关/主页链接/FAQ 链接）、高度滑块、时间控制

| 模块 | CSS 选择器 | 位置（最终已知值，供参考） |
|---|---|---|
| 相机控制菜单 | `#controls` | 左下角（曾设 `bottom: 1%; left: 2%; width: 50%`） |
| 时间控制 | `#timeControls` | 右下角（`bottom: 20px; right: 20px;`），`padding: 5px 10px`，宽 35%，时间字体 11px |
| 高度滑块 | `#heightSliderContainer` | 右下角、时间模块上方（曾设 `bottom: 100px; right: 20px; width: 200px`） |
| 相机信息 | `#cameraInfo` | 左上角，极小尺寸（约 `top: 5–10px; left: 5–10px`），**无标题** |
| 方向键 | `#directionPad` | WASD 排布：第一行 ↑；第二行 ← ↓ → |
| 右遥感 | `#rightJoystick` | 控制镜头朝向 |
| 镜头回正 | `#resetCameraBtn` | 恢复默认镜头朝向 |
| 地图选点提示框 | `#mapSelectionOverlay` | **位于下半部分操控区内**（不在上半地球区域） |
| 主页/FAQ 链接 | `#controls` 内按钮 | 地形光照开关右侧，文字为"主页""FAQ"，字号 10px，链接 `../index.html`、`../faq.html` |

---

## 5. 功能模块详解

### 5.1 相机系统

**方向键（移动）**：前后左右移动机位。两个版本的排布均已改为类键盘 **WASD** 布局：

```
  ↑
← ↓ →
```

实现要点：`#directionPad` 容器高度从 150px 改 100px；`#btnDown` 的 `top` 从 100px 改为 50px，与左右键同行。按键位置由各按钮的 `top/left` 控制（如 `#btnUp { top: 0; left: 50px; }` 等）。

**右遥感（镜头朝向）**：拖动控制 heading（水平）与 pitch（俯仰）。
- **方向修正**：摇杆向上 = 镜头向上。修正为 `pitch: viewer.camera.pitch - y * rotateSpeed`（原为 `+`，方向是反的）。
- **圆心偏移修复**（重要）：
  - 蓝色圆点必须始终以空心圆环**正中心**为基准做偏移，移动时用 `translate(calc(-50% + Xpx), calc(-50% + Ypx))`，释放时恢复 `translate(-50%, -50%)`（直接 `translate(Xpx, Ypx)` 会以左上角为基准导致偏右下）。
  - 元素在 `display:none` 状态下初始化会取到错误状态；需在 `initializeCameraControls` 中（进入相机模式后）重新获取 `#rightJoystick .joystick-inner` 并显式复位到中心。
  - 开启地形光照后曾导致遥感圆心偏移，已在 `enableTerrainLighting` 中加延时复位逻辑。

**镜头回正按钮**：一键重置镜头朝向。

**高度控制**：滑块调整相机离选取点的相对高度。
- 最终范围 **0–200m**（早期为 0–500m），**线性分布**。
- 刻度线：`25m → 12.5%`、`100m → 50%`、`200m → 100%`。
- 滑块最大值由 HTML `max` 属性控制，实际高度映射逻辑在 `script.js`。

**变焦控制**：滑块调整倍数，**通过相机 FOV 实现**。
- 最终范围 **0.5x–16x**（早期为到 20x），**线性分布**。
- `applyZoom` 中最小 FOV 限制：**3.75°**（对应 16x；60° ÷ 16）。
- 刻度线：`1x ≈ 3.1%`、`5x ≈ 28.1%`、`8x ≈ 46.9%`、`16x = 100%`（0.5x 刻度已按要求删除）。
- 预设变焦按钮：6 个按钮（如"8x"形式），Flex 布局自动换行、每行 3 个；"预设变焦"标题已按要求删除；变焦滑块与预设按钮之间有一根灰色分割线。
- 滑块条样式：`.slider-container` 宽 100%；`#zoomSlider` 设 `width:100%; margin:0; padding:0;`（修复左侧大空缺）。

**相机信息显示**：显示经度、纬度、方位角、俯仰角。**两版均已删除标题**，改为紧凑小卡片：
- 宽约 120px；`padding: 5px 8px`（移动端更小）；`border-radius: 4px`；字体 8–10px；标签宽 50px；行高紧凑、无多余间距。
- ⚠️ **删除该模块的 HTML 会引发渲染崩溃**（脚本会访问其 DOM），详见"踩坑记录"。

### 5.2 时间系统（含最曲折的"北京时间 UTC+8"问题）

- 时间控制卡片：显示模拟时间 + 日期，提供时间调整/`设置时间`（自定义时间输入 `#customTimeInput`）。
- **时间显示口径（最终结论）**：显示 **Cesium 模拟时刻的 UTC+8（北京时间）**，与访问者本地时区无关。
- **正确实现**（移动端与电脑端最终一致）：

```javascript
function updateTimeDisplay() {
    const currentTime = viewer.clock.currentTime;

    // 1) toDate() 返回的 JS Date，其 epoch 与 UTC 对齐（不受本地时区影响）
    const utcDate = Cesium.JulianDate.toDate(currentTime);

    // 2) 在 epoch 上直接 +8 小时，得到北京时间对应的瞬间
    const beijingTime = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);

    // 3) 用 getUTC* 系列方法格式化（此时 UTC 分量 = 北京时间分量）
    const year   = beijingTime.getUTCFullYear();
    const month  = beijingTime.getUTCMonth() + 1;
    const day    = beijingTime.getUTCDate();
    const hour   = beijingTime.getUTCHours();
    const minute = beijingTime.getUTCMinutes();
    const second = beijingTime.getUTCSeconds();

    currentTimeDisplay.textContent =
        `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')} ` +
        `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}`;
}
```

- **错误示范（曾导致显示 UTC+16，务必避开）**：
  1. `toDate()` 后 `+8h`，再用 `toLocaleString('zh-CN')` → 本地时区（UTC+8）再叠加一次 +8 = **UTC+16**；
  2. `toDate()` 后 `+8h`，再用 `getHours()` 等**本地**方法格式化 → 同样重复 +8；
  3. 使用 `Cesium.JulianDate.getYear()/getMonth()/getHours()` 等 API → 该版本 Cesium 中**不存在**（会报 `getYear is not a function`；`getHours()` 语义也与预期不符）。
- 排查中还曾怀疑 `viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date())` 的初始化时区问题——如后续发现"初始时间不对"，可优先检查此处。

### 5.3 地形光照开关

- 打开/关闭 Cesium 地形光照，模拟昼夜效果（"模拟昼夜效果，详见'常见问题'"）。
- 样式规范（两版同步）：
  - 开 = **绿色 `#4CAF50`**；关 = **红色 `#f44336`**；
  - 尺寸 40×20px，滑块圆点 14×14px；滑块位移 16px（移动端）/ 20px（电脑版）；
  - **已删除"开"/"关"文字**；
  - 原始 `<input type="checkbox">` 需隐藏（`opacity:0; width:0; height:0;`），由相邻 `<span>` 呈现开关；
  - ⚠️ 若开关颜色不生效，检查 `<span>` 内联样式是否残留 `background-color`（内联样式会覆盖外部 CSS，历史上正是这个原因）。

```css
/* 关键样式（还原） */
#terrainLightingSwitch:checked + span { background-color: #4CAF50; }        /* 开=绿 */
/* 默认（未选中）状态为红色 #f44336 */
#terrainLightingSwitch:checked + span + span { transform: translateX(16px); } /* 滑块右移（电脑版 20px） */
```

### 5.4 环境参数菜单（仅电脑版 `final.html`）

入口：相机控制菜单中的 **`环境参数`** 按钮 → 打开屏幕居中的矩形菜单（半透明遮罩，点击遮罩外部或右上角红色圆形 × 关闭）。

菜单内容：

1. **标题**：粗体小标题"环境参数调整"；描述"模拟现实可能存在的特殊天气环境情况。"
2. **地形光照**：标题 + 灰色小字（"模拟昼夜效果，详见'常见问题'。"，位于标题下方、开关之前）+ 开关。
3. **能见度遮罩**：
   - 标题"能见度遮罩"（粗细与"地形光照"一致，使用同一样式类）+ 灰色小字"添加遮罩，遮挡一定距离外的物体，模拟低能见度下远处不可见的情况。"
   - 预设按钮：**5km / 10km / 15km / 20km / 25km**
   - 自定义输入框（placeholder：**"自定义能见度(km)"**）+ "设置"按钮；同行右侧为红色按钮 **"关闭遮罩"**
   - 行为：以**相机所在位置**为中心放置一个竖直圆筒墙（随相机移动更新）；
   - 参数：半径 = N 千米，顶部高度 = 地形高度 **+50000m（50km）**，底部高度 = 地形高度 **−5000m**（保证底面始终贴地、不随相机升高而离地），无顶面底面，白色、80% 透明度。

**最终实现（Wall 实体，重要）**：早期用 `Cesium.Cylinder` 实体存在两个问题——① 朝向不对（母线不垂直地面）；② 水平半径单位异常（25km 看起来像 25m）。最终**改用 `Wall`（墙体）实体 + 手动计算圆周点**解决：

```javascript
// 按椭球半径把「米」换算成经纬度偏移，生成圆周点（半径单位准确，与纬度有关）
function computeCirclePoints(radiusMeters, segments = 96) {
    const center = Cesium.Cartographic.fromDegrees(lon, lat, 0);
    const ellipsoid = Cesium.Ellipsoid.WGS84;
    const a = ellipsoid.maximumRadius;
    const lat = center.latitude;
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const dLon = Math.cos(angle) * radiusMeters / (a * Math.cos(lat));
        const dLat = Math.sin(angle) * radiusMeters / a;
        points.push(Cesium.Cartographic.toCartesian(
            Cesium.Cartographic.fromRadians(center.longitude + dLon, center.latitude + dLat, 0)));
    }
    return points;
}

// Wall 实体：minHeight = 地形高 - 5000，maxHeight = 地形高 + 50000
// material: 白色 withAlpha(0.2)（80% 透明度）；96 段平滑
```

> 关键认知：**Cesium 中距离单位一律为米**，km 需 ×1000。

### 5.5 隐藏 UI（仅电脑版）

- 入口：相机控制菜单中 `环境参数` 与 `返回主页` 之间的 **"隐藏UI"** 按钮。
- 行为：隐藏**除 Cesium 官方时间线（页面下方）和右上角官方黑色按钮之外**的所有自定义 UI，包括但不限于：
  `#controls`、`#timeControls`、`#cameraInfo`、`#directionPad`、`#rightJoystick`、`#resetCameraBtn`、`#heightSliderContainer`、`#mapSelectionOverlay`（地图选点提示框）等。
- 隐藏模式下屏幕**左上角**出现 40×40px 的**半透明红色圆形"×"按钮**，点击退出隐藏模式、页面恢复原样。
- 实现：`enterHideMode()` / `exitHideMode()` + `body` 上的 `hidden-mode` 类规则 + 事件监听（位于 `script.js` 末尾，记录位置约 L1039–L1064）。

### 5.6 通用清理项（两版均已处理）

| 项目 | 实现 | 位置 |
|---|---|---|
| 关闭 FPS 显示 | `viewer.scene.debugShowFramesPerSecond = false;`（原为 `true`） | `script.js` 约 L22 |
| 去除版权信息 | `viewer._cesiumWidget._creditContainer.style.display = "none";`（Viewer 初始化之后） | `script.js` |
| 默认视角定位中国上空 | 修改 `initializeGlobe` 中相机初始坐标：`Cesium.Cartesian3.fromDegrees(105, 36, 15000000)`；视角俯视（`pitch: -Cesium.Math.PI_OVER_TWO`） | `script.js` |

> ⚠️ 只设置 `Cesium.Camera.DEFAULT_VIEW_RECTANGLE = Cesium.Rectangle.fromDegrees(80, 22, 130, 50);` **不生效**——会被 `initializeGlobe` 里的 `camera.setView` 覆盖，必须改后者。

---

## 6. 踩坑记录与注意事项（必读）

1. **删除 DOM 元素 → Cesium 渲染崩溃**
   现象：`Cesium.js: An error occurred while rendering. Rendering has stopped. TypeError: Cannot read properties of null (reading 'style') at showCameraControls (script.js:312)`。
   原因：删除 `#cameraInfo` 等 HTML 元素，但脚本仍访问其 `style` 属性。
   对策：删除任何元素前先全局搜索脚本对其 ID 的引用；或保留元素仅做隐藏（`display:none`）；访问前判空。

2. **不要禁用 Cesium 默认相机控制**
   曾为修复移动版"地球自动放大"，在共享 `script.js` 中全局禁用 `viewer.scene.screenSpaceCameraController`，导致电脑版无法用鼠标拖动地球/无法选点。已回滚。任何相机控制改动都要回归双端。

3. **`Cesium.JulianDate` 的 API 陷阱**（时间显示反复出错的根源）
   - `getYear/getMonth/getDayOfMonth/...` 在该版本**不存在**；
   - `getHours()` 等获取的是**本地时间**，不是 UTC；
   - `toDate()` 得到的 Date 的 epoch 与 UTC 对齐，但用 `toLocaleString`/`getHours()` 格式化会引入本机时区；
   - 正确姿势见 §5.2。

4. **遥感（摇杆）三个坑**
   - 圆点偏移：`translate` 必须以居中为基准叠加（`calc(-50% + Xpx)`）；
   - 初始化时机：元素隐藏（`display:none`）时获取的布局状态不可靠，进入相机模式后要重新获取并复位；
   - 方向反了：pitch 用 `-y * rotateSpeed`。

5. **内联样式覆盖外部 CSS**
   地形光照开关的 `<span>` 内联 `background-color:#ccc` 导致外部样式"改了没反应"，需删除内联背景色。

6. **重复 CSS 定义相互覆盖**
   `#cameraInfo` 曾存在两份互相冲突的样式（左上小尺寸 + 右下大尺寸），后者覆盖前者，导致"怎么改都不对"。务必保证每个选择器只有一处定义。

7. **单位问题**
   Cesium 中所有距离单位为**米**；km 要 ×1000。`Cylinder` 实体在椭球面上做水平半径不准确，需要精确地理半径时用 `Wall` + `computeCirclePoints`。

8. **Cesium 版本敏感**
   项目使用 Cesium **1.139**（CDN）。升级版本前需回归验证上述所有 API 用法。

9. **历史回滚事故**
   对话中多次出现"修改引发严重问题 → 用户手动回滚"的情况（布局改崩、渲染停止等）。接手后**强烈建议先接入 Git 版本管理**，每次改动单独提交。

---

## 7. 开发约定与工作流

1. **修改范围**：
   - 移动版 → 只动 `mobile/mobile.html` 和 `mobile/script.js`；
   - 电脑版 → 动 `final.html` 和根目录 `script.js`；
   - 共享的根目录 `script.js` 绝不允许为移动端需求而改。
2. **日志**：每次改动后在 `logs.html` 顶部追加 `日期时间 + 内容` 格式的开发日志。
3. **样式调整方法论**（对话中总结出的经验，供后续调 UI 参考）：
   - 定位：`position: absolute` + `top/bottom/left/right`；注意"`right` 值越大越靠左"；
   - 尺寸：`width/min-width/max-width`、`padding`、`font-size`、`line-height`、`margin-bottom`；
   - 层级：`z-index`（10/100/1000+ 分级）；只对定位元素生效；
   - 圆角：`border-radius`；
   - 元素间距：容器类如 `.control-group` 的 `margin-bottom` 控制板块间距（历史值 15px，可调小更紧凑）。
4. **验证**：本地服务器启动页面 → 控制台无报错 → 双端功能回归。

---

## 8. 已知问题与后续建议

| 类型 | 内容 |
|---|---|
| 注意 | 时间显示逻辑在电脑版与移动版两处脚本中重复存在，修改时需同步（或确认是否已同步） |
| 注意 | 移动版大量 UI 位置为 px 写死，互相遮挡风险高，改版时注意各卡片相对位置 |
| 建议 | 接入 Git 版本管理（历史多次依赖手动回滚） |
| 建议 | 时间显示、滑块映射等重复逻辑可抽取为共享函数 |
| 建议 | 移动版目前没有"环境参数菜单 / 能见度遮罩 / 隐藏UI"（仅电脑版有），如需对齐功能可在此基础上扩展 |
| 待确认 | `viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date())` 初始化的时区语义（见 §5.2 末尾） |

---

## 9. 开发历程时间线（按对话记录整理）

> 仅有一条明确日期记录：`2026-05-02 14:00`（隐藏UI上线）。以下按逻辑顺序排列。

1. **移动版页面创建**：基于 `final.html` 新建 `mobile.html`——上下分屏（上地球/下灰色操控区），确立"不准改 script.js"约定。
2. **移动版布局修复**：修复"地球自动放大"（回滚了共享脚本的改动）、选点提示框移入下半区、控件卡片排版反复调整。
3. **工程结构整理**：`mobile.html` 移入 `mobile/` 文件夹，并复制专属 `script.js`（此后移动端可独立改脚本）。
4. **移动版 UI 精修**：删除/重建相机信息卡片（缩小、去标题）、各模块 px 级定位、时间模块紧凑化、预设变焦按钮紧凑化（每行 3 个）、`control-group` 间距调整。
5. **时间显示修复（移动端 → 电脑端）**：历经 UTC+16 → 直显 UTC → 回归需求的漫长过程，最终落定"epoch +8h + `getUTC*` 格式化"方案。
6. **滑块与刻度体系**：高度滑块加 25m/100m/200m 刻度；变焦滑块刻度 1x/5x/8x/16x；变焦上限 20x→16x、高度上限 500m→200m；非线性分布尝试后全部回退为线性；滑块条宽度与对齐修复。
7. **地形光照开关整改**：绿色开/红色关、缩小尺寸、去文字，移动端与电脑版同步。
8. **遥感修复**：方向翻转修正、圆点居中修复、地形光照联动修复。
9. **电脑版同步改造**：方向键 WASD 排布、相机信息卡片紧凑化（对齐移动版）、遥感与回正按钮位置微调、关闭 FPS、去版权、默认视角中国上空。
10. **电脑版增强功能**：环境参数菜单（地形光照搬入 + 能见度遮罩 Wall 实现 + 多项文案/排版修正）。
11. **隐藏UI功能**：`2026-05-02 14:00` 记入 `logs.html`。
12. **移动版功能增强**：控制区新增"主页/FAQ"链接（缩小字号）、高度 200m 刻度确认、滑块与刻度对齐最终修复。

---

## 附录：历史对话记录索引

| 文件 | 主题摘要 |
|---|---|
| `旧对话/创建 Cesium 移动优化页面.md` | 移动版创建全过程：上下分屏、选点、布局、时间显示（UTC+8 修复）、刻度、遥感修复、电脑版同步项（WASD、时间、相机信息）等（最长、信息量最大） |
| `旧对话/关闭电脑版页面FPS显示.md` | `debugShowFramesPerSecond` 关闭 |
| `旧对话/删除版权信息显示.md` | 去版权 + 默认视角中国上空（两版） |
| `旧对话/添加"隐藏UI"按钮功能.md` | 隐藏UI功能 + 开发日志规范确立 |
| `旧对话/修改移动端地形光照开关.md` | 开关绿/红配色、缩小、去文字（两版） |
| `旧对话/修改移动页面倍数滑块.md` | 变焦上限 16x、去"预设变焦"标题、分割线、高度上限 200m |
| `旧对话/修改Final页面：添加环境参数菜单.md` | 环境参数菜单、能见度遮罩（Wall 实现、贴地、文案调整） |
| `旧对话/移动版页面功能增强.md` | 主页/FAQ 链接、200m 刻度、滑块分布调整与回退、刻度修复 |
