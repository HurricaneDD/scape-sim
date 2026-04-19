// Sandcastle 头部
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlNzJjNDgxMS0wNGIxLTQwMmYtODYzMy03ODQ3Njg4Y2FlYzQiLCJpZCI6Mzk3MjkzLCJpYXQiOjE3NzI1NDc1NDN9.MTjRT7M805SQ81Q0dNgYhenCD-I4SOl3nAbFJOz0Dpg"

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

// 全局变量
let isSelectionMode = true; // 初始为选点模式
let selectedPosition = null; // 存储选中的位置
let selectionMarker = null; // 选择点标记
let baseTerrainHeight = 0; // 存储地表基础高度

// 获取DOM元素
const mapSelectionOverlay = document.getElementById('mapSelectionOverlay');
const selectedLongitude = document.getElementById('selectedLongitude');
const selectedLatitude = document.getElementById('selectedLatitude');
const confirmSelectionBtn = document.getElementById('confirmSelectionBtn');

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
    
    // 设置相机到完整地球视图
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(0, 0, 15000000), // 从太空看地球
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

// 开始相机模式
async function startCameraMode(position) {
    console.log("开始相机模式...");
    
    // 退出选点模式
    isSelectionMode = false;
    
    // 移除选择点标记
    if (selectionMarker) {
        selectionMarker.remove();
        selectionMarker = null;
    }
    
    // 隐藏选点提示框
    mapSelectionOverlay.style.display = 'none';
    
    // 加载3D地形
    await initializeTerrain();
    
    // 获取选中点的地形高度
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    let terrainHeight = 0;
    
    if (viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) {
        terrainHeight = 0;
    } else {
        try {
            const terrainSample = await Cesium.sampleTerrainMostDetailed(
                viewer.terrainProvider, 
                [cartographic]
            );
            terrainHeight = terrainSample[0].height;
        } catch (error) {
            console.log("获取地形高度失败:", error);
            terrainHeight = 0;
        }
    }
    
    baseTerrainHeight = terrainHeight;
    
    // 计算飞行目标位置（地面高度+25米）
    const targetHeight = terrainHeight + 25;
    const targetPosition = Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        targetHeight
    );
    
    // 飞行到选中位置
    viewer.camera.flyTo({
        destination: targetPosition,
        orientation: {
            heading: Cesium.Math.toRadians(0),    // 朝正北
            pitch: Cesium.Math.toRadians(0),      // 俯仰角为0（水平）
            roll: 0.0
        },
        duration: 3, // 3秒飞行时间
        complete: function() {
            // 飞行完成后显示相机控制界面
            showCameraControls();
            
            // 初始化相机控制
            initializeCameraControls();
            
            // 设置初始高度
            adjustHeight(25);
            
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
    try {
        // 使用 createWorldTerrainAsync 创建地形提供者
        const terrainProvider = await Cesium.createWorldTerrainAsync({
            requestVertexNormals: false,  // 默认不启用地形光照
            requestWaterMask: false       // 默认不启用水体效果
        });
        viewer.terrainProvider = terrainProvider;
        console.log("3D地形已加载");
    } catch (error) {
        console.log("地形加载失败:", error);
        // 如果地形加载失败，使用椭球体作为替代
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }
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

// 地形光照控制 - 根据知识库内容使用正确的方法
async function enableTerrainLighting() {
    try {
        console.log("开始开启地形光照...");
        
        // 根据知识库内容，使用正确的API开启地形光照
        const terrainProvider = await Cesium.createWorldTerrainAsync({
            requestVertexNormals: true,  // 开启顶点法线
            requestWaterMask: false
        });
        
        viewer.terrainProvider = terrainProvider;
        viewer.scene.globe.enableLighting = true;
        
        console.log("地形光照已开启");
        
        // 更新高度基准
        const position = viewer.scene.camera.positionWC;
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        const terrainSample = await Cesium.sampleTerrainMostDetailed(
            viewer.terrainProvider, 
            [cartographic]
        );
        baseTerrainHeight = terrainSample[0].height;
        
    } catch (error) {
        console.log("开启地形光照失败:", error);
    }
}

function disableTerrainLighting() {
    viewer.scene.globe.enableLighting = false;
    console.log("地形光照已关闭");
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
        
        // 获取UTC时间的各个组件
        const year = Cesium.JulianDate.getYear(currentTime);
        const month = Cesium.JulianDate.getMonth(currentTime); // 1-12
        const day = Cesium.JulianDate.getDayOfMonth(currentTime);
        const hour = Cesium.JulianDate.getHours(currentTime);
        const minute = Cesium.JulianDate.getMinutes(currentTime);
        const second = Cesium.JulianDate.getSeconds(currentTime);
        
        // 手动格式化UTC时间
        const formattedDate = [
            year,
            String(month).padStart(2, '0'),
            String(day).padStart(2, '0')
        ].join('-');
        
        const formattedTime = [
            String(hour).padStart(2, '0'),
            String(minute).padStart(2, '0'),
            String(Math.floor(second)).padStart(2, '0')
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

// 主初始化函数
function main() {
    console.log("开始初始化...");
    
    // 初始化完整地球视图
    initializeGlobe();
}

// 启动主程序
main();

// Sandcastle 底部