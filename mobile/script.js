// 访问令牌
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlNzJjNDgxMS0wNGIxLTQwMmYtODYzMy03ODQ3Njg4Y2FlYzQiLCJpZCI6Mzk3MjkzLCJpYXQiOjE3NzI1NDc1NDN9.MTjRT7M805SQ81Q0dNgYhenCD-I4SOl3nAbFJOz0Dpg"

// 设置默认视图为中国范围
Cesium.Camera.DEFAULT_VIEW_RECTANGLE = Cesium.Rectangle.fromDegrees(80, 22, 130, 50);

//设置月球大小（通过椭球参数），必须在viewer之前
const moonRadius = Cesium.Math.LUNAR_RADIUS * 10;
Cesium.Ellipsoid.MOON = new Cesium.Ellipsoid( moonRadius, moonRadius, moonRadius);

const viewer = new Cesium.Viewer('cesiumContainer', {
    baseLayerPicker: true,  // 启用底图选择器
    animation: true,        // 初始启用动画控件
    timeline: true,         // 初始启用时间线
    fullscreenButton: false,
    homeButton: false,       // 启用主页按钮
    sceneModePicker: true,  // 启用场景模式选择器
    navigationHelpButton: false,
    geocoder: true,         // 启用地理编码器
    infoBox: false,
    selectionIndicator: false
});

// 去除版权信息
viewer._cesiumWidget._creditContainer.style.display = "none";

//设置太阳大小，必须在viewer之后
viewer.scene.sun.glowFactor = 5.0;

// 全局变量
let isSelectionMode = true; // 初始为选点模式
let selectedPosition = null; // 存储选中的位置
let selectionMarker = null; // 选择点标记
let baseTerrainHeight = 0; // 存储地表基础高度
let terrainInitPromise = null; // 3D地形预加载Promise
let preloadedTerrainPromise = null; // 选点位置的高精度地形采样Promise
let preloadedTerrainHeight = null; // 选点位置已估算/预采样的地形高度
let selectionCounter = 0; // 选点版本计数器，避免并发异步覆盖

// 获取DOM元素
const mapSelectionOverlay = document.getElementById('mapSelectionOverlay');
const selectedLongitude = document.getElementById('selectedLongitude');
const selectedLatitude = document.getElementById('selectedLatitude');
const confirmSelectionBtn = document.getElementById('confirmSelectionBtn');

// 地景数据下载状态底部居中单行小字指示器相关元素与状态
const sceneryLoadingIndicator = document.getElementById('sceneryLoadingIndicator');

const sceneryLoadState = {
    active: false,
    isFlying: false,
    flyStartTime: 0,
    landedTime: 0,
    lastQueuedCount: 0,
    completedTiles: 0,
    displayedPercent: 0,
    stableZeroStartTime: 0,
    hideTimer: null,
    fadeTimer: null,
    listenersAttached: false,
    avgTileBytes: 24 * 1024, // 单个压缩地形/影像瓦片真实均值约 24KB (256x256 JPEG / quantized-mesh)
    actualDownloadedBytes: 0,
    observedRealBytes: 0,
    observedRealCount: 0,
    byteSamples: [], // 滑动时间窗 [{ time, bytes }] 用于计算真实网络吞吐率
    smoothedSpeedMBps: 0,
    resourceCursor: 0
};

// 相机控制相关元素
const controls = document.getElementById('controls');
const timeControls = document.getElementById('timeControls');
const cameraInfo = document.getElementById('cameraInfo');
const directionPad = document.getElementById('directionPad');
const rightJoystick = document.getElementById('rightJoystick');
const resetCameraBtn = document.getElementById('resetCameraBtn');
const heightSliderContainer = document.getElementById('heightSliderContainer');

const zoomSlider = document.getElementById('zoomSlider');
const zoomValue = document.getElementById('zoomValue');
const btnZoom8x = document.getElementById('btnZoom8x');
const btnZoom5x = document.getElementById('btnZoom5x');
const btnZoom2x = document.getElementById('btnZoom2x');
const btnZoom1_5x = document.getElementById('btnZoom1_5x');
const btnZoom1x = document.getElementById('btnZoom1x');
const btnZoom05x = document.getElementById('btnZoom05x');
const terrainLightingSwitch = document.getElementById('terrainLightingSwitch');
const heightSlider = document.getElementById('heightSlider');
const heightValue = document.getElementById('heightValue');

// 时间控制元素
const currentTimeDisplay = document.getElementById('currentTime');
const customTimeInput = document.getElementById('customTimeInput');
const btnSetCustomTime = document.getElementById('btnSetCustomTime');

// 相机信息显示元素
const longitudeValue = document.getElementById('longitudeValue');
const latitudeValue = document.getElementById('latitudeValue');
const headingValue = document.getElementById('headingValue');
const pitchValue = document.getElementById('pitchValue');

// 方向键元素
const btnUp = document.getElementById('btnUp');
const btnLeft = document.getElementById('btnLeft');
const btnDown = document.getElementById('btnDown');
const btnRight = document.getElementById('btnRight');

// 遥感控制变量
let rightJoystickInner = document.querySelector('#rightJoystick .joystick-inner');

// 初始化：显示完整地球
function initializeGlobe() {
    console.log("初始化完整地球视图...");
    
    // 确保Cesium官方时间线和动画控件可见
    ensureCesiumWidgetsVisible();
    
    // 设置相机到中国上空
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(105, 36, 15000000), // 中国中心位置
        orientation: {
            heading: 0,
            pitch: -Cesium.Math.PI_OVER_TWO, // 俯视地球
            roll: 0
        }
    });
    
    // 显示选点提示框（已经在左上角）
    mapSelectionOverlay.style.display = 'block';
    
    // 设置点击事件监听器
    setupMapSelection();
    
}

// 确保Cesium官方时间线和动画控件可见
function ensureCesiumWidgetsVisible() {
    console.log("确保Cesium官方控件可见...");
    
    // 等待Cesium控件初始化完成
    setTimeout(() => {
        // 查找并显示时间线容器
        const timelineContainer = document.querySelector('.cesium-timeline-container');
        if (timelineContainer) {
            timelineContainer.style.display = 'block';
            timelineContainer.style.visibility = 'visible';
            timelineContainer.style.opacity = '1';
            console.log("时间线容器已显示");
        } else {
            console.log("未找到时间线容器");
        }
        
        // 查找并显示动画容器
        const animationContainer = document.querySelector('.cesium-animation-container');
        if (animationContainer) {
            animationContainer.style.display = 'block';
            animationContainer.style.visibility = 'visible';
            animationContainer.style.opacity = '1';
            console.log("动画容器已显示");
        } else {
            console.log("未找到动画容器");
        }
        
        // 确保时间线正常工作
        if (viewer.timeline) {
            viewer.timeline.container.style.display = 'block';
            viewer.timeline.container.style.visibility = 'visible';
            viewer.timeline.container.style.opacity = '1';
        }
        
        if (viewer.animation) {
            viewer.animation.container.style.display = 'block';
            viewer.animation.container.style.visibility = 'visible';
            viewer.animation.container.style.opacity = '1';
        }
        
        // 确保场景模式选择器可见
        if (viewer.sceneModePicker) {
            viewer.sceneModePicker.container.style.display = 'block';
            viewer.sceneModePicker.container.style.visibility = 'visible';
            viewer.sceneModePicker.container.style.opacity = '1';
        }
        
        // 确保地理编码器可见
        if (viewer.geocoder) {
            viewer.geocoder.container.style.display = 'block';
            viewer.geocoder.container.style.visibility = 'visible';
            viewer.geocoder.container.style.opacity = '1';
        }
    }, 500); // 延迟500ms确保Cesium已完全初始化
}

// 设置地图选点功能
function setupMapSelection() {
    console.log("设置地图选点功能...");
    
    // 创建屏幕空间事件处理器
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    
    // 设置左键点击事件
    handler.setInputAction(function(click) {
        if (!isSelectionMode) return;
        
        // 获取点击位置的世界坐标
        const ray = viewer.camera.getPickRay(click.position);
        if (!ray) return;
        
        const intersection = viewer.scene.globe.pick(ray, viewer.scene);
        if (Cesium.defined(intersection)) {
            // 获取选中点的坐标
            const cartographic = Cesium.Cartographic.fromCartesian(intersection);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            
            // 存储选中位置
            selectedPosition = intersection;
            
            // 更新显示信息（只显示经纬度，不显示海拔）
            selectedLongitude.textContent = longitude.toFixed(6) + '°';
            selectedLatitude.textContent = latitude.toFixed(6) + '°';
            
            // 启用确认按钮
            confirmSelectionBtn.disabled = false;
            
            // 添加或更新选择点标记
            addSelectionMarker(intersection);
            
            // 优先获取当前已有瓦片高程，若不可用则使用射线拾取高程
            const globeHeight = viewer.scene.globe.getHeight(cartographic);
            const estimatedHeight = (typeof globeHeight === 'number' && !isNaN(globeHeight)) 
                ? globeHeight 
                : ((cartographic.height && !isNaN(cartographic.height)) ? cartographic.height : 0);
            preloadedTerrainHeight = estimatedHeight;
            
            // 记录版本号防止多次选点请求竞态覆盖
            const currentSelectionId = ++selectionCounter;
            
            // 立即在后台触发最高精度高程预采样，在用户点击确认按钮的时间内完成
            preloadedTerrainPromise = (async () => {
                try {
                    await initializeTerrain();
                    if (viewer.terrainProvider && !(viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider)) {
                        const terrainSample = await Cesium.sampleTerrainMostDetailed(
                            viewer.terrainProvider, 
                            [cartographic]
                        );
                        if (currentSelectionId === selectionCounter && terrainSample && terrainSample[0] && typeof terrainSample[0].height === 'number') {
                            preloadedTerrainHeight = terrainSample[0].height;
                            return terrainSample[0].height;
                        }
                    }
                } catch (e) {
                    console.log("后台预采样高精度地形高度失败，将采用拾取高度:", e);
                }
                return estimatedHeight;
            })();
            
            console.log(`选中位置: 经度 ${longitude.toFixed(6)}°, 纬度 ${latitude.toFixed(6)}°`);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    // 确认选择按钮事件
    confirmSelectionBtn.addEventListener('click', function() {
        if (selectedPosition) {
            startCameraMode(selectedPosition);
        }
    });
}

// 添加选择点标记 - 修复API错误
function addSelectionMarker(position) {
    // 移除旧的标记
    if (selectionMarker) {
        selectionMarker.remove();
    }
    
    // 创建新的标记
    selectionMarker = document.createElement('div');
    selectionMarker.className = 'selection-marker';
    document.body.appendChild(selectionMarker);
    
    // 将3D坐标转换为屏幕坐标 - 使用正确的API
    const screenPosition = Cesium.SceneTransforms.worldToWindowCoordinates(
        viewer.scene, 
        position
    );
    
    if (screenPosition) {
        selectionMarker.style.left = screenPosition.x + 'px';
        selectionMarker.style.top = screenPosition.y + 'px';
    }
    
    // 监听相机变化，更新标记位置
    viewer.scene.postRender.addEventListener(function updateMarkerPosition() {
        if (selectionMarker && selectedPosition) {
            const newScreenPosition = Cesium.SceneTransforms.worldToWindowCoordinates(
                viewer.scene, 
                selectedPosition
            );
            
            if (newScreenPosition) {
                selectionMarker.style.left = newScreenPosition.x + 'px';
                selectionMarker.style.top = newScreenPosition.y + 'px';
            }
        }
    });
}

// 采集新增网络资源字节数（仅统计真实网络传输体积，严禁使用解压后内存体积或倍率外推）
function collectNewSceneryResourceBytes() {
    if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') return 0;
    const entries = performance.getEntriesByType('resource');
    const now = performance.now();
    let newlyCompletedCount = 0;

    for (let i = sceneryLoadState.resourceCursor; i < entries.length; i++) {
        const entry = entries[i];
        const realBytes = entry.encodedBodySize > 0
            ? entry.encodedBodySize
            : (entry.transferSize > 0 ? entry.transferSize : 0);

        let entryBytes = 0;
        if (realBytes > 0) {
            entryBytes = realBytes;
            const clampedTileBytes = Math.max(8 * 1024, Math.min(80 * 1024, realBytes));
            sceneryLoadState.observedRealBytes += clampedTileBytes;
            sceneryLoadState.observedRealCount += 1;
            sceneryLoadState.avgTileBytes = Math.round(
                sceneryLoadState.observedRealBytes / sceneryLoadState.observedRealCount
            );
        } else {
            entryBytes = sceneryLoadState.avgTileBytes;
        }

        sceneryLoadState.actualDownloadedBytes += entryBytes;
        sceneryLoadState.completedTiles += 1;
        sceneryLoadState.byteSamples.push({ time: now, bytes: entryBytes });
        newlyCompletedCount += 1;
    }

    sceneryLoadState.resourceCursor = entries.length;
    return newlyCompletedCount;
}

// 格式化 MB 数值：小于 10MB 显示两位小数（如 0.48MB），大于等于 10MB 显示一位小数
function formatSceneryMB(val) {
    return val < 10 ? val.toFixed(2) : val.toFixed(1);
}

// 更新底部居中地景数据下载状态单行小文字：
// 格式：“正在下载地景数据 - xxMB/xxMB (xx%) - xxMB/s ETA mm:ss”
function updateSceneryLoadingUI(forceComplete = false) {
    collectNewSceneryResourceBytes();

    const now = performance.now();
    const downloadedMB = sceneryLoadState.actualDownloadedBytes / (1024 * 1024);

    let remainingTiles = sceneryLoadState.lastQueuedCount;
    if (!forceComplete) {
        if (sceneryLoadState.isFlying) {
            remainingTiles = Math.max(remainingTiles, 16);
        } else if (now - sceneryLoadState.landedTime < 450 && remainingTiles === 0 && sceneryLoadState.completedTiles === 0) {
            remainingTiles = 8;
        }
    } else {
        remainingTiles = 0;
    }

    const remainingMB = (remainingTiles * sceneryLoadState.avgTileBytes) / (1024 * 1024);
    const totalMB = forceComplete ? downloadedMB : (downloadedMB + remainingMB);

    let clampedPercent = 0;
    if (forceComplete) {
        clampedPercent = 100;
    } else if (totalMB > 0.0001) {
        const rawPercent = Math.round((downloadedMB / totalMB) * 100);
        if (sceneryLoadState.isFlying) {
            clampedPercent = Math.min(85, Math.max(0, rawPercent));
        } else if (remainingTiles > 0) {
            clampedPercent = Math.min(99, Math.max(0, rawPercent));
        } else {
            clampedPercent = Math.min(99, Math.max(sceneryLoadState.displayedPercent, rawPercent));
        }
    }
    sceneryLoadState.displayedPercent = clampedPercent;

    const windowMs = 1500;
    while (sceneryLoadState.byteSamples.length > 0 && (now - sceneryLoadState.byteSamples[0].time) > windowMs) {
        sceneryLoadState.byteSamples.shift();
    }

    let windowBytes = 0;
    for (let i = 0; i < sceneryLoadState.byteSamples.length; i++) {
        windowBytes += sceneryLoadState.byteSamples[i].bytes;
    }

    const elapsedSec = Math.max(0.25, Math.min(windowMs / 1000, (now - sceneryLoadState.flyStartTime) / 1000));
    const measuredSpeedMBps = (windowBytes / (1024 * 1024)) / elapsedSec;

    if (sceneryLoadState.smoothedSpeedMBps <= 0.001) {
        sceneryLoadState.smoothedSpeedMBps = measuredSpeedMBps;
    } else {
        sceneryLoadState.smoothedSpeedMBps = sceneryLoadState.smoothedSpeedMBps * 0.6 + measuredSpeedMBps * 0.4;
    }

    const displaySpeed = Math.max(0, sceneryLoadState.smoothedSpeedMBps);
    const speedForEta = displaySpeed > 0.05 ? displaySpeed : 0.35;
    const etaTotalSeconds = (forceComplete || remainingMB <= 0.005)
        ? 0
        : Math.max(1, Math.min(3599, Math.ceil(remainingMB / speedForEta)));
    const etaMin = String(Math.floor(etaTotalSeconds / 60)).padStart(2, '0');
    const etaSec = String(etaTotalSeconds % 60).padStart(2, '0');

    if (sceneryLoadingIndicator) {
        sceneryLoadingIndicator.textContent = `正在下载地景数据 - ${formatSceneryMB(downloadedMB)}MB/${formatSceneryMB(totalMB)}MB (${clampedPercent}%) - ${formatSceneryMB(displaySpeed)}MB/s ETA ${etaMin}:${etaSec}`;
    }
}

// 完成地景加载并平滑隐藏指示器
function completeSceneryLoadingMonitor() {
    if (!sceneryLoadState.active) return;
    sceneryLoadState.active = false;
    sceneryLoadState.stableZeroStartTime = 0;
    updateSceneryLoadingUI(true);

    if (sceneryLoadState.hideTimer) clearTimeout(sceneryLoadState.hideTimer);
    if (sceneryLoadState.fadeTimer) clearTimeout(sceneryLoadState.fadeTimer);

    sceneryLoadState.hideTimer = setTimeout(() => {
        if (sceneryLoadingIndicator) {
            sceneryLoadingIndicator.style.opacity = '0';
        }
        sceneryLoadState.fadeTimer = setTimeout(() => {
            if (sceneryLoadingIndicator && !sceneryLoadState.active) {
                sceneryLoadingIndicator.style.display = 'none';
            }
        }, 260);
    }, 220);
}

// 根据真实瓦片队列计算并刷新加载百分比与下载速率指标
function recalculateSceneryProgress() {
    if (!sceneryLoadState.active) return;
    updateSceneryLoadingUI(false);
}

// 绑定 Cesium 瓦片加载进度与帧渲染监听（仅绑定一次）
function ensureSceneryLoadingListeners() {
    if (sceneryLoadState.listenersAttached) return;
    sceneryLoadState.listenersAttached = true;

    if (typeof performance !== 'undefined' && typeof performance.setResourceTimingBufferSize === 'function') {
        try {
            performance.setResourceTimingBufferSize(2000);
        } catch (e) {}
    }

    viewer.scene.globe.tileLoadProgressEvent.addEventListener(function(queuedTileCount) {
        if (!isSelectionMode && !sceneryLoadState.active && queuedTileCount >= 4) {
            startSceneryLoadingMonitor(false, queuedTileCount);
            return;
        }

        if (!sceneryLoadState.active) {
            sceneryLoadState.lastQueuedCount = queuedTileCount;
            return;
        }

        const newlyRecorded = collectNewSceneryResourceBytes();

        if (!sceneryLoadState.isFlying && newlyRecorded === 0 && queuedTileCount < sceneryLoadState.lastQueuedCount) {
            const delta = sceneryLoadState.lastQueuedCount - queuedTileCount;
            if (delta <= 3) {
                const fallbackBytes = delta * sceneryLoadState.avgTileBytes;
                sceneryLoadState.actualDownloadedBytes += fallbackBytes;
                sceneryLoadState.completedTiles += delta;
                sceneryLoadState.byteSamples.push({ time: performance.now(), bytes: fallbackBytes });
            }
        }

        sceneryLoadState.lastQueuedCount = queuedTileCount;

        if (queuedTileCount > 0) {
            sceneryLoadState.stableZeroStartTime = 0;
        }

        recalculateSceneryProgress();
    });

    viewer.scene.postRender.addEventListener(function() {
        if (!sceneryLoadState.active) return;

        if (sceneryLoadState.isFlying) {
            recalculateSceneryProgress();
            return;
        }

        const now = performance.now();
        if (now - sceneryLoadState.landedTime < 450) {
            recalculateSceneryProgress();
            return;
        }

        const allLoaded = viewer.scene.globe.tilesLoaded && sceneryLoadState.lastQueuedCount === 0;
        if (allLoaded) {
            if (sceneryLoadState.stableZeroStartTime === 0) {
                sceneryLoadState.stableZeroStartTime = now;
                recalculateSceneryProgress();
            } else if (now - sceneryLoadState.stableZeroStartTime >= 380) {
                completeSceneryLoadingMonitor();
            }
        } else {
            sceneryLoadState.stableZeroStartTime = 0;
            recalculateSceneryProgress();
        }
    });
}

// 启动地景数据下载监控并在底部正中央显示单行小字指示器
function startSceneryLoadingMonitor(isFlying = true, initialQueued = 0) {
    ensureSceneryLoadingListeners();

    if (sceneryLoadState.hideTimer) {
        clearTimeout(sceneryLoadState.hideTimer);
        sceneryLoadState.hideTimer = null;
    }
    if (sceneryLoadState.fadeTimer) {
        clearTimeout(sceneryLoadState.fadeTimer);
        sceneryLoadState.fadeTimer = null;
    }

    const now = performance.now();
    sceneryLoadState.active = true;
    sceneryLoadState.isFlying = isFlying;
    sceneryLoadState.flyStartTime = now;
    sceneryLoadState.landedTime = isFlying ? 0 : now;
    sceneryLoadState.lastQueuedCount = initialQueued;
    sceneryLoadState.completedTiles = 0;
    sceneryLoadState.displayedPercent = 0;
    sceneryLoadState.stableZeroStartTime = 0;
    sceneryLoadState.actualDownloadedBytes = 0;
    sceneryLoadState.byteSamples = [];
    sceneryLoadState.smoothedSpeedMBps = 0;
    sceneryLoadState.resourceCursor = (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function')
        ? performance.getEntriesByType('resource').length
        : 0;

    updateSceneryLoadingUI(false);

    if (sceneryLoadingIndicator) {
        sceneryLoadingIndicator.style.display = 'block';
        sceneryLoadingIndicator.style.opacity = '1';
    }
}

// 开始相机模式
async function startCameraMode(position) {
    console.log("开始相机模式...");
    
    // 退出选点模式
    isSelectionMode = false;
    
    // 立即给用户直接的交互反馈
    if (confirmSelectionBtn) {
        confirmSelectionBtn.textContent = "正在进入机位...";
        confirmSelectionBtn.disabled = true;
    }
    
    // 移除选择点标记
    if (selectionMarker) {
        selectionMarker.remove();
        selectionMarker = null;
    }
    
    // 隐藏选点提示框
    mapSelectionOverlay.style.display = 'none';

    // 启动地景信息下载真实进度监控指示器
    startSceneryLoadingMonitor(true);
    
    // 获取选中点的地理坐标
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    
    // 优先采用预采样得到的高程，或已有瓦片/拾取点高度（无需等待网络即可立即起飞）
    let terrainHeight = preloadedTerrainHeight;
    if (terrainHeight === null || isNaN(terrainHeight)) {
        const globeHeight = viewer.scene.globe.getHeight(cartographic);
        terrainHeight = (typeof globeHeight === 'number' && !isNaN(globeHeight)) 
            ? globeHeight 
            : ((cartographic.height && !isNaN(cartographic.height)) ? cartographic.height : 0);
    }
    if (terrainHeight < -500) terrainHeight = 0;
    baseTerrainHeight = terrainHeight;
    
    // 计算飞行目标位置（地面高度+25米）
    const targetHeight = terrainHeight + 25;
    const targetPosition = Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        targetHeight
    );
    
    // 立即启动飞行动画：
    // 使用 QUADRATIC_IN_OUT 缓动和 2.0 秒时长，使镜头从第 1 帧起就具有清晰的飞入速度感，
    // 消除默认 EXPONENTIAL 缓动在前 1.5 秒地球看似静止未动的不良感知。
    viewer.camera.flyTo({
        destination: targetPosition,
        orientation: {
            heading: Cesium.Math.toRadians(0),    // 朝正北
            pitch: Cesium.Math.toRadians(0),      // 俯仰角为0（水平）
            roll: 0.0
        },
        duration: 2.0, // 缩短至2秒，起飞与降落干脆利落
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        complete: function() {
            sceneryLoadState.isFlying = false;
            sceneryLoadState.landedTime = performance.now();
            sceneryLoadState.stableZeroStartTime = 0;

            // 落地瞬间立即展示并激活操作控件，绝不等待任何异步网络 I/O，消除二次卡死
            showCameraControls();
            initializeCameraControls();
            adjustHeight(25);
            
            // 后台异步校准精确地表高度（若之前高精度采样稍慢完成，则无缝平滑校准）
            if (preloadedTerrainPromise) {
                preloadedTerrainPromise.then(detailedHeight => {
                    if (detailedHeight !== null && !isNaN(detailedHeight) && Math.abs(detailedHeight - baseTerrainHeight) > 1) {
                        baseTerrainHeight = detailedHeight;
                        adjustHeight(currentHeight || 25);
                        sceneryLoadState.stableZeroStartTime = 0;
                    }
                }).catch(() => {});
            }
            
            console.log("已进入相机模式");
        },
        cancel: function() {
            sceneryLoadState.isFlying = false;
            sceneryLoadState.landedTime = performance.now();
            sceneryLoadState.stableZeroStartTime = 0;
        }
    });
}

// 显示相机控制界面
function showCameraControls() {
    controls.style.display = 'block';
    timeControls.style.display = 'block';
    cameraInfo.style.display = 'block';
    directionPad.style.display = 'block';
    rightJoystick.style.display = 'block';
    resetCameraBtn.style.display = 'block';
    heightSliderContainer.style.display = 'block';
    
    // 确保Cesium官方时间线和动画控件可见
    ensureCesiumWidgetsVisible();
    
    // 确保时间线正常工作
    if (viewer.timeline) {
        viewer.timeline.container.style.display = 'block';
        viewer.timeline.container.style.visibility = 'visible';
        viewer.timeline.container.style.opacity = '1';
    }
    
    if (viewer.animation) {
        viewer.animation.container.style.display = 'block';
        viewer.animation.container.style.visibility = 'visible';
        viewer.animation.container.style.opacity = '1';
    }
}

// 根据知识库内容，使用正确的3D地形方法
async function initializeTerrain() {
    if (terrainInitPromise) {
        return terrainInitPromise;
    }
    
    terrainInitPromise = (async () => {
        try {
            // 使用 createWorldTerrainAsync 创建地形提供者，预先启用法线数据实现光照即开即关
            const terrainProvider = await Cesium.createWorldTerrainAsync({
                requestVertexNormals: true,   // 预加载顶点法线，使地形光照切换 0ms 瞬间响应
                requestWaterMask: false       // 默认不启用水体效果
            });
            viewer.terrainProvider = terrainProvider;
            console.log("3D地形已加载");
            return terrainProvider;
        } catch (error) {
            console.log("地形加载失败:", error);
            // 如果地形加载失败，使用椭球体作为替代
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
            return viewer.terrainProvider;
        }
    })();
    
    return terrainInitPromise;
}

// 变焦控制变量
const defaultFov = Cesium.Math.toRadians(60);
let currentZoom = 1.0;
let currentHeight = 25; // 初始高度25米

// 应用变焦效果
function applyZoom(zoomFactor) {
    if (!viewer.scene.camera) return;
    
    currentZoom = zoomFactor;
    
    // 计算新的视野角
    const newFov = defaultFov / zoomFactor;
    const clampedFov = Cesium.Math.clamp(newFov, 
        Cesium.Math.toRadians(3.75),  // 对应16倍变焦
        Cesium.Math.toRadians(120)); // 对应0.5倍变焦
    
    // 应用新的FOV
    if (viewer.scene.camera.frustum instanceof Cesium.PerspectiveFrustum) {
        viewer.scene.camera.frustum.fov = clampedFov;
    }
    
    // 更新UI显示
    zoomValue.textContent = zoomFactor.toFixed(1) + 'x';
    zoomSlider.value = zoomFactor;
}

// 调整相机高度
async function adjustHeight(height) {
    if (!viewer.scene.camera) return;
    
    currentHeight = height;
    heightValue.textContent = height + 'm';
    heightSlider.value = height;
    
    try {
        // 获取当前相机位置
        const position = viewer.scene.camera.positionWC;
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        
        // 如果是第一次调整高度，获取地表高度
        if (baseTerrainHeight === 0) {
            if (viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) {
                baseTerrainHeight = 0;
            } else {
                const terrainSample = await Cesium.sampleTerrainMostDetailed(
                    viewer.terrainProvider, 
                    [cartographic]
                );
                baseTerrainHeight = terrainSample[0].height;
            }
        }
        
        // 计算新的高度（地表高度 + 离地高度）
        const newHeight = baseTerrainHeight + height;
        
        // 设置新的相机位置，保持朝向不变
        const newPosition = Cesium.Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            newHeight
        );
        
        // 获取当前相机朝向
        const camera = viewer.scene.camera;
        const heading = camera.heading;
        const pitch = camera.pitch;
        const roll = camera.roll;
        
        // 使用正确的API设置相机
        viewer.camera.setView({
            destination: newPosition,
            orientation: {
                heading: heading,
                pitch: pitch,
                roll: roll
            }
        });
    } catch (error) {
        console.log("调整高度失败:", error);
    }
}

// 镜头回正函数 - 修改为只归零俯仰角，保持方位角不变
function resetCameraOrientation() {
    if (!viewer.scene.camera) return;
    
    try {
        // 获取当前相机位置
        const position = viewer.scene.camera.positionWC;
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        
        // 计算当前高度
        const currentHeight = cartographic.height;
        
        // 获取当前方位角（保持原方位角不变）
        const camera = viewer.scene.camera;
        const currentHeading = camera.heading; // 保持当前方位角
        
        // 设置相机位置，保持方位角不变，只将俯仰角归零
        const newPosition = Cesium.Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            currentHeight
        );
        
        viewer.camera.setView({
            destination: newPosition,
            orientation: {
                heading: currentHeading,    // 保持当前方位角不变
                pitch: 0.0,                 // 俯仰角归零（水平）
                roll: 0.0
            }
        });
        
        console.log("镜头已回正：俯仰角归零，方位角保持" + Cesium.Math.toDegrees(currentHeading).toFixed(1) + "°");
    } catch (error) {
        console.log("镜头回正失败:", error);
    }
}

// 更新相机信息显示
function updateCameraInfo() {
    if (!viewer.scene.camera) return;
    
    try {
        // 获取相机位置
        const position = viewer.scene.camera.positionWC;
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        
        // 转换为度
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        
        // 获取相机朝向
        const camera = viewer.scene.camera;
        const heading = Cesium.Math.toDegrees(camera.heading);
        const pitch = Cesium.Math.toDegrees(camera.pitch);
        
        // 更新显示
        longitudeValue.textContent = longitude.toFixed(3) + '°';
        latitudeValue.textContent = latitude.toFixed(3) + '°';
        headingValue.textContent = heading.toFixed(1) + '°';
        pitchValue.textContent = pitch.toFixed(1) + '°';
    } catch (error) {
        console.log("更新相机信息失败:", error);
    }
}

// 地形光照控制 - 瞬时开启与关闭（已预加载法线，无需网络重新拉取，0ms即刻生效）
function enableTerrainLighting() {
    try {
        viewer.scene.globe.enableLighting = true;
        console.log("地形光照已开启（即刻生效）");
        
        // 重新初始化遥杆，确保位置正确
        setTimeout(() => {
            rightJoystickInner = document.querySelector('#rightJoystick .joystick-inner');
            if (rightJoystickInner) {
                rightJoystickInner.style.transform = 'translate(-50%, -50%)';
            }
        }, 50);
    } catch (error) {
        console.log("开启地形光照失败:", error);
    }
}

function disableTerrainLighting() {
    try {
        viewer.scene.globe.enableLighting = false;
        console.log("地形光照已关闭（即刻生效）");
    } catch (error) {
        console.log("关闭地形光照失败:", error);
    }
}

// 遥感控制函数
function setupJoystick(joystickId, innerElement, callback) {
    const joystick = document.getElementById(joystickId);
    let isActive = false;
    let startPos = { x: 0, y: 0 };
    let currentPos = { x: 0, y: 0 };
    
    // 开始控制
    const startControl = function(clientX, clientY) {
        isActive = true;
        const rect = joystick.getBoundingClientRect();
        startPos.x = clientX - rect.left;
        startPos.y = clientY - rect.top;
        currentPos.x = 0;
        currentPos.y = 0;
    };
    
    // 更新控制
    const updateControl = function(clientX, clientY) {
        if (!isActive) return;
        
        const rect = joystick.getBoundingClientRect();
        const currentX = clientX - rect.left;
        const currentY = clientY - rect.top;
        
        const deltaX = currentX - startPos.x;
        const deltaY = currentY - startPos.y;
        
        // 限制移动范围
        const maxRadius = rect.width / 2 - 25;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        let limitedX = deltaX;
        let limitedY = deltaY;
        
        if (distance > maxRadius) {
            limitedX = (deltaX / distance) * maxRadius;
            limitedY = (deltaY / distance) * maxRadius;
        }
        
        // 更新遥感位置
        if (innerElement) {
            // 确保在居中位置的基础上添加偏移
            innerElement.style.transform = `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;
        }
        
        // 归一化到 -1 到 1
        currentPos.x = limitedX / maxRadius;
        currentPos.y = limitedY / maxRadius;
        
        // 调用回调函数
        if (callback) {
            callback(currentPos.x, currentPos.y);
        }
    };
    
    // 结束控制
    const endControl = function() {
        isActive = false;
        if (innerElement) {
            innerElement.style.transform = 'translate(-50%, -50%)';
        }
        currentPos.x = 0;
        currentPos.y = 0;
        if (callback) {
            callback(0, 0);
        }
    };
    
    // 鼠标事件
    joystick.addEventListener('mousedown', function(e) {
        e.preventDefault();
        startControl(e.clientX, e.clientY);
    });
    
    document.addEventListener('mousemove', function(e) {
        updateControl(e.clientX, e.clientY);
    });
    
    document.addEventListener('mouseup', endControl);
    
    // 触摸事件
    joystick.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        startControl(touch.clientX, touch.clientY);
    });
    
    joystick.addEventListener('touchmove', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        updateControl(touch.clientX, touch.clientY);
    });
    
    joystick.addEventListener('touchend', endControl);
}

// 初始化相机控制
function initializeCameraControls() {
    console.log("初始化相机控制...");
    
    // 方向键控制
    let moveInterval = null;
    let moveDirection = null;
    
    const startMove = function(direction) {
        if (moveInterval) return;
        moveDirection = direction;
        moveInterval = setInterval(function() {
            const moveSpeed = 0.5; // 移动速度
            switch(moveDirection) {
                case 'up':
                    viewer.camera.moveForward(moveSpeed);
                    break;
                case 'down':
                    viewer.camera.moveBackward(moveSpeed);
                    break;
                case 'left':
                    viewer.camera.moveLeft(moveSpeed);
                    break;
                case 'right':
                    viewer.camera.moveRight(moveSpeed);
                    break;
            }
        }, 16); // 约60fps
    };
    
    const stopMove = function() {
        if (moveInterval) {
            clearInterval(moveInterval);
            moveInterval = null;
            moveDirection = null;
        }
    };
    
    // 方向键事件
    btnUp.addEventListener('mousedown', function() { startMove('up'); });
    btnUp.addEventListener('mouseup', stopMove);
    btnUp.addEventListener('mouseleave', stopMove);
    btnUp.addEventListener('touchstart', function(e) { e.preventDefault(); startMove('up'); });
    btnUp.addEventListener('touchend', stopMove);
    
    btnDown.addEventListener('mousedown', function() { startMove('down'); });
    btnDown.addEventListener('mouseup', stopMove);
    btnDown.addEventListener('mouseleave', stopMove);
    btnDown.addEventListener('touchstart', function(e) { e.preventDefault(); startMove('down'); });
    btnDown.addEventListener('touchend', stopMove);
    
    btnLeft.addEventListener('mousedown', function() { startMove('left'); });
    btnLeft.addEventListener('mouseup', stopMove);
    btnLeft.addEventListener('mouseleave', stopMove);
    btnLeft.addEventListener('touchstart', function(e) { e.preventDefault(); startMove('left'); });
    btnLeft.addEventListener('touchend', stopMove);
    
    btnRight.addEventListener('mousedown', function() { startMove('right'); });
    btnRight.addEventListener('mouseup', stopMove);
    btnRight.addEventListener('mouseleave', stopMove);
    btnRight.addEventListener('touchstart', function(e) { e.preventDefault(); startMove('right'); });
    btnRight.addEventListener('touchend', stopMove);
    
    // 镜头回正按钮
    resetCameraBtn.addEventListener('click', resetCameraOrientation);
    
    // 右遥感控制镜头朝向
    // 重新初始化遥杆内部元素，确保能正确获取
    rightJoystickInner = document.querySelector('#rightJoystick .joystick-inner');
    if (rightJoystickInner) {
        // 确保遥杆在中心位置
        rightJoystickInner.style.transform = 'translate(-50%, -50%)';
    }
    setupJoystick('rightJoystick', rightJoystickInner, function(x, y) {
        const rotateSpeed = 0.02;
        viewer.camera.setView({
            orientation: {
                heading: viewer.camera.heading + x * rotateSpeed,
                pitch: Cesium.Math.clamp(viewer.camera.pitch - y * rotateSpeed, -Cesium.Math.PI_OVER_TWO, Cesium.Math.PI_OVER_TWO),
                roll: 0.0
            }
        });
    });
    
    // 预设变焦按钮
    btnZoom8x.addEventListener('click', function() { applyZoom(8.0); });
    btnZoom5x.addEventListener('click', function() { applyZoom(5.0); });
    btnZoom2x.addEventListener('click', function() { applyZoom(2.0); });
    btnZoom1_5x.addEventListener('click', function() { applyZoom(1.5); });
    btnZoom1x.addEventListener('click', function() { applyZoom(1.0); });
    btnZoom05x.addEventListener('click', function() { applyZoom(0.5); });
    
    // 地形光照开关
    terrainLightingSwitch.addEventListener('change', function() {
        if (this.checked) {
            enableTerrainLighting();
        } else {
            disableTerrainLighting();
        }
    });
    
    // 高度滑块
    heightSlider.addEventListener('input', function() {
        const height = parseInt(this.value);
        adjustHeight(height);
    });
    
    // 键盘控制
    document.addEventListener('keydown', function(e) {
        const moveSpeed = 0.5;
        switch(e.key) {
            case 'w':
            case 'W':
                viewer.camera.moveForward(moveSpeed);
                break;
            case 's':
            case 'S':
                viewer.camera.moveBackward(moveSpeed);
                break;
            case 'a':
            case 'A':
                viewer.camera.moveLeft(moveSpeed);
                break;
            case 'd':
            case 'D':
                viewer.camera.moveRight(moveSpeed);
                break;
            case 'q':
            case 'Q':
                viewer.camera.moveUp(moveSpeed);
                break;
            case 'e':
            case 'E':
                viewer.camera.moveDown(moveSpeed);
                break;
        }
    });
    
    // 时间控制功能
    function updateTimeDisplay() {
        const currentTime = viewer.clock.currentTime;
        
        // 使用toDate获取UTC时间，然后转换为北京时间（UTC+8）
        const utcDate = Cesium.JulianDate.toDate(currentTime);
        const beijingTime = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
        
        // 手动格式化时间（使用UTC方法避免本地时区影响）
        const year = beijingTime.getUTCFullYear();
        const month = beijingTime.getUTCMonth() + 1; // 0-11转换为1-12
        const day = beijingTime.getUTCDate();
        const hour = beijingTime.getUTCHours();
        const minute = beijingTime.getUTCMinutes();
        const second = beijingTime.getUTCSeconds();
        
        // 手动格式化时间
        const formattedDate = [
            year,
            String(month).padStart(2, '0'),
            String(day).padStart(2, '0')
        ].join('-');
        
        const formattedTime = [
            String(hour).padStart(2, '0'),
            String(minute).padStart(2, '0'),
            String(second).padStart(2, '0')
        ].join(':');
        
        currentTimeDisplay.textContent = `${formattedDate} ${formattedTime}`;
    }
    
    // 初始化时间显示
    updateTimeDisplay();
    
    // 自定义时间设置
    btnSetCustomTime.addEventListener('click', function() {
        const customTimeStr = customTimeInput.value;
        if (!customTimeStr) return;
        
        try {
            const customDate = new Date(customTimeStr);
            const customJulianDate = Cesium.JulianDate.fromDate(customDate);
            
            viewer.clock.currentTime = customJulianDate;
            updateTimeDisplay();
        } catch (error) {
            alert("时间格式错误，请使用正确的日期时间格式");
        }
    });
    
    // 设置自定义时间输入框的默认值为当前时间
    const nowDate = new Date();
    const timezoneOffset = nowDate.getTimezoneOffset() * 60000;
    const localISOTime = new Date(nowDate.getTime() - timezoneOffset).toISOString().slice(0, 16);
    customTimeInput.value = localISOTime;
    
    // 滑块事件监听
    zoomSlider.addEventListener('input', function() {
        const zoomFactor = parseFloat(this.value);
        applyZoom(zoomFactor);
    });
    
    // 应用默认变焦
    applyZoom(1.0);
    
    // 定期更新相机信息
    setInterval(updateCameraInfo, 100);
    
    // 确保时间线正常工作
    viewer.clock.shouldAnimate = true;
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date());
    
    // 监听时间变化
    viewer.clock.onTick.addEventListener(function() {
        updateTimeDisplay();
    });
}

// 主初始化函数
function main() {
    console.log("开始初始化...");
    
    // 初始化完整地球视图
    initializeGlobe();
    
    // 提前在后台预加载3D地形，避免选点进入相机模式时因发起网络请求而产生数秒的原地卡顿
    initializeTerrain();
}

// 启动主程序
main();

// Sandcastle 底部
