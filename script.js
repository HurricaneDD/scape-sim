// 访问令牌
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlNzJjNDgxMS0wNGIxLTQwMmYtODYzMy03ODQ3Njg4Y2FlYzQiLCJpZCI6Mzk3MjkzLCJpYXQiOjE3NzI1NDc1NDN9.MTjRT7M805SQ81Q0dNgYhenCD-I4SOl3nAbFJOz0Dpg"

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

// 显示帧率和延迟
viewer.scene.debugShowFramesPerSecond = false;

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
const openAmapPickerBtn = document.getElementById('openAmapPickerBtn');

// 高德地图坐标拾取器相关DOM与状态变量
const amapPickerModal = document.getElementById('amapPickerModal');
const closeAmapPickerModalBtn = document.getElementById('closeAmapPickerModalBtn');
const amapCloseBtn = document.getElementById('amapCloseBtn');
const amapSearchWrapper = document.getElementById('amapSearchWrapper');
const amapSearchInput = document.getElementById('amapSearchInput');
const amapSearchBtn = document.getElementById('amapSearchBtn');
const amapSearchSuggestions = document.getElementById('amapSearchSuggestions');
const amapLngInput = document.getElementById('amapLngInput');
const amapLatInput = document.getElementById('amapLatInput');
const amapCoordInputGroup = document.getElementById('amapCoordInputGroup');
const amapPasteBtn = document.getElementById('amapPasteBtn');
const amapLayerVectorBtn = document.getElementById('amapLayerVectorBtn');
const amapLayerSatBtn = document.getElementById('amapLayerSatBtn');
const amapDisplayGcjLng = document.getElementById('amapDisplayGcjLng');
const amapDisplayGcjLat = document.getElementById('amapDisplayGcjLat');
const amapDisplayWgsLng = document.getElementById('amapDisplayWgsLng');
const amapDisplayWgsLat = document.getElementById('amapDisplayWgsLat');
const amapCurrentLocationName = document.getElementById('amapCurrentLocationName');
const amapConfirmFlyBtn = document.getElementById('amapConfirmFlyBtn');
const amapPreviewBtn = document.getElementById('amapPreviewBtn');
const openAmapPickerFromControlsBtn = document.getElementById('openAmapPickerFromControlsBtn');

// 高德拾取器内部变量
let amapMap = null;
let amapMarker = null;
let amapVectorLayer = null;
let amapSatGroup = null;
let amapGcjCoord = null; // 初始未选点，不显示红标
let amapWgsCoord = null;

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

// 环境参数菜单相关元素
const envParamsBtn = document.getElementById('envParamsBtn');
const envParamsMenu = document.getElementById('envParamsMenu');
const closeEnvParamsBtn = document.getElementById('closeEnvParamsBtn');

// 距离雾相关元素
const fog5km = document.getElementById('fog5km');
const fog10km = document.getElementById('fog10km');
const fog15km = document.getElementById('fog15km');
const fog20km = document.getElementById('fog20km');
const fog25km = document.getElementById('fog25km');
const fog30km = document.getElementById('fog30km');
const customFogVisibility = document.getElementById('customFogVisibility');
const setCustomFogVisibility = document.getElementById('setCustomFogVisibility');
const closeFogVisibility = document.getElementById('closeFogVisibility');

// 距离雾后期处理阶段与状态
let distanceFogStage = null;
let currentFogVisibilityMeters = 10000.0;

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
            
            // 立即在后台触发最高精度高程预采样，在用户挪动鼠标去点击确认按钮的时间内完成
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

    // 打开高德地图坐标拾取器按钮事件
    if (openAmapPickerBtn) {
        openAmapPickerBtn.addEventListener('click', function() {
            openAmapPicker();
        });
    }
}

// 红色头大头针 SVG 图标（针尖位于底部中心，精准指向拾取坐标点）
const RED_PUSHPIN_SVG = `
<svg viewBox="0 0 32 40" width="32" height="40" xmlns="http://www.w3.org/2000/svg" style="display:block; overflow:visible;">
    <defs>
        <radialGradient id="redPinHeadGrad" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stop-color="#ff7b7b"/>
            <stop offset="45%" stop-color="#ef4444"/>
            <stop offset="85%" stop-color="#b91c1c"/>
            <stop offset="100%" stop-color="#7f1d1d"/>
        </radialGradient>
        <linearGradient id="pinNeedleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#94a3b8"/>
            <stop offset="50%" stop-color="#f8fafc"/>
            <stop offset="100%" stop-color="#475569"/>
        </linearGradient>
    </defs>
    <!-- 底部针尖投影 -->
    <ellipse cx="16" cy="38" rx="4.5" ry="1.8" fill="rgba(0,0,0,0.35)"/>
    <!-- 金属针杆（针尖在 16, 38） -->
    <polygon points="14.6,20 17.4,20 16,38" fill="url(#pinNeedleGrad)" stroke="#475569" stroke-width="0.4"/>
    <!-- 红色大头针圆头 -->
    <circle cx="16" cy="12" r="10" fill="url(#redPinHeadGrad)" stroke="#ffffff" stroke-width="1.5"/>
    <!-- 顶部高光点 -->
    <ellipse cx="12.5" cy="8.5" rx="3.2" ry="2.2" transform="rotate(-25 12.5 8.5)" fill="rgba(255,255,255,0.65)"/>
</svg>`;

// 添加选择点标记 - 红色头大头针
function addSelectionMarker(position) {
    // 移除旧的标记
    if (selectionMarker) {
        selectionMarker.remove();
    }
    
    // 创建新的红色头大头针标记
    selectionMarker = document.createElement('div');
    selectionMarker.className = 'selection-marker';
    selectionMarker.innerHTML = RED_PUSHPIN_SVG;
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
                    }
                }).catch(() => {});
            }
            
            console.log("已进入相机模式");
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
        Cesium.Math.toRadians(3),  // 对应20倍变焦
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

// 更新距离雾按钮的高亮状态
function updateFogBtnState(activeBtn) {
    const fogBtns = [
        fog5km,
        fog10km,
        fog15km,
        fog20km,
        fog25km,
        fog30km,
        setCustomFogVisibility
    ];
    fogBtns.forEach(btn => {
        if (btn) {
            btn.classList.remove('active');
        }
    });
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// 初始化或获取距离雾 PostProcessStage（基于相机视空间真实深度计算渐进大气雾化）
function ensureDistanceFogStage() {
    if (distanceFogStage) {
        return distanceFogStage;
    }

    const fragmentShaderSource = `
        uniform sampler2D colorTexture;
        uniform sampler2D depthTexture;
        in vec2 v_textureCoordinates;
        uniform float u_visibilityDistance;
        uniform vec4 u_fogColor;

        void main() {
            vec4 origColor = texture(colorTexture, v_textureCoordinates);
            float depth = czm_unpackDepth(texture(depthTexture, v_textureCoordinates));

            // 天空无穷远区域柔和混入雾色，消除远山轮廓与天空的硬边割裂
            if (depth == 0.0 || depth >= 0.999999) {
                out_FragColor = mix(origColor, vec4(u_fogColor.rgb, origColor.a), 0.78);
                return;
            }

            vec4 eyeCoordinate = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);
            vec3 posEC = eyeCoordinate.xyz / eyeCoordinate.w;
            float dist = length(posEC);

            // 归一化距离：当 dist == u_visibilityDistance 时达到设定能见度极限
            float normDist = clamp(dist / max(u_visibilityDistance, 1.0), 0.0, 2.0);

            // 结合大气指数消光定律 (Beer-Lambert) 与平滑 Hermite 插值
            // 近景保持清晰通透，中景呈现自然空气透视感，到达能见度距离处隐入浓雾
            float expFog = 1.0 - exp(-pow(normDist * 1.65, 1.45));
            float smoothFog = smoothstep(0.02, 1.0, normDist);
            float fogFactor = clamp(mix(expFog, smoothFog, 0.35), 0.0, 0.96);

            out_FragColor = mix(origColor, vec4(u_fogColor.rgb, origColor.a), fogFactor);
        }
    `;

    distanceFogStage = new Cesium.PostProcessStage({
        name: 'scape_sim_distance_fog',
        fragmentShader: fragmentShaderSource,
        uniforms: {
            u_visibilityDistance: function() {
                return currentFogVisibilityMeters;
            },
            u_fogColor: function() {
                return new Cesium.Color(0.88, 0.90, 0.93, 1.0);
            }
        }
    });

    distanceFogStage.enabled = false;
    viewer.scene.postProcessStages.add(distanceFogStage);
    return distanceFogStage;
}

// 开启或切换距离雾能见度挡位（5km / 10km / 15km / 20km / 25km / 自定义）
function applyDistanceFog(visibilityKm, targetBtn = null) {
    if (!viewer || !viewer.scene) return;

    currentFogVisibilityMeters = Math.max(0.1, visibilityKm) * 1000.0;
    const stage = ensureDistanceFogStage();
    stage.enabled = true;

    // 同步开启 Cesium 内置地形雾辅助过渡
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = Math.min(0.002, 3.0 / currentFogVisibilityMeters);

    updateFogBtnState(targetBtn);
    console.log(`已开启距离雾，当前能见度挡位: ${visibilityKm}km`);
}

// 关闭距离雾
function closeDistanceFog() {
    if (distanceFogStage) {
        distanceFogStage.enabled = false;
    }
    if (viewer && viewer.scene && viewer.scene.fog) {
        viewer.scene.fog.density = 0.0002;
    }
    updateFogBtnState(null);
    if (customFogVisibility) {
        customFogVisibility.value = '';
    }
    console.log("距离雾已关闭");
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
        
        // 限制遥感内圈移动范围
        const maxDistance = 30;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const ratio = distance > maxDistance ? maxDistance / distance : 1;
        
        currentPos.x = deltaX * ratio;
        currentPos.y = deltaY * ratio;
        
        // 更新遥感内圈位置
        innerElement.style.transform = `translate(calc(-50% + ${currentPos.x}px), calc(-50% + ${currentPos.y}px))`;
        
        // 回调函数处理移动
        if (callback) {
            callback(currentPos.x / maxDistance, currentPos.y / maxDistance);
        }
    };
    
    // 结束控制
    const endControl = function() {
        if (!isActive) return;
        isActive = false;
        currentPos.x = 0;
        currentPos.y = 0;
        innerElement.style.transform = 'translate(-50%, -50%)';
        if (callback) {
            callback(0, 0); // 停止移动
        }
    };
    
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
    joystick.addEventListener('touchcancel', endControl);
    
    // 鼠标事件（用于桌面测试）
    joystick.addEventListener('mousedown', function(e) {
        e.preventDefault();
        startControl(e.clientX, e.clientY);
    });
    
    document.addEventListener('mousemove', function(e) {
        updateControl(e.clientX, e.clientY);
    });
    
    document.addEventListener('mouseup', endControl);
}

// 初始化相机控制
function initializeCameraControls() {
    // 右遥感控制 - 镜头朝向
    setupJoystick('rightJoystick', rightJoystickInner, function(x, y) {
        if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) return;
        
        const rotateSpeed = 0.005;
        
        // 左右旋转
        if (Math.abs(x) > 0.1) {
            if (x > 0.1) {
                // 向右旋转
                viewer.camera.lookRight(x * rotateSpeed);
            } else if (x < -0.1) {
                // 向左旋转
                viewer.camera.lookLeft(-x * rotateSpeed);
            }
        }
        
        // 上下俯仰：反转Y轴控制
        if (Math.abs(y) > 0.1) {
            if (y > 0.1) {
                // 前推：压下镜头（向下看）
                viewer.camera.lookDown(y * rotateSpeed);
            } else if (y < -0.1) {
                // 后拉：抬起镜头（向上看）
                viewer.camera.lookUp(-y * rotateSpeed);
            }
        }
    });
    
    // 方向键控制
    const moveSpeed = 30; // 降低移动速度
    
    btnUp.addEventListener('mousedown', function() {
        viewer.camera.moveForward(moveSpeed);
    });
    
    btnDown.addEventListener('mousedown', function() {
        viewer.camera.moveBackward(moveSpeed);
    });
    
    btnLeft.addEventListener('mousedown', function() {
        viewer.camera.moveLeft(moveSpeed);
    });
    
    btnRight.addEventListener('mousedown', function() {
        viewer.camera.moveRight(moveSpeed);
    });
    
    // 触摸事件支持
    btnUp.addEventListener('touchstart', function(e) {
        e.preventDefault();
        viewer.camera.moveForward(moveSpeed);
    });
    
    btnDown.addEventListener('touchstart', function(e) {
        e.preventDefault();
        viewer.camera.moveBackward(moveSpeed);
    });
    
    btnLeft.addEventListener('touchstart', function(e) {
        e.preventDefault();
        viewer.camera.moveLeft(moveSpeed);
    });
    
    btnRight.addEventListener('touchstart', function(e) {
        e.preventDefault();
        viewer.camera.moveRight(moveSpeed);
    });
    
    // 修复：正确配置鼠标控制
    // 重置所有鼠标控制配置
    viewer.scene.screenSpaceCameraController.enableRotate = false; // 禁用旋转
    viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = false; // 禁用滚轮缩放
    viewer.scene.screenSpaceCameraController.enableTilt = false;
    viewer.scene.screenSpaceCameraController.enableLook = false;
    
    // 配置右键拖动为平移（移动镜头位置）
    viewer.scene.screenSpaceCameraController.translateEventTypes = [
        Cesium.CameraEventType.RIGHT_DRAG
    ];
    
    // 键盘WASD控制移动
    document.addEventListener('keydown', function(event) {
        switch(event.key.toLowerCase()) {
            case 'w':
                viewer.camera.moveForward(moveSpeed);
                break;
            case 's':
                viewer.camera.moveBackward(moveSpeed);
                break;
            case 'a':
                viewer.camera.moveLeft(moveSpeed);
                break;
            case 'd':
                viewer.camera.moveRight(moveSpeed);
                break;
            case 'q':
                viewer.camera.moveUp(moveSpeed);
                break;
            case 'e':
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
        const month = beijingTime.getUTCMonth() + 1;
        const day = beijingTime.getUTCDate();
        const hour = beijingTime.getUTCHours();
        const minute = beijingTime.getUTCMinutes();
        const second = beijingTime.getUTCSeconds();
        
        // 格式化时间字符串
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
    
    heightSlider.addEventListener('input', function() {
        const height = parseInt(this.value);
        // 使用防抖避免频繁调用
        clearTimeout(window.heightTimeout);
        window.heightTimeout = setTimeout(() => {
            adjustHeight(height);
        }, 100);
    });
    
    // 预设变焦按钮事件监听
    btnZoom8x.addEventListener('click', function() {
        applyZoom(8.0);
    });
    
    btnZoom5x.addEventListener('click', function() {
        applyZoom(5.0);
    });
    
    btnZoom2x.addEventListener('click', function() {
        applyZoom(2.0);
    });
    
    btnZoom1_5x.addEventListener('click', function() {
        applyZoom(1.5);
    });
    
    btnZoom1x.addEventListener('click', function() {
        applyZoom(1.0);
    });
    
    btnZoom05x.addEventListener('click', function() {
        applyZoom(0.5);
    });
    
    // 地形光照开关事件监听
    terrainLightingSwitch.addEventListener('change', function() {
        if (this.checked) {
            enableTerrainLighting();
        } else {
            disableTerrainLighting();
        }
    });
    
    // 环境参数按钮事件监听
    envParamsBtn.addEventListener('click', function() {
        envParamsMenu.style.display = 'flex';
    });
    
    // 点击环境参数菜单外部关闭菜单
    envParamsMenu.addEventListener('click', function(event) {
        if (event.target === envParamsMenu) {
            envParamsMenu.style.display = 'none';
        }
    });
    
    // 关闭环境参数菜单按钮事件监听
    closeEnvParamsBtn.addEventListener('click', function() {
        envParamsMenu.style.display = 'none';
    });
    
    // 距离雾各能见度挡位按钮事件监听（5km / 10km / 15km / 20km / 25km / 30km）
    if (fog5km) {
        fog5km.addEventListener('click', function() {
            applyDistanceFog(5, this);
        });
    }
    if (fog10km) {
        fog10km.addEventListener('click', function() {
            applyDistanceFog(10, this);
        });
    }
    if (fog15km) {
        fog15km.addEventListener('click', function() {
            applyDistanceFog(15, this);
        });
    }
    if (fog20km) {
        fog20km.addEventListener('click', function() {
            applyDistanceFog(20, this);
        });
    }
    if (fog25km) {
        fog25km.addEventListener('click', function() {
            applyDistanceFog(25, this);
        });
    }
    if (fog30km) {
        fog30km.addEventListener('click', function() {
            applyDistanceFog(30, this);
        });
    }
    if (setCustomFogVisibility) {
        setCustomFogVisibility.addEventListener('click', function() {
            const radiusKm = parseFloat(customFogVisibility.value);
            if (!isNaN(radiusKm) && radiusKm > 0) {
                customFogVisibility.style.borderColor = '#ddd';
                applyDistanceFog(radiusKm, this);
            } else {
                customFogVisibility.style.borderColor = '#f44336';
                customFogVisibility.focus();
            }
        });
    }
    if (closeFogVisibility) {
        closeFogVisibility.addEventListener('click', function() {
            closeDistanceFog();
        });
    }
    
    // 镜头回正按钮事件监听
    resetCameraBtn.addEventListener('click', function() {
        resetCameraOrientation();
    });
    
    // 应用初始变焦
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

// 隐藏UI相关元素
const hideUIBtn = document.getElementById('hideUIBtn');
const exitHideModeBtn = document.getElementById('exitHideModeBtn');

// 隐藏UI模式
function enterHideMode() {
    document.body.classList.add('hidden-mode');
    exitHideModeBtn.style.display = 'flex';
}

// 退出隐藏UI模式
function exitHideMode() {
    document.body.classList.remove('hidden-mode');
    exitHideModeBtn.style.display = 'none';
}

// 隐藏UI按钮事件监听
hideUIBtn.addEventListener('click', function() {
    enterHideMode();
});

// 退出隐藏模式按钮事件监听
exitHideModeBtn.addEventListener('click', function() {
    exitHideMode();
});

// =========================================================================
// 高德地图坐标拾取器核心逻辑（支持 GCJ-02 与 WGS-84 空间坐标系精确换算）
// =========================================================================

// 空间坐标转换算法工具类
const CoordTransform = {
    PI: Math.PI,
    a: 6378245.0, // Krasovsky 1940 长半轴
    ee: 0.00669342162296594323, // 偏心率平方

    // 判断坐标是否在中国境外
    outOfChina: function(lng, lat) {
        return (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271);
    },

    transformLat: function(x, y) {
        let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
        return ret;
    },

    transformLng: function(x, y) {
        let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
        return ret;
    },

    // WGS-84 转 GCJ-02（正向加偏）
    wgs84ToGcj02: function(lng, lat) {
        if (this.outOfChina(lng, lat)) return [lng, lat];
        let dLat = this.transformLat(lng - 105.0, lat - 35.0);
        let dLng = this.transformLng(lng - 105.0, lat - 35.0);
        const radLat = lat / 180.0 * Math.PI;
        let magic = Math.sin(radLat);
        magic = 1 - this.ee * magic * magic;
        const sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((this.a * (1 - this.ee)) / (magic * sqrtMagic) * Math.PI);
        dLng = (dLng * 180.0) / (this.a / sqrtMagic * Math.cos(radLat) * Math.PI);
        return [lng + dLng, lat + dLat];
    },

    // GCJ-02 转 WGS-84（高精度4次牛顿迭代反解，误差 < 0.000001度，彻底抹平火星偏移行差）
    gcj02ToWgs84: function(gcjLng, gcjLat) {
        if (this.outOfChina(gcjLng, gcjLat)) return [gcjLng, gcjLat];
        let wgsLng = gcjLng;
        let wgsLat = gcjLat;
        for (let i = 0; i < 4; i++) {
            const [currGcjLng, currGcjLat] = this.wgs84ToGcj02(wgsLng, wgsLat);
            const dLng = currGcjLng - gcjLng;
            const dLat = currGcjLat - gcjLat;
            wgsLng -= dLng;
            wgsLat -= dLat;
        }
        return [wgsLng, wgsLat];
    }
};

// 预设风光摄影热门机位及扩展景区词库（高德 GCJ-02 坐标 + 详细地址）
const SCENIC_PRESETS = [
    { name: "贡嘎雪山", address: "四川省甘孜藏族自治州康定市 · 贡嘎山国家级风景名胜区", gcjLng: 101.8797, gcjLat: 29.5969 },
    { name: "贡嘎山冷噶措观景台", address: "四川省甘孜藏族自治州康定市贡嘎山乡帮木吉德村", gcjLng: 101.7665, gcjLat: 29.5286 },
    { name: "贡嘎山子梅垭口", address: "四川省甘孜藏族自治州康定市贡嘎山乡子梅垭口", gcjLng: 101.7631, gcjLat: 29.6228 },
    { name: "牛背山", address: "四川省雅安市荥经县牛背山镇 · 360度云海雪山观景平台", gcjLng: 102.3167, gcjLat: 29.7667 },
    { name: "珠穆朗玛峰", address: "西藏自治区日喀则市定日县 · 珠穆朗玛峰国家级自然保护区", gcjLng: 86.9250, gcjLat: 27.9881 },
    { name: "珠峰大本营 (绒布寺)", address: "西藏自治区日喀则市定日县曲当乡珠峰大本营观景台", gcjLng: 86.8522, gcjLat: 28.1436 },
    { name: "加乌拉山口 (珠峰观景台)", address: "西藏自治区日喀则市定日县扎西宗乡加乌拉山口", gcjLng: 87.0531, gcjLat: 28.2953 },
    { name: "梅里雪山", address: "云南省迪庆藏族自治州德钦县 · 卡瓦格博峰景区", gcjLng: 98.6833, gcjLat: 28.4333 },
    { name: "梅里雪山飞来寺观景台", address: "云南省迪庆藏族自治州德钦县升平镇飞来寺国家森林公园", gcjLng: 98.8781, gcjLat: 28.4525 },
    { name: "稻城亚丁", address: "四川省甘孜藏族自治州稻城县香格里拉镇 · 亚丁国家级自然保护区", gcjLng: 100.3475, gcjLat: 28.3970 },
    { name: "黄山光明顶", address: "安徽省黄山市黄山区汤口镇 · 黄山风景区光明顶气象站", gcjLng: 118.1722, gcjLat: 30.1347 },
    { name: "黄山迎客松 (玉屏楼)", address: "安徽省黄山市黄山区黄山风景区玉屏景区", gcjLng: 118.1738, gcjLat: 30.1281 },
    { name: "黄山始信峰", address: "安徽省黄山市黄山区黄山风景区北海景区始信峰", gcjLng: 118.1831, gcjLat: 30.1422 },
    { name: "泰山玉皇顶", address: "山东省泰安市泰山区红门路 · 泰山风景名胜区极顶", gcjLng: 117.1083, gcjLat: 36.2558 },
    { name: "华山南峰", address: "陕西省渭南市华阴市玉泉路 · 华山风景名胜区落雁峰", gcjLng: 110.0811, gcjLat: 34.4827 },
    { name: "桂林相公山", address: "广西壮族自治区桂林市阳朔县兴坪镇 · 漓江第一湾摄影点", gcjLng: 110.4578, gcjLat: 24.9389 },
    { name: "杭州西湖", address: "浙江省杭州市西湖区 · 西湖风景名胜区断桥残雪/宝石山", gcjLng: 120.1583, gcjLat: 30.2589 },
    { name: "扎尕那", address: "甘肃省甘南藏族自治州迭部县益哇镇 · 扎尕那达日观景台", gcjLng: 103.1833, gcjLat: 34.1833 },
    { name: "北京故宫", address: "北京市东城区景山前街4号 · 故宫博物院 / 景山万春亭", gcjLng: 116.397428, gcjLat: 39.909230 },
    { name: "四姑娘山幺妹峰", address: "四川省阿坝藏族羌族自治州小金县四姑娘山镇 · 猫鼻梁观景台", gcjLng: 102.9022, gcjLat: 31.1069 },
    { name: "南迦巴瓦峰 (索松村)", address: "西藏自治区林芝市米林市派镇索松村雅鲁藏布大峡谷", gcjLng: 95.0583, gcjLat: 29.6278 },
    { name: "长白山天池", address: "吉林省延边朝鲜族自治州安图县 · 长白山国家级自然保护区北坡天池", gcjLng: 128.0592, gcjLat: 42.0061 },
    { name: "喀纳斯神仙湾", address: "新疆维吾尔自治区阿勒泰地区布尔津县喀纳斯景区", gcjLng: 87.0225, gcjLat: 48.6656 },
    { name: "赛里木湖", address: "新疆维吾尔自治区博尔塔拉蒙古自治州博乐市赛里木湖风景名胜区", gcjLng: 81.1714, gcjLat: 44.5986 },
    { name: "青海湖黑马河", address: "青海省海南藏族自治州共和县黑马河镇青海湖日出观景台", gcjLng: 99.7828, gcjLat: 36.7294 },
    { name: "茶卡盐湖", address: "青海省海西蒙古族藏族自治州乌兰县茶卡镇天空之镜景区", gcjLng: 99.0847, gcjLat: 36.6883 },
    { name: "武功山金顶", address: "江西省萍乡市芦溪县武功山国家级风景名胜区白鹤峰金顶", gcjLng: 114.1786, gcjLat: 27.4561 },
    { name: "张家界武陵源天子山", address: "湖南省张家界市武陵源区张家界国家森林公园天子山观景台", gcjLng: 110.4533, gcjLat: 29.3736 },
    { name: "庐山含鄱口", address: "江西省九江市庐山市庐山风景名胜区含鄱口日出观景台", gcjLng: 115.9936, gcjLat: 29.5389 },
    { name: "峨眉山金顶", address: "四川省乐山市峨眉山市峨眉山风景区十方普贤金顶", gcjLng: 103.3347, gcjLat: 29.5206 }
];

// 搜索自动补全状态变量
let amapSuggestionDebounceTimer = null;
let amapSuggestionAbortController = null;
let amapCurrentSuggestions = [];
let amapActiveSuggestionIndex = -1;

// 常见问题悬浮窗控制逻辑
const faqModalBtn = document.getElementById('faqModalBtn');
const faqModal = document.getElementById('faqModal');
const closeFaqModalBtn = document.getElementById('closeFaqModalBtn');
const faqModalBody = document.getElementById('faqModalBody');
let faqLoadedFromFile = false;

async function openFaqModal() {
    if (!faqModal) return;
    faqModal.style.display = 'flex';

    // 异步从 faqs.html 同步最新常见问题内容
    if (!faqLoadedFromFile && faqModalBody) {
        try {
            const resp = await fetch('faqs.html');
            if (resp.ok) {
                const htmlText = await resp.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                const items = doc.querySelectorAll('.faq-item');
                if (items && items.length > 0) {
                    faqModalBody.innerHTML = '';
                    items.forEach((item, index) => {
                        const qEl = item.querySelector('.faq-question');
                        const aEl = item.querySelector('.faq-answer');
                        const wrapper = document.createElement('div');
                        wrapper.style.cssText = `margin-bottom: ${index === items.length - 1 ? '8px' : '16px'}; padding: 14px; background-color: #f9f9f9; border-radius: 6px; border: 1px solid #eee;`;

                        if (qEl) {
                            const qDiv = document.createElement('div');
                            qDiv.style.cssText = 'font-weight: bold; font-size: 15px; margin-bottom: 8px; color: #222;';
                            qDiv.textContent = qEl.textContent;
                            wrapper.appendChild(qDiv);
                        }
                        if (aEl) {
                            const aDiv = document.createElement('div');
                            aDiv.style.cssText = 'line-height: 1.6; font-size: 14px; color: #444;';
                            aDiv.innerHTML = aEl.innerHTML;
                            aDiv.querySelectorAll('p').forEach(p => {
                                p.style.margin = '4px 0';
                            });
                            wrapper.appendChild(aDiv);
                        }
                        faqModalBody.appendChild(wrapper);
                    });
                    faqLoadedFromFile = true;
                }
            }
        } catch (e) {
            console.warn('读取 faqs.html 失败，使用内置常见问题内容:', e);
        }
    }
}

function closeFaqModal() {
    if (!faqModal) return;
    faqModal.style.display = 'none';
}

if (faqModalBtn) {
    faqModalBtn.addEventListener('click', openFaqModal);
}
if (closeFaqModalBtn) {
    closeFaqModalBtn.addEventListener('click', closeFaqModal);
}
if (faqModal) {
    faqModal.addEventListener('click', function(event) {
        if (event.target === faqModal) {
            closeFaqModal();
        }
    });
}
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && faqModal && faqModal.style.display === 'flex') {
        closeFaqModal();
    }
});

// 自定义高德地图红色头大头针图标（针尖精准对齐拾取坐标）
const customPhotoPin = (typeof L !== 'undefined') ? L.divIcon({
    className: 'amap-custom-pin-marker',
    html: `<div style="position:relative; width:32px; height:40px; pointer-events:none; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
             ${RED_PUSHPIN_SVG}
           </div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 38]
}) : null;

// 设置当前拾取坐标，并即时同步换算与界面更新
function setAmapPickerLocation(gcjLng, gcjLat, locName = "自定义坐标点", shouldPan = false, zoomLevel = null) {
    if (isNaN(gcjLng) || isNaN(gcjLat)) return;

    amapGcjCoord = { lng: gcjLng, lat: gcjLat };
    
    // 执行 GCJ-02 ➔ WGS-84 高精度迭代转换
    const [wgsLng, wgsLat] = CoordTransform.gcj02ToWgs84(gcjLng, gcjLat);
    amapWgsCoord = { lng: wgsLng, lat: wgsLat };

    // 更新界面数值显示及右上角经纬度输入框
    if (amapDisplayGcjLng) amapDisplayGcjLng.textContent = gcjLng.toFixed(6);
    if (amapDisplayGcjLat) amapDisplayGcjLat.textContent = gcjLat.toFixed(6);
    if (amapDisplayWgsLng) amapDisplayWgsLng.textContent = wgsLng.toFixed(6);
    if (amapDisplayWgsLat) amapDisplayWgsLat.textContent = wgsLat.toFixed(6);
    if (amapCurrentLocationName) amapCurrentLocationName.textContent = locName;
    if (amapLngInput) amapLngInput.value = gcjLng.toFixed(6);
    if (amapLatInput) amapLatInput.value = gcjLat.toFixed(6);
    if (amapPasteBtn) amapPasteBtn.style.display = 'none';
    if (amapCoordInputGroup) amapCoordInputGroup.style.borderColor = '#cbd5e1';

    // 同步右侧菜单热门风光机位按钮高亮状态
    document.querySelectorAll('.amap-preset-tag').forEach(tag => {
        const tagName = tag.getAttribute('data-name');
        if (tagName && tagName === locName) {
            tag.classList.add('active');
        } else {
            tag.classList.remove('active');
        }
    });

    // 移动或首次创建地图标记与视野
    if (amapMarker) {
        amapMarker.setLatLng([gcjLat, gcjLng]);
    } else if (amapMap) {
        amapMarker = L.marker([gcjLat, gcjLng], {
            icon: customPhotoPin || undefined,
            draggable: true
        }).addTo(amapMap);

        amapMarker.on('dragend', function() {
            const pos = amapMarker.getLatLng();
            setAmapPickerLocation(pos.lng, pos.lat, "手动拖拽选点");
        });
    }

    if (shouldPan && amapMap) {
        const targetZoom = zoomLevel || amapMap.getZoom() || 13;
        amapMap.setView([gcjLat, gcjLng], targetZoom);
    }
}

// 切换高德地图图层（矢量街景 / 卫星影像）
function switchAmapLayer(layerType) {
    if (!amapMap) return;
    if (layerType === 'vector') {
        if (amapSatGroup && amapMap.hasLayer(amapSatGroup)) {
            amapMap.removeLayer(amapSatGroup);
        }
        if (amapVectorLayer && !amapMap.hasLayer(amapVectorLayer)) {
            amapVectorLayer.addTo(amapMap);
        }
        if (amapLayerVectorBtn) amapLayerVectorBtn.classList.add('active');
        if (amapLayerSatBtn) amapLayerSatBtn.classList.remove('active');
    } else {
        if (amapVectorLayer && amapMap.hasLayer(amapVectorLayer)) {
            amapMap.removeLayer(amapVectorLayer);
        }
        if (amapSatGroup && !amapMap.hasLayer(amapSatGroup)) {
            amapSatGroup.addTo(amapMap);
        }
        if (amapLayerSatBtn) amapLayerSatBtn.classList.add('active');
        if (amapLayerVectorBtn) amapLayerVectorBtn.classList.remove('active');
    }
}

// 隐藏搜索自动补全提示下拉框
function hideAmapSearchSuggestions() {
    if (amapSearchSuggestions) {
        amapSearchSuggestions.style.display = 'none';
        amapSearchSuggestions.innerHTML = '';
    }
    amapCurrentSuggestions = [];
    amapActiveSuggestionIndex = -1;
}

// 选择某一条搜索建议项并定位
function selectAmapSuggestionItem(item) {
    if (!item) return;
    if (amapSearchInput) {
        amapSearchInput.value = item.name;
    }
    hideAmapSearchSuggestions();
    setAmapPickerLocation(item.gcjLng, item.gcjLat, item.name, true, 13);
}

// 渲染搜索自动补全下拉列表
function renderAmapSearchSuggestions(items, isLoading = false) {
    if (!amapSearchSuggestions) return;
    amapCurrentSuggestions = items || [];
    amapActiveSuggestionIndex = -1;

    if (amapCurrentSuggestions.length === 0) {
        if (isLoading) {
            amapSearchSuggestions.innerHTML = '<div class="amap-suggestion-empty">正在检索相关地点...</div>';
            amapSearchSuggestions.style.display = 'block';
        } else {
            hideAmapSearchSuggestions();
        }
        return;
    }

    amapSearchSuggestions.innerHTML = '';
    amapCurrentSuggestions.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'amap-suggestion-item';
        row.setAttribute('data-index', String(idx));

        const iconSpan = document.createElement('span');
        iconSpan.className = 'amap-suggestion-icon';
        iconSpan.textContent = '📍';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'amap-suggestion-content';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'amap-suggestion-title';
        titleDiv.textContent = item.name;

        const addrDiv = document.createElement('div');
        addrDiv.className = 'amap-suggestion-address';
        addrDiv.textContent = item.address || `${item.gcjLng.toFixed(4)}°E, ${item.gcjLat.toFixed(4)}°N`;

        contentDiv.appendChild(titleDiv);
        contentDiv.appendChild(addrDiv);
        row.appendChild(iconSpan);
        row.appendChild(contentDiv);

        // 使用 mousedown 优先触发，防止 input blur 导致点击失效
        row.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectAmapSuggestionItem(item);
        });

        amapSearchSuggestions.appendChild(row);
    });

    amapSearchSuggestions.style.display = 'block';
}

// 更新键盘上下键高亮的建议项
function updateActiveSuggestionHighlight() {
    if (!amapSearchSuggestions) return;
    const rows = amapSearchSuggestions.querySelectorAll('.amap-suggestion-item');
    rows.forEach((row, idx) => {
        if (idx === amapActiveSuggestionIndex) {
            row.classList.add('active');
            row.scrollIntoView({ block: 'nearest' });
        } else {
            row.classList.remove('active');
        }
    });
}

// 根据输入文字实时查询候选地点（本地风光库 + 在线地理编码）
function handleAmapSearchAutocomplete(rawQuery) {
    const query = (rawQuery || '').trim();
    if (!query) {
        if (amapSuggestionDebounceTimer) clearTimeout(amapSuggestionDebounceTimer);
        if (amapSuggestionAbortController) amapSuggestionAbortController.abort();
        hideAmapSearchSuggestions();
        return;
    }

    // 1. 立即匹配本地风光摄影机位词库（0ms 响应）
    const lowerQuery = query.toLowerCase();
    const localMatches = SCENIC_PRESETS.filter(p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        (p.address && p.address.toLowerCase().includes(lowerQuery))
    ).slice(0, 6);

    renderAmapSearchSuggestions(localMatches, true);

    // 2. 防抖发起在线地址检索，补充更多具体地点与详细地址
    if (amapSuggestionDebounceTimer) clearTimeout(amapSuggestionDebounceTimer);
    amapSuggestionDebounceTimer = setTimeout(async () => {
        if (amapSuggestionAbortController) {
            amapSuggestionAbortController.abort();
        }
        amapSuggestionAbortController = new AbortController();

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&limit=6&accept-language=zh-CN`;
            const resp = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                signal: amapSuggestionAbortController.signal
            });
            if (!resp.ok) {
                renderAmapSearchSuggestions(localMatches, false);
                return;
            }
            const data = await resp.json();
            const merged = [...localMatches];

            if (Array.isArray(data)) {
                for (const entry of data) {
                    const wgsLat = parseFloat(entry.lat);
                    const wgsLng = parseFloat(entry.lon);
                    if (isNaN(wgsLat) || isNaN(wgsLng)) continue;

                    const [gcjLng, gcjLat] = CoordTransform.wgs84ToGcj02(wgsLng, wgsLat);
                    const primaryName = entry.name || (entry.display_name ? entry.display_name.split(',')[0].trim() : query);
                    const fullAddr = entry.display_name || `${gcjLng.toFixed(4)}°E, ${gcjLat.toFixed(4)}°N`;

                    // 避免与已有同名同位置项重复
                    const isDuplicate = merged.some(m =>
                        m.name === primaryName &&
                        Math.abs(m.gcjLng - gcjLng) < 0.02 &&
                        Math.abs(m.gcjLat - gcjLat) < 0.02
                    );
                    if (!isDuplicate) {
                        merged.push({
                            name: primaryName,
                            address: fullAddr,
                            gcjLng: gcjLng,
                            gcjLat: gcjLat
                        });
                    }
                }
            }

            renderAmapSearchSuggestions(merged.slice(0, 8), false);
        } catch (err) {
            if (err && err.name === 'AbortError') return;
            renderAmapSearchSuggestions(localMatches, false);
        }
    }, 220);
}

// 搜索地点（优先匹配本地风光摄影名胜词库，支持在线地理编码）
async function searchAmapLocation(query) {
    if (!query || !query.trim()) return;
    query = query.trim();
    hideAmapSearchSuggestions();

    // 1. 本地知名风光胜地模糊匹配
    for (const preset of SCENIC_PRESETS) {
        if (preset.name.includes(query) || query.includes(preset.name)) {
            setAmapPickerLocation(preset.gcjLng, preset.gcjLat, preset.name, true, 13);
            return;
        }
    }

    // 2. 发起在线地理编码
    try {
        if (amapSearchBtn) {
            amapSearchBtn.textContent = "搜索中...";
            amapSearchBtn.disabled = true;
        }
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=zh-CN`, {
            headers: { 'Accept': 'application/json' }
        });
        if (resp.ok) {
            const data = await resp.json();
            if (data && data.length > 0) {
                const wgsLat = parseFloat(data[0].lat);
                const wgsLng = parseFloat(data[0].lon);
                // Nominatim 返回的是国际 WGS-84 坐标，转换为高德 GCJ-02 放置到瓦片地图上
                const [gcjLng, gcjLat] = CoordTransform.wgs84ToGcj02(wgsLng, wgsLat);
                const displayName = data[0].name || (data[0].display_name ? data[0].display_name.split(',')[0] : query);
                setAmapPickerLocation(gcjLng, gcjLat, displayName, true, 13);
                return;
            }
        }
    } catch (err) {
        console.warn("地理编码搜索异常:", err);
    } finally {
        if (amapSearchBtn) {
            amapSearchBtn.textContent = "搜索";
            amapSearchBtn.disabled = false;
        }
    }

    if (amapCurrentLocationName) {
        amapCurrentLocationName.textContent = `未搜索到 "${query}"，请在地图上手动点击拾取或输入经纬度`;
    }
}

// 解析并定位右上角经纬度输入框中的自定义坐标
function parsePastedAmapCoordinates() {
    const rawLng = amapLngInput ? amapLngInput.value.trim() : '';
    const rawLat = amapLatInput ? amapLatInput.value.trim() : '';

    let lng = parseFloat(rawLng);
    let lat = parseFloat(rawLat);

    // 兼容用户在其中一个输入框内直接粘贴了“经度, 纬度”组合文本的情况
    const combinedText = `${rawLng},${rawLat}`.replace(/，/g, ',').replace(/；/g, ',').replace(/;/g, ',');
    const matches = combinedText.match(/[-+]?[0-9]*\.?[0-9]+/g);

    if ((isNaN(lng) || isNaN(lat)) && matches && matches.length >= 2) {
        const val1 = parseFloat(matches[0]);
        const val2 = parseFloat(matches[1]);
        if (val1 >= 60 && val1 <= 150 && val2 >= 0 && val2 <= 65) {
            lng = val1;
            lat = val2;
        } else if (val2 >= 60 && val2 <= 150 && val1 >= 0 && val1 <= 65) {
            lng = val2;
            lat = val1;
        } else {
            lng = val1;
            lat = val2;
        }
    }

    if (isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        if (amapCoordInputGroup) amapCoordInputGroup.style.borderColor = '#ef4444';
        return;
    }

    if (amapCoordInputGroup) amapCoordInputGroup.style.borderColor = '#cbd5e1';
    setAmapPickerLocation(lng, lat, "自定义坐标点", true, 14);
    if (amapLngInput) amapLngInput.blur();
    if (amapLatInput) amapLatInput.blur();
}

// 将高德地图拾取的坐标传递给 Cesium 并执行飞入或预览
function flyFromAmapToCesium(startDirectly = true) {
    if (!amapWgsCoord || isNaN(amapWgsCoord.lng) || isNaN(amapWgsCoord.lat)) {
        return;
    }

    const wgsLng = amapWgsCoord.lng;
    const wgsLat = amapWgsCoord.lat;

    console.log(`[高德拾取器] 传递至 Cesium: WGS-84 经度 ${wgsLng.toFixed(6)}°, 纬度 ${wgsLat.toFixed(6)}° (高德原始 GCJ-02: ${amapGcjCoord.lng.toFixed(6)}°, ${amapGcjCoord.lat.toFixed(6)}°)`);

    // 关闭高德拾取器窗口
    closeAmapPicker();

    // 计算三维世界坐标与地表高度
    const cartographic = Cesium.Cartographic.fromDegrees(wgsLng, wgsLat);
    const globeHeight = viewer.scene.globe.getHeight(cartographic);
    const estimatedHeight = (typeof globeHeight === 'number' && !isNaN(globeHeight)) ? globeHeight : 0;
    const position = Cesium.Cartesian3.fromDegrees(wgsLng, wgsLat, estimatedHeight);

    // 同步更新选点状态与界面信息
    selectedPosition = position;
    preloadedTerrainHeight = estimatedHeight;
    selectedLongitude.textContent = wgsLng.toFixed(6) + '°';
    selectedLatitude.textContent = wgsLat.toFixed(6) + '°';
    confirmSelectionBtn.disabled = false;

    // 添加选择点屏幕标记
    addSelectionMarker(position);

    // 后台并行预采样最高精度地表高程
    const currentSelectionId = ++selectionCounter;
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
            console.log("后台预采样高精度地形高度失败:", e);
        }
        return estimatedHeight;
    })();

    if (startDirectly) {
        // 直接飞入并无缝进入相机模拟模式
        startCameraMode(position);
    } else {
        // 在三维地球上以俯视预览该位置（距地表 5000 米）
        const previewHeight = Math.max(estimatedHeight + 5000, 3000);
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(wgsLng, wgsLat, previewHeight),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-60),
                roll: 0.0
            },
            duration: 2.0,
            easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
            complete: function() {
                console.log("已定位到该机位俯视预览视角");
            }
        });
    }
}

// 初始化高德地图坐标拾取器
function initAmapPicker() {
    if (typeof L === 'undefined') {
        console.warn("Leaflet 库尚在加载中，200ms 后自动重试初始化高德坐标拾取器...");
        setTimeout(initAmapPicker, 200);
        return;
    }

    if (amapMap) return;

    const mapContainer = document.getElementById('amapLeafletMap');
    if (!mapContainer) return;

    // 创建 Leaflet 实例，默认视角为全中国（初始不添加红标）
    amapMap = L.map('amapLeafletMap', {
        center: [36.0, 105.0],
        zoom: 4,
        zoomControl: true,
        attributionControl: false
    });

    // 创建高德街道矢量图层 (style=7)
    amapVectorLayer = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', {
        subdomains: ['1','2','3','4'],
        maxZoom: 18
    }).addTo(amapMap);

    // 创建高德卫星影像与路网标注图层 (style=6 + style=8)
    const satTile = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}', {
        subdomains: ['1','2','3','4'],
        maxZoom: 18
    });
    const roadTile = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        subdomains: ['1','2','3','4'],
        maxZoom: 18
    });
    amapSatGroup = L.layerGroup([satTile, roadTile]);

    // 监听地图点击事件（点击后创建或移动红标）
    amapMap.on('click', function(e) {
        setAmapPickerLocation(e.latlng.lng, e.latlng.lat, "地图点击拾取点");
    });

    // 绑定矢量/卫星图层切换按钮
    if (amapLayerVectorBtn) {
        amapLayerVectorBtn.addEventListener('click', () => switchAmapLayer('vector'));
    }
    if (amapLayerSatBtn) {
        amapLayerSatBtn.addEventListener('click', () => switchAmapLayer('satellite'));
    }

    // 绑定热门风光预设标签点击事件
    document.querySelectorAll('.amap-preset-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            const lng = parseFloat(this.getAttribute('data-lng'));
            const lat = parseFloat(this.getAttribute('data-lat'));
            const name = this.getAttribute('data-name');
            if (!isNaN(lng) && !isNaN(lat)) {
                setAmapPickerLocation(lng, lat, name, true, 13);
            }
        });
    });

    // 绑定地点搜索按钮、输入自动补全提示与键盘上下键选择
    if (amapSearchBtn && amapSearchInput) {
        amapSearchBtn.addEventListener('click', () => searchAmapLocation(amapSearchInput.value));

        amapSearchInput.addEventListener('input', (e) => {
            handleAmapSearchAutocomplete(e.target.value);
        });

        amapSearchInput.addEventListener('focus', () => {
            if (amapSearchInput.value.trim()) {
                handleAmapSearchAutocomplete(amapSearchInput.value);
            }
        });

        amapSearchInput.addEventListener('keydown', (e) => {
            if (amapCurrentSuggestions.length > 0 && amapSearchSuggestions && amapSearchSuggestions.style.display !== 'none') {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    amapActiveSuggestionIndex = (amapActiveSuggestionIndex + 1) % amapCurrentSuggestions.length;
                    updateActiveSuggestionHighlight();
                    return;
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    amapActiveSuggestionIndex = (amapActiveSuggestionIndex - 1 + amapCurrentSuggestions.length) % amapCurrentSuggestions.length;
                    updateActiveSuggestionHighlight();
                    return;
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (amapActiveSuggestionIndex >= 0 && amapActiveSuggestionIndex < amapCurrentSuggestions.length) {
                        selectAmapSuggestionItem(amapCurrentSuggestions[amapActiveSuggestionIndex]);
                    } else {
                        searchAmapLocation(amapSearchInput.value);
                    }
                    return;
                } else if (e.key === 'Escape') {
                    hideAmapSearchSuggestions();
                    return;
                }
            }
            if (e.key === 'Enter') {
                searchAmapLocation(amapSearchInput.value);
            }
        });

        // 点击搜索区域外部时收起下拉提示列表
        document.addEventListener('click', (e) => {
            if (amapSearchWrapper && !amapSearchWrapper.contains(e.target)) {
                hideAmapSearchSuggestions();
            }
        });
    }

    // 绑定经纬度输入框交互：点击或输入时显示“定位”按钮，支持粘贴自动拆分及回车定位
    const showLocateButton = () => {
        if (amapPasteBtn) amapPasteBtn.style.display = 'inline-block';
    };

    const handleCoordPasteSplit = (e) => {
        const val = e.target.value;
        if (val && (val.includes(',') || val.includes('，') || val.includes(';'))) {
            const nums = val.replace(/，/g, ',').replace(/;/g, ',').match(/[-+]?[0-9]*\.?[0-9]+/g);
            if (nums && nums.length >= 2) {
                if (amapLngInput) amapLngInput.value = nums[0];
                if (amapLatInput) amapLatInput.value = nums[1];
            }
        }
        showLocateButton();
    };

    [amapLngInput, amapLatInput].forEach(inputEl => {
        if (!inputEl) return;
        inputEl.addEventListener('focus', showLocateButton);
        inputEl.addEventListener('click', showLocateButton);
        inputEl.addEventListener('input', handleCoordPasteSplit);
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') parsePastedAmapCoordinates();
        });
    });

    if (amapPasteBtn) {
        amapPasteBtn.addEventListener('click', () => parsePastedAmapCoordinates());
    }

    // 绑定关闭弹窗按钮
    if (closeAmapPickerModalBtn) {
        closeAmapPickerModalBtn.addEventListener('click', closeAmapPicker);
    }
    if (amapCloseBtn) {
        amapCloseBtn.addEventListener('click', closeAmapPicker);
    }

    // 绑定确认选择并飞入Cesium模拟画面
    if (amapConfirmFlyBtn) {
        amapConfirmFlyBtn.addEventListener('click', function() {
            flyFromAmapToCesium(true);
        });
    }

    // 绑定在三维地球上预览此点
    if (amapPreviewBtn) {
        amapPreviewBtn.addEventListener('click', function() {
            flyFromAmapToCesium(false);
        });
    }

    // 绑定选点浮窗与相机控制栏中的高德地图拾取器触发按钮
    if (openAmapPickerBtn) {
        openAmapPickerBtn.addEventListener('click', openAmapPicker);
    }
    if (openAmapPickerFromControlsBtn) {
        openAmapPickerFromControlsBtn.addEventListener('click', openAmapPicker);
    }
}

// 打开高德坐标拾取器弹窗
function openAmapPicker() {
    if (!amapPickerModal) return;
    amapPickerModal.style.display = 'flex';
    if (!amapMap) {
        initAmapPicker();
    }
    setTimeout(() => {
        if (amapMap) {
            amapMap.invalidateSize();
            const targetLat = amapGcjCoord ? amapGcjCoord.lat : 36.0;
            const targetLng = amapGcjCoord ? amapGcjCoord.lng : 105.0;
            amapMap.setView([targetLat, targetLng], amapMap.getZoom() || 4);
        }
    }, 120);
}

// 关闭高德坐标拾取器弹窗
function closeAmapPicker() {
    hideAmapSearchSuggestions();
    if (!amapPickerModal) return;
    amapPickerModal.style.display = 'none';
}

// 使悬浮面板支持鼠标直接拖拽移动位置（不记忆位置，刷新即重置为默认）
function makePanelDraggable(panelEl) {
    if (!panelEl || panelEl._isDraggableInitialized) return;
    panelEl._isDraggableInitialized = true;

    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    panelEl.addEventListener('mousedown', function(e) {
        // 仅响应鼠标左键
        if (e.button !== 0) return;

        // 排除面板内部交互控件（按钮、输入框、滑块、链接、开关等），避免干扰正常点击与滑动
        if (e.target.closest('button, input, a, select, textarea, label.switch, .slider')) {
            return;
        }

        isDragging = true;
        const rect = panelEl.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        // 切换为以左上角像素坐标绝对定位（消除 right 或 transform: translateX(-50%) 带来的偏移跳变）
        panelEl.style.left = rect.left + 'px';
        panelEl.style.top = rect.top + 'px';
        panelEl.style.right = 'auto';
        panelEl.style.bottom = 'auto';
        panelEl.style.transform = 'none';

        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;

        const rect = panelEl.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - rect.width);
        const maxTop = Math.max(0, window.innerHeight - rect.height);

        const newLeft = Math.min(Math.max(0, e.clientX - dragOffsetX), maxLeft);
        const newTop = Math.min(Math.max(0, e.clientY - dragOffsetY), maxTop);

        panelEl.style.left = newLeft + 'px';
        panelEl.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
        }
    });
}

// 初始化三个悬浮菜单面板的鼠标拖拽功能
function initDraggablePanels() {
    makePanelDraggable(controls);     // 相机控制菜单
    makePanelDraggable(timeControls); // 时间设置菜单
    makePanelDraggable(cameraInfo);   // 经纬度和方位角菜单
}

// 主初始化函数
function main() {
    console.log("开始初始化...");
    
    // 初始化完整地球视图
    initializeGlobe();
    
    // 提前在后台预加载3D地形，避免选点进入相机模式时因发起网络请求而产生数秒的原地卡顿
    initializeTerrain();

    // 初始化相机控制菜单、时间设置菜单、经纬度和方位角菜单的鼠标拖拽功能
    initDraggablePanels();

    // 初始化高德地图坐标拾取器并在进入初始页面时优先弹出
    initAmapPicker();
    setTimeout(() => {
        openAmapPicker();
    }, 250);
}

// 启动主程序
main();

// Sandcastle 底部