
// 时间序列分析组件
const TimeSeriesAnalysis = {
    template: `
        <div class="time-series-container">
            <div class="points-container">
                <div class="points-header">
                <h3>Selected Points</h3>
                    <button class="clear-all-btn" @click="clearAllPoints">Clear All</button>
                </div>
                <div class="usage-hint" v-if="!hasPoints">
                    <div class="hint-icon">📍</div>
                    <p>Click on the map to select points for analysis</p>
                </div>
                <div id="point-cards"></div>
            </div>
            <div class="plot-container">
                <div id="plot-container"></div>
            </div>
        </div>
    `,
    data() {
        return {
            pointCount: 0
        };
    },
    mounted() {
        this.initMapHandlers();
    },
    methods: {
        initMapHandlers() {
            // 确保地图已初始化
            if (!window.map) return;

            // 清空现有点
            if (window.pointsLayer) {
                window.map.removeLayer(window.pointsLayer);
            }

            // 创建点图层
            const pointsSource = new ol.source.Vector();
            window.pointsLayer = new ol.layer.Vector({
                source: pointsSource,
                zIndex: 1000
            });
            window.map.addLayer(window.pointsLayer);

            window.points = [];
            this.pointCount = 0;
            window.nextPointIndex = 1;
            window.allColors = [
                '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
                '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
                '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d2', '#dbdb8d',
                '#9edae5', '#393b79', '#e6550d', '#31a354', '#756bb1'
            ];

            // 使用 OpenLayers 的点击事件
            this.mapClickHandler = (evt) => this.handleMapClick(evt);
            window.map.on('singleclick', this.mapClickHandler);
        },
        async handleMapClick(e) {
            // OpenLayers 坐标转换
            const coordinate = e.coordinate;
            const lonLat = ol.proj.toLonLat(coordinate);
            const lng = lonLat[0];
            const lat = lonLat[1];
            
            try {
                // 获取根实例来更新全局加载状态
                const root = this.$root || this;
                if (root.timeseriesLoading !== undefined) {
                    root.timeseriesLoading = true;
                }
                const response = await fetch(`${API_BASE_URL}/api/analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        latitude: lat,
                        longitude: lng,
                        event_thr: 0.4,
                        min_span_steps: 1
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Analysis failed');
                }

                const data = await response.json();
                
                const pointColor = this.getNextAvailableColor();
                const pointName = this.getNextPointName();
                
                // 创建 OpenLayers 点要素
                const feature = new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat([lng, lat]))
                });
                
                feature.setStyle(new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: 8,
                        fill: new ol.style.Fill({ color: pointColor }),
                        stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
                    })
                }));
                
                window.pointsLayer.getSource().addFeature(feature);
                
                const point = {
                    id: Date.now(),
                    name: pointName,
                    lat,
                    lng,
                    color: pointColor,
                    marker: feature,
                    data: data
                };
                
            window.points.push(point);
            this.pointCount = window.points.length;
            this.updatePointCards();
            this.updatePlot();
                
            } catch (error) {
                console.error('Analysis failed:', error);
                alert('Analysis failed: ' + error.message);
            } finally {
                // 重置全局加载状态
                const root = this.$root || this;
                if (root.timeseriesLoading !== undefined) {
                    root.timeseriesLoading = false;
                }
            }
        },
        getNextAvailableColor() {
            const usedColors = window.points.map(p => p.color);
            return window.allColors.find(color => !usedColors.includes(color)) || window.allColors[0];
        },
        getNextPointName() {
            return `A${window.nextPointIndex++}`;
        },
        updatePointCards() {
            const container = document.getElementById('point-cards');
            container.innerHTML = '';
            
            window.points.forEach(point => {
                const card = document.createElement('div');
                card.className = 'point-card';
                
                const info = document.createElement('div');
                info.className = 'point-info';
                
                const colorDot = document.createElement('div');
                colorDot.className = 'point-color';
                colorDot.style.backgroundColor = point.color;
                
                const details = document.createElement('div');
                details.className = 'point-details';
                
                const pointName = document.createElement('div');
                pointName.className = 'point-name';
                pointName.textContent = `${point.name} (${point.lat.toFixed(6)}, ${point.lng.toFixed(6)})`;
                
                const prob = document.createElement('div');
                prob.className = 'probability';
                prob.textContent = `Probability: ${(point.data.probability * 100).toFixed(1)}%`;
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.innerHTML = '×';
                deleteBtn.onclick = () => this.deletePoint(point.id);
                
                details.appendChild(pointName);
                details.appendChild(prob);
                info.appendChild(colorDot);
                info.appendChild(details);
                card.appendChild(info);
                card.appendChild(deleteBtn);
                container.appendChild(card);
            });
        },
        deletePoint(id) {
            const pointIndex = window.points.findIndex(p => p.id === id);
            if (pointIndex !== -1) {
                // OpenLayers 移除要素
                window.pointsLayer.getSource().removeFeature(window.points[pointIndex].marker);
                window.points.splice(pointIndex, 1);
                this.pointCount = window.points.length;
                this.updatePointCards();
                this.updatePlot();
            }
        },
        clearAllPoints() {
            if (window.points && window.points.length > 0) {
                // OpenLayers 清空所有要素
                window.pointsLayer.getSource().clear();
                window.points = [];
                this.pointCount = 0;
                this.updatePointCards();
                this.updatePlot();
            }
        },
        updatePlot() {
            const getYears = length => Array.from({length}, (_, i) => 1986 + i);
            
            const traces = window.points.map(point => ({
                x: getYears(point.data.ndvi_values.length),
                y: point.data.ndvi_values,
                type: 'scatter',
                name: point.name,
                line: { color: point.color },
                showlegend: true
            }));
            
            const shapes = window.points.reduce((acc, point) => {
                if (point.data.has_event && point.data.dip_idx !== null && point.data.tr_idx !== null) {
                    acc.push(
                        {
                            type: 'line',
                            x0: 1986 + point.data.dip_idx,
                            x1: 1986 + point.data.dip_idx,
                            y0: -2,
                            y1: 2,
                            line: {
                                color: point.color,
                                width: 2,
                                dash: 'dash'
                            }
                        },
                        {
                            type: 'line',
                            x0: 1986 + point.data.tr_idx,
                            x1: 1986 + point.data.tr_idx,
                            y0: -2,
                            y1: 2,
                            line: {
                                color: point.color,
                                width: 2,
                                dash: 'dash'
                            }
                        }
                    );
                }
                return acc;
            }, []);
            
            const layout = {
                title: 'NDVI Time Series Comparison',
                xaxis: {
                    title: 'Year',
                    tickmode: 'linear',
                    dtick: 5
                },
                yaxis: {
                    title: 'NDVI Z-Score'
                },
                shapes: shapes,
                showlegend: true,
                legend: {
                    x: 1,
                    xanchor: 'right',
                    y: 1
                }
            };
            
            Plotly.newPlot('plot-container', traces, layout);
        }
    },
    beforeUnmount() {
        // 移除地图点击事件
        if (window.map && this.mapClickHandler) {
            window.map.un('singleclick', this.mapClickHandler);
        }
        
        // 清理地图上的所有点标记
        if (window.pointsLayer) {
            window.pointsLayer.getSource().clear();
        }
        if (window.points) {
            window.points = [];
        }
        
        // 清空点卡片容器
        const container = document.getElementById('point-cards');
        if (container) {
            container.innerHTML = '';
        }
        
        // 清空图表容器
        const plotContainer = document.getElementById('plot-container');
        if (plotContainer) {
            plotContainer.innerHTML = '';
        }
        
        // 重置点索引
        window.nextPointIndex = 1;
    },
    computed: {
        hasPoints() {
            return this.pointCount > 0;
        }
    }
};

// YOLO检测组件
const YoloDetection = {
    template: `
        <div class="yolo-container">
            <div class="yolo-controls">
                <div class="screenshot-hint" v-if="!screenshotImage && !detectionResult">
                    <div class="hint-icon">📸</div>
                    <p>Use the screenshot tool in the top-right corner of the map to capture an area for detection</p>
                </div>
                <div v-if="screenshotImage && !detectionResult" class="preview-panel">
                    <h3>Screenshot Preview</h3>
                    <div class="preview-image">
                        <img :src="screenshotImage" alt="Screenshot Preview" />
                    </div>
                    <div class="preview-actions">
                        <button class="action-btn detect" @click="detectObjects" :disabled="loading">
                            {{ loading ? 'Detecting...' : 'Detect Objects' }}
                        </button>
                        <button class="action-btn cancel" @click="clearScreenshot">Cancel</button>
                    </div>
                </div>
                <div v-if="loading" class="loading-overlay">
                    <div class="loading-spinner"></div>
                    <p>Processing image...</p>
                </div>
            </div>
            <div v-if="detectionResult" class="detection-results">
                <div class="result-header">
                    <h3>Detection Results</h3>
                    <button class="clear-btn" @click="clearResults">Clear</button>
                </div>
                <div class="result-content">
                    <div class="result-image" style="position:relative; width:100%;">
                        <img :src="originalImage" alt="Detection Result" ref="resultImg" @load="syncCanvas" style="width:100%; height:auto; display:block;"/>
                        <canvas ref="overlay" style="position:absolute; left:0; top:0; pointer-events:none;"></canvas>
                    </div>
                    <div class="result-stats">
                        <div class="stat-item">
                            <span class="stat-label">Objects Detected:</span>
                            <span class="stat-value">{{detectionResult.num_detections}}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Confidence Threshold:</span>
                            <span class="stat-value">{{(detectionResult.conf_thres * 100).toFixed(1)}}%</span>
                        </div>
                    </div>
                    <div class="detections-list">
                        <h4>Detected Objects</h4>
                        <div class="detection-item" v-for="(det, index) in detectionResult.detections" :key="index">
                            <div class="detection-header">
                                <span class="detection-label">{{det.label}}</span>
                                <span class="detection-confidence">{{(det.confidence * 100).toFixed(1)}}%</span>
                            </div>
                            <div class="detection-bbox">
                                <span>Box: [{{det.bbox.map(x => x.toFixed(1)).join(', ')}}]</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            loading: false,
            detectionResult: null,
            screenshotImage: null,
            screenshotBlob: null,
            originalImage: null,
            objectUrl: null
        };
    },
    mounted() {
        console.log('YoloDetection mounted');
        // 监听全局截图事件
        window.addEventListener('screenshot-taken', this.handleScreenshot);
        // 监听窗口大小变化，重新绘制检测框
        window.addEventListener('resize', this.handleResize);
        
        // 使用ResizeObserver监听图片容器大小变化（包括面板调整）
        this.setupResizeObserver();
    },
    unmounted() {
        window.removeEventListener('screenshot-taken', this.handleScreenshot);
        window.removeEventListener('resize', this.handleResize);
        
        // 清理ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        
        // 清理 blob URL
        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
            this.objectUrl = null;
        }
    },
    methods: {
        setupResizeObserver() {
            // 等待下一帧确保DOM已渲染
            this.$nextTick(() => {
                const img = this.$refs.resultImg;
                if (img && window.ResizeObserver) {
                    // 清理旧的observer
                    if (this.resizeObserver) {
                        this.resizeObserver.disconnect();
                    }
                    
                    // 创建新的observer
                    this.resizeObserver = new ResizeObserver(() => {
                        if (this.detectionResult) {
                            this.syncCanvas();
                        }
                    });
                    this.resizeObserver.observe(img);
                }
            });
        },
        handleResize() {
            // 当窗口大小变化时，重新调整canvas和重绘检测框
            if (this.detectionResult) {
                this.$nextTick(() => this.syncCanvas());
            }
        },
        handleScreenshot(event) {
            console.log('收到截图事件:', event.detail);
            // 清理旧的 blob URL
            if (this.objectUrl) {
                URL.revokeObjectURL(this.objectUrl);
            }
            
            // 保存新的 blob URL
            this.objectUrl = event.detail.imageUrl;
            this.screenshotImage = event.detail.imageUrl;
            this.screenshotBlob = event.detail.blob;
            this.originalImage = event.detail.imageUrl;
            this.detectionResult = null;
        },
        async detectObjects() {
            if (!this.screenshotBlob || !this.screenshotImage) return;
            
            try {
                this.loading = true;
                
                // 保存原始图像用于显示结果
                this.originalImage = this.screenshotImage;
                
                // 创建FormData对象
                const formData = new FormData();
                formData.append('file', this.screenshotBlob, 'screenshot.png');

                // 发送到后端进行检测
                const response = await fetch(`${API_BASE_URL}/api/yolo/predict`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('Detection failed');
                }

                this.detectionResult = await response.json();
                
                // 清除预览图像（但保留 originalImage 用于结果显示）
                this.screenshotImage = null;
                this.screenshotBlob = null;
                
                // 在下一帧绘制检测框并设置ResizeObserver
                this.$nextTick(() => {
                    this.syncCanvas();
                    this.setupResizeObserver();
                });
            } catch (error) {
                console.error('Detection failed:', error);
                alert('Detection failed: ' + error.message);
            } finally {
                this.loading = false;
            }
        },
        syncCanvas() {
            const img = this.$refs.resultImg;
            const canvas = this.$refs.overlay;
            if (!img || !canvas) return;
            
            const rect = img.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            
            this.drawDetections();
        },
        drawDetections() {
            const canvas = this.$refs.overlay;
            const img = this.$refs.resultImg;
            if (!canvas || !img || !this.detectionResult) {
                return;
            }
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const scaleX = canvas.width / img.naturalWidth;
            const scaleY = canvas.height / img.naturalHeight;

            for (const d of this.detectionResult.detections || []) {
                const [x1, y1, x2, y2] = d.bbox;
                const x = x1 * scaleX;
                const y = y1 * scaleY;
                const w = (x2 - x1) * scaleX;
                const h = (y2 - y1) * scaleY;
                
                // 绘制边界框
                ctx.strokeStyle = '#00ff00';  // 绿色
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, w, h);
                
                // 绘制标签
                const label = `${d.label} ${(d.confidence * 100).toFixed(1)}%`;
                ctx.font = 'bold 14px Arial';
                ctx.textBaseline = 'top';
                const textW = ctx.measureText(label).width + 8;
                const textH = 20;
                
                // 标签背景
                ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
                ctx.fillRect(x, Math.max(0, y - textH - 2), textW, textH);
                
                // 标签文字
                ctx.fillStyle = '#000';
                ctx.fillText(label, x + 4, Math.max(2, y - textH));
            }
        },
        clearScreenshot() {
            this.screenshotImage = null;
            this.screenshotBlob = null;
            this.originalImage = null;
            if (this.objectUrl) {
                URL.revokeObjectURL(this.objectUrl);
                this.objectUrl = null;
            }
            const canvas = this.$refs.overlay;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        },
        clearResults() {
            this.detectionResult = null;
            this.originalImage = null;
            if (this.objectUrl) {
                URL.revokeObjectURL(this.objectUrl);
                this.objectUrl = null;
            }
            const canvas = this.$refs.overlay;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    }
};

// 空路由组件（用于默认页面）
const EmptyView = {
    template: '<div></div>'
};

// 路由配置
const routes = [
    { 
        path: '/', 
        component: EmptyView,
        name: 'home'
    },
    { 
        path: '/route2', 
        component: TimeSeriesAnalysis,
        name: 'route2'
    },
    { 
        path: '/route3', 
        component: YoloDetection,
        name: 'route3'
    }
];

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes
});

// 创建Vue应用
const app = Vue.createApp({
    data() {
        return {
            currentRoute: '/',
            isScreenshotMode: false,
            screenshotRect: null,
            screenshotImage: null,
            screenshotBlob: null,
            timeseriesLoading: false,
            isPanelVisible: false,
            isPanelFixed: false,
            panelHideTimer: null
        };
    },
    watch: {
        $route(to) {
            this.currentRoute = to.path;
            // 如果切换到首页，解除固定状态
            if (to.path === '/') {
                this.isPanelFixed = false;
                this.isPanelVisible = false;
            }
            // 清理测量工具
            if (this.measureType) {
                this.measureType = null;
                this.removeMeasureInteraction();
            }
        }
    },
    mounted() {
        // 检测页面刷新，强制回到home
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries.length > 0 && navEntries[0].type === 'reload') {
            // 页面刷新时，重定向到home
            this.$router.replace('/');
        }
        
        // 初始化地图
        this.initMap();
        this.currentRoute = this.$route.path;
        this.initResizablePanel();
    },
    methods: {
        showPanel() {
            if (this.isPanelFixed) return;
            this.isPanelVisible = true;
            if (this.panelHideTimer) {
                clearTimeout(this.panelHideTimer);
                this.panelHideTimer = null;
            }
        },
        hidePanel() {
            if (this.isPanelFixed) return;
            this.panelHideTimer = setTimeout(() => {
                this.isPanelVisible = false;
            }, 300);
        },
        handlePanelMouseEnter() {
            if (this.panelHideTimer) {
                clearTimeout(this.panelHideTimer);
                this.panelHideTimer = null;
            }
        },
        handlePanelMouseLeave() {
            this.hidePanel();
        },
        activateRoute(path) {
            // 固定面板
            this.isPanelFixed = true;
            this.isPanelVisible = true;
            if (this.panelHideTimer) {
                clearTimeout(this.panelHideTimer);
                this.panelHideTimer = null;
            }
            
            // 切换路由
            this.$router.push(path);
            
            // 延迟调整地图大小，等待面板完全显示
            this.$nextTick(() => {
                setTimeout(() => {
                    if (window.map) {
                        window.map.updateSize();
                    }
                }, 300);
            });
        },
        closePanel() {
            // 解除固定状态
            this.isPanelFixed = false;
            this.isPanelVisible = false;
            
            // 返回首页
            this.$router.push('/');
            
            // 如果在截图模式，退出截图模式
            if (this.isScreenshotMode) {
                this.startScreenshot(); // 切换状态以退出截图模式
            }
            
            // 重置面板和地图容器的尺寸样式
            const mapContainer = document.querySelector('.map-container');
            const rightPanel = document.querySelector('.right-panel');
            
            if (mapContainer) {
                mapContainer.style.flex = '';  // 清除 flex 设置，恢复默认
            }
            
            if (rightPanel) {
                rightPanel.style.width = '';  // 清除宽度设置，恢复 CSS 默认值 (500px)
            }
            
            // 延迟调整地图大小，等待面板完全隐藏和样式重置
            this.$nextTick(() => {
                setTimeout(() => {
                    if (window.map) {
                        window.map.updateSize();
                    }
                }, 300);
            });
        },
        initResizablePanel() {
            const container = document.querySelector('.main-layout');
            const gutter = document.querySelector('.gutter');
            const mapContainer = document.querySelector('.map-container');
            const rightPanel = document.querySelector('.right-panel');

            let isResizing = false;

            if (gutter) {
            gutter.addEventListener('mousedown', (e) => {
                    if (!this.isPanelFixed) return;
                isResizing = true;
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', () => {
                    isResizing = false;
                    document.removeEventListener('mousemove', handleMouseMove);
                });
            });
            }

            const handleMouseMove = (e) => {
                if (!isResizing || !this.isPanelFixed) return;

                const containerRect = container.getBoundingClientRect();
                const percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
                
                if (percentage < 20 || percentage > 80) return;

                mapContainer.style.flex = `0 0 ${percentage}%`;
                rightPanel.style.width = `${100 - percentage}%`;
                
                if (window.map) {
                    window.map.updateSize();
                }
                
                // 如果存在plot容器且有数据，重新调整大小
                const plotContainer = document.getElementById('plot-container');
                if (plotContainer && plotContainer.data) {
                    Plotly.Plots.resize(plotContainer);
                }
            }
        },
        initMap() {
            // 创建影像图层组
            const tianditu = new ol.layer.Tile({
                title: '天地图影像',
                type: 'base',
                visible: false,
                source: new ol.source.XYZ({
                    url: 'https://t{0-7}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TileMatrix={z}&TileCol={x}&TileRow={y}&tk=76272abff72b48bbe6768915c647f48b',
                crossOrigin: 'anonymous'
                })
            });

            const googleSat = new ol.layer.Tile({
                title: 'Google 卫星',
                type: 'base',
                visible: false,
                source: new ol.source.XYZ({
                    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                    crossOrigin: 'anonymous'
                })
            });

            const esriImagery = new ol.layer.Tile({
                title: 'ESRI 影像',
                type: 'base',
                visible: true,
                source: new ol.source.XYZ({
                    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                    crossOrigin: 'anonymous'
                })
            });

            // 创建 RTS 图层
            let predictedRTSLayer = null;
            let xiadataRTSLayer = null;

            if (typeof json_PredictedRTS !== 'undefined' && json_PredictedRTS.features && json_PredictedRTS.features.length > 0) {
                const predictedSource = new ol.source.Vector({
                    features: new ol.format.GeoJSON().readFeatures(json_PredictedRTS, {
                        featureProjection: 'EPSG:3857'
                    })
                });

                predictedRTSLayer = new ol.layer.Vector({
                    title: 'Predicted RTS',
                    source: predictedSource,
                    style: new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: 'rgba(229,90,35,1.0)',
                            width: 2
                        }),
                        fill: new ol.style.Fill({
                            color: 'rgba(196,60,57,0.3)'
                        })
                    }),
                    visible: true
                });
            }

            if (typeof json_XiadataRTS !== 'undefined' && json_XiadataRTS.features && json_XiadataRTS.features.length > 0) {
                const xiadataSource = new ol.source.Vector({
                    features: new ol.format.GeoJSON().readFeatures(json_XiadataRTS, {
                        featureProjection: 'EPSG:3857'
                    })
                });

                xiadataRTSLayer = new ol.layer.Vector({
                    title: 'Xia RTS 2022',
                    source: xiadataSource,
                    style: new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: 'rgba(205,186,35,1.0)',
                            width: 2
                        }),
                        fill: new ol.style.Fill({
                            color: 'rgba(225,89,137,0.3)'
                        })
                    }),
                    visible: true
                });
            }

            // 创建图层数组
            const layers = [tianditu, googleSat, esriImagery];
            if (xiadataRTSLayer) layers.push(xiadataRTSLayer);
            if (predictedRTSLayer) layers.push(predictedRTSLayer);

            // 创建地图
            window.map = new ol.Map({
                target: 'map',
                layers: layers,
                view: new ol.View({
                    center: ol.proj.fromLonLat([92.74256077, 35.06289152]),
                    zoom: 16,
                    maxZoom: 21,
                    minZoom: 1
                })
            });

            // 添加图层切换控件（右下角，可折叠）
            const layerSwitcherContainer = document.createElement('div');
            layerSwitcherContainer.className = 'ol-layer-switcher-container';
            layerSwitcherContainer.style.cssText = 'position: absolute; bottom: 30px; left: 10px; z-index: 1000;';
            
            // 折叠/展开按钮
            const toggleButton = document.createElement('button');
            toggleButton.className = 'layer-switcher-toggle';
            toggleButton.innerHTML = '<i class="fas fa-layer-group"></i>';
            toggleButton.title = 'Layer Control';
            toggleButton.style.cssText = 'background: rgba(255,255,255,0.9); border: none; width: 40px; height: 40px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); cursor: pointer; font-size: 16px; color: #333; display: flex; align-items: center; justify-content: center; transition: all 0.3s;';
            
            // 图层面板
            const layerSwitcher = document.createElement('div');
            layerSwitcher.className = 'ol-layer-switcher-panel';
            layerSwitcher.style.cssText = 'background: rgba(255,255,255,0.95); padding: 12px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); max-height: 400px; overflow-y: auto; margin-bottom: 8px; display: none; min-width: 200px; position: absolute; bottom: 48px; left: 0;';
            
            // 标题栏
            const layerHeader = document.createElement('div');
            layerHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ddd;';
            
            const layerTitle = document.createElement('div');
            layerTitle.textContent = 'Layer Control';
            layerTitle.style.cssText = 'font-weight: bold; font-size: 14px; color: #333;';
            
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = 'background: none; border: none; font-size: 20px; cursor: pointer; color: #666; padding: 0; width: 20px; height: 20px; line-height: 1;';
            closeBtn.title = 'Close';
            
            layerHeader.appendChild(layerTitle);
            layerHeader.appendChild(closeBtn);
            layerSwitcher.appendChild(layerHeader);

            // 底图选择
            const baseLayerDiv = document.createElement('div');
            baseLayerDiv.style.marginBottom = '12px';
            
            const baseTitle = document.createElement('div');
            baseTitle.textContent = 'Base Maps:';
            baseTitle.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 600;';
            baseLayerDiv.appendChild(baseTitle);
            
            const baseLayerNames = {
                '天地图影像': 'Tianditu',
                'Google 卫星': 'Google Satellite',
                'ESRI 影像': 'ESRI Imagery'
            };
            
            [tianditu, googleSat, esriImagery].forEach(layer => {
                const label = document.createElement('label');
                label.style.cssText = 'display: flex; align-items: center; font-size: 12px; margin: 4px 0; cursor: pointer; padding: 2px 0;';
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = 'baselayer';
                input.checked = layer.getVisible();
                input.style.cssText = 'margin-right: 6px;';
                input.addEventListener('change', () => {
                    [tianditu, googleSat, esriImagery].forEach(l => l.setVisible(false));
                    layer.setVisible(true);
                });
                label.appendChild(input);
                const layerName = baseLayerNames[layer.get('title')] || layer.get('title');
                label.appendChild(document.createTextNode(layerName));
                baseLayerDiv.appendChild(label);
            });
            layerSwitcher.appendChild(baseLayerDiv);

            // 数据图层选择
            if (predictedRTSLayer || xiadataRTSLayer) {
                const dataLayerDiv = document.createElement('div');
                
                const dataTitle = document.createElement('div');
                dataTitle.textContent = 'Data Layers:';
                dataTitle.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 600;';
                dataLayerDiv.appendChild(dataTitle);
                
                [predictedRTSLayer, xiadataRTSLayer].filter(l => l).forEach(layer => {
                    const label = document.createElement('label');
                    label.style.cssText = 'display: flex; align-items: center; font-size: 12px; margin: 4px 0; cursor: pointer; padding: 2px 0;';
                    const input = document.createElement('input');
                    input.type = 'checkbox';
                    input.checked = layer.getVisible();
                    input.style.cssText = 'margin-right: 6px;';
                    input.addEventListener('change', (e) => {
                        layer.setVisible(e.target.checked);
                    });
                    label.appendChild(input);
                    label.appendChild(document.createTextNode(layer.get('title')));
                    dataLayerDiv.appendChild(label);
                });
                layerSwitcher.appendChild(dataLayerDiv);
            }

            // 切换显示/隐藏
            let isExpanded = false;
            toggleButton.addEventListener('click', () => {
                isExpanded = !isExpanded;
                layerSwitcher.style.display = isExpanded ? 'block' : 'none';
                toggleButton.style.background = isExpanded ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255,255,255,0.9)';
                toggleButton.style.color = isExpanded ? '#fff' : '#333';
            });
            
            closeBtn.addEventListener('click', () => {
                isExpanded = false;
                layerSwitcher.style.display = 'none';
                toggleButton.style.background = 'rgba(255,255,255,0.9)';
                toggleButton.style.color = '#333';
            });

            layerSwitcherContainer.appendChild(layerSwitcher);
            layerSwitcherContainer.appendChild(toggleButton);
            document.getElementById('map').appendChild(layerSwitcherContainer);

            // 保存图层引用
            window.mapLayers = {
                predicted: predictedRTSLayer,
                xiadata: xiadataRTSLayer
            };
        },
        startScreenshot() {
            this.isScreenshotMode = !this.isScreenshotMode;
            
            if (this.isScreenshotMode) {
                // 启用截图模式 - OpenLayers
                const mapElement = window.map.getTargetElement();
                mapElement.style.cursor = 'crosshair';
                mapElement.addEventListener('mousedown', this.onMapMouseDown);
                
                // 禁用地图交互（拖拽、缩放等）
                window.map.getInteractions().forEach(interaction => {
                    if (interaction instanceof ol.interaction.DragPan || 
                        interaction instanceof ol.interaction.MouseWheelZoom ||
                        interaction instanceof ol.interaction.DoubleClickZoom ||
                        interaction instanceof ol.interaction.DragZoom) {
                        interaction._wasActive = interaction.getActive();
                        interaction.setActive(false);
                    }
                });
                
                // 隐藏 RTS 图层
                if (window.mapLayers) {
                    if (window.mapLayers.predicted) {
                        window.mapLayers.predicted._visibleBeforeScreenshot = window.mapLayers.predicted.getVisible();
                        window.mapLayers.predicted.setVisible(false);
                    }
                    if (window.mapLayers.xiadata) {
                        window.mapLayers.xiadata._visibleBeforeScreenshot = window.mapLayers.xiadata.getVisible();
                        window.mapLayers.xiadata.setVisible(false);
                    }
                }
            } else {
                // 禁用截图模式
                const mapElement = window.map.getTargetElement();
                mapElement.style.cursor = '';
                mapElement.removeEventListener('mousedown', this.onMapMouseDown);
                if (this.screenshotOverlay) {
                    window.map.removeOverlay(this.screenshotOverlay);
                    this.screenshotOverlay = null;
                }
                
                // 恢复地图交互和图层
                this.restoreMapInteractions();
            }
        },
        restoreMapInteractions() {
            // 恢复地图交互
            window.map.getInteractions().forEach(interaction => {
                if (interaction._wasActive !== undefined) {
                    interaction.setActive(interaction._wasActive);
                    delete interaction._wasActive;
                }
            });
            
            // 恢复 RTS 图层的可见性
            if (window.mapLayers) {
                if (window.mapLayers.predicted && window.mapLayers.predicted._visibleBeforeScreenshot !== undefined) {
                    window.mapLayers.predicted.setVisible(window.mapLayers.predicted._visibleBeforeScreenshot);
                    delete window.mapLayers.predicted._visibleBeforeScreenshot;
                }
                if (window.mapLayers.xiadata && window.mapLayers.xiadata._visibleBeforeScreenshot !== undefined) {
                    window.mapLayers.xiadata.setVisible(window.mapLayers.xiadata._visibleBeforeScreenshot);
                    delete window.mapLayers.xiadata._visibleBeforeScreenshot;
                }
            }
        },
        onMapMouseDown(e) {
            const app = this;
            if (!app.$data.isScreenshotMode) return;

            e.preventDefault();
            e.stopPropagation();
            
            const mapElement = window.map.getTargetElement();
            const rect = mapElement.getBoundingClientRect();
            
            // 获取相对于地图容器的坐标
            const getRelativeCoords = (event) => {
                const mapRect = mapElement.getBoundingClientRect();
                return {
                    x: event.clientX - mapRect.left,
                    y: event.clientY - mapRect.top
                };
            };
            
            const startCoords = getRelativeCoords(e);
            const startPixel = [startCoords.x, startCoords.y];
            let overlayElement = null;

            const onMouseMove = (moveEvent) => {
                if (overlayElement) {
                    overlayElement.remove();
                }

                const endCoords = getRelativeCoords(moveEvent);
                const endPixel = [endCoords.x, endCoords.y];
                const minX = Math.min(startPixel[0], endPixel[0]);
                const minY = Math.min(startPixel[1], endPixel[1]);
                const maxX = Math.max(startPixel[0], endPixel[0]);
                const maxY = Math.max(startPixel[1], endPixel[1]);

                overlayElement = document.createElement('div');
                overlayElement.style.cssText = `
                    position: absolute;
                    left: ${minX}px;
                    top: ${minY}px;
                    width: ${maxX - minX}px;
                    height: ${maxY - minY}px;
                    border: 2px solid #0088ff;
                    background: rgba(0, 136, 255, 0.1);
                    pointer-events: none;
                    z-index: 1000;
                `;
                mapElement.appendChild(overlayElement);
            };

            const onMouseUp = async (upEvent) => {
                mapElement.removeEventListener('mousemove', onMouseMove);
                mapElement.removeEventListener('mouseup', onMouseUp);
                mapElement.style.cursor = 'crosshair';
                
                if (overlayElement) {
                    const endCoords = getRelativeCoords(upEvent);
                    const endPixel = [endCoords.x, endCoords.y];
                    const minX = Math.min(startPixel[0], endPixel[0]);
                    const minY = Math.min(startPixel[1], endPixel[1]);
                    const maxX = Math.max(startPixel[0], endPixel[0]);
                    const maxY = Math.max(startPixel[1], endPixel[1]);

                    overlayElement.remove();
                    await app.captureAndDetect({ minX, minY, maxX, maxY });
                }
                
                // 截图完成后，自动退出截图模式
                app.$data.isScreenshotMode = false;
                
                // 恢复地图交互功能
                app.restoreMapInteractions();
            };

            mapElement.addEventListener('mousemove', onMouseMove);
            mapElement.addEventListener('mouseup', onMouseUp);
        },
        async captureAndDetect(bounds) {
            try {
                console.log('开始截图...');

                const mapEl = document.querySelector('#map');

                // 先截取整个地图（启用CORS以避免污染画布）
                const fullCanvas = await html2canvas(mapEl, {
                    useCORS: true,
                    allowTaint: false,
                    logging: false,
                    backgroundColor: null
                });

                // 使用像素范围裁剪
                const x = bounds.minX;
                const y = bounds.minY;
                const w = bounds.maxX - bounds.minX;
                const h = bounds.maxY - bounds.minY;

                if (w < 10 || h < 10) {
                    alert('Selected area is too small. Please select a larger area for detection.');
                    return;
                }

                // 处理 DPR 缩放（html2canvas 可能按 devicePixelRatio 放大）
                const scaleX = fullCanvas.width / mapEl.clientWidth;
                const scaleY = fullCanvas.height / mapEl.clientHeight;

                const sx = Math.round(x * scaleX);
                const sy = Math.round(y * scaleY);
                const swidth = Math.round(w * scaleX);
                const sheight = Math.round(h * scaleY);

                // 确保缩放后的尺寸有效（至少10x10像素）
                if (swidth < 10 || sheight < 10) {
                    alert('Selected area is too small after scaling. Please select a larger area for detection.');
                    return;
                }

                // 裁剪到所选区域
                const cropped = document.createElement('canvas');
                cropped.width = swidth;
                cropped.height = sheight;
                const ctx = cropped.getContext('2d');
                ctx.drawImage(fullCanvas, sx, sy, swidth, sheight, 0, 0, swidth, sheight);

                // 生成 Blob
                const blob = await new Promise((resolve, reject) => {
                    cropped.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
                });

                // 预览 URL
                const imageUrl = URL.createObjectURL(blob);

                // 分发截图事件
                const event = new CustomEvent('screenshot-taken', {
                    detail: { imageUrl, blob }
                });
                window.dispatchEvent(event);

            } catch (error) {
                console.error('Screenshot failed:', error);
                alert('Screenshot failed: ' + error.message);
            }
        }
    }
});

// 添加测量功能和位置搜索功能
const measureApp = {
    data() {
        return {
            isPanelFixed: false,
            isPanelVisible: false,
            isScreenshotMode: false,
            timeseriesLoading: false,
            panelHideTimer: null,
            screenshotOverlay: null,
            measureType: null,  // 'distance' 或 'area' 或 null
            measureDraw: null,  // 绘图交互
            measureTooltipElement: null,
            measureTooltip: null,
            measureSketch: null,
            measureLayer: null,
            searchCoordinates: '',  // 搜索坐标输入
            searchBoxMinimized: false,  // 搜索框是否最小化
            locationMarker: null,  // 位置标记
        }
    },
    methods: {
        // 创建测量提示框
        createMeasureTooltip() {
            if (this.measureTooltipElement) {
                this.measureTooltipElement.parentNode.removeChild(this.measureTooltipElement);
            }
            this.measureTooltipElement = document.createElement('div');
            this.measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
            this.measureTooltip = new ol.Overlay({
                element: this.measureTooltipElement,
                offset: [0, -15],
                positioning: 'bottom-center',
                stopEvent: false,
                insertFirst: false,
            });
            window.map.addOverlay(this.measureTooltip);
        },

        // 格式化长度
        formatLength(line) {
            const length = ol.sphere.getLength(line);
            let output;
            if (length > 1000) {
                output = (Math.round(length / 1000 * 100) / 100) + ' km';
            } else {
                output = (Math.round(length * 100) / 100) + ' m';
            }
            return output;
        },

        // 格式化面积
        formatArea(polygon) {
            const area = ol.sphere.getArea(polygon);
            let output;
            if (area > 1000000) {
                output = (Math.round(area / 1000000 * 100) / 100) + ' km²';
            } else {
                output = (Math.round(area * 100) / 100) + ' m²';
            }
            return output;
        },

        // 切换测量工具
        toggleMeasure(type) {
            // 如果点击当前激活的工具，则关闭它
            if (this.measureType === type) {
                this.measureType = null;
                this.removeMeasureInteraction();
                // 清除所有测量图形
                if (this.measureLayer) {
                    this.measureLayer.getSource().clear();
                }
                return;
            }

            this.measureType = type;
            this.removeMeasureInteraction();
            
            // 清除之前的测量图形
            if (this.measureLayer) {
                this.measureLayer.getSource().clear();
            }

            // 创建绘图图层（如果不存在）
            if (!this.measureLayer) {
                this.measureLayer = new ol.layer.Vector({
                    source: new ol.source.Vector(),
                    style: new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: 'rgba(255, 255, 255, 0.4)',
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#1976d2',
                            width: 2,
                        }),
                        image: new ol.style.Circle({
                            radius: 4,
                            stroke: new ol.style.Stroke({
                                color: '#1976d2',
                                width: 2,
                            }),
                            fill: new ol.style.Fill({
                                color: '#fff',
                            }),
                        }),
                    }),
                });
                window.map.addLayer(this.measureLayer);
            }

            // 创建绘图交互
            this.measureDraw = new ol.interaction.Draw({
                source: this.measureLayer.getSource(),
                type: type === 'area' ? 'Polygon' : 'LineString',
                    style: new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 255, 255, 0.4)',
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#1976d2',
                        lineDash: [6, 6],
                        width: 2,
                    }),
                    image: new ol.style.Circle({
                        radius: 4,
                        stroke: new ol.style.Stroke({
                            color: '#1976d2',
                            width: 2,
                        }),
                        fill: new ol.style.Fill({
                            color: '#fff',
                        }),
                    }),
                }),
            });

            // 创建测量提示
            this.createMeasureTooltip();

            // 添加绘图事件监听器
            this.measureDraw.on('drawstart', (evt) => {
                this.measureSketch = evt.feature;

                let tooltipCoord = evt.coordinate;

                this.measureSketch.getGeometry().on('change', (evt) => {
                    const geom = evt.target;
                    let output;
                    if (geom instanceof ol.geom.Polygon) {
                        output = this.formatArea(geom);
                        tooltipCoord = geom.getInteriorPoint().getCoordinates();
                    } else if (geom instanceof ol.geom.LineString) {
                        output = this.formatLength(geom);
                        tooltipCoord = geom.getLastCoordinate();
                    }
                    this.measureTooltipElement.innerHTML = output;
                    this.measureTooltip.setPosition(tooltipCoord);
                });
            });

            this.measureDraw.on('drawend', () => {
                this.measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
                this.measureTooltip.setOffset([0, -7]);
                this.measureSketch = null;
                this.createMeasureTooltip();
            });

            window.map.addInteraction(this.measureDraw);
        },

        // 移除测量交互
        removeMeasureInteraction() {
            if (this.measureDraw) {
                window.map.removeInteraction(this.measureDraw);
                this.measureDraw = null;
            }
            if (this.measureTooltipElement) {
                this.measureTooltipElement.parentNode.removeChild(this.measureTooltipElement);
                this.measureTooltipElement = null;
            }
            if (this.measureTooltip) {
                window.map.removeOverlay(this.measureTooltip);
                this.measureTooltip = null;
            }
        },

        // 位置搜索功能
        searchLocation() {
            const coords = this.searchCoordinates.trim();
            let lon, lat;
            
            // 如果没有输入，使用默认坐标
            if (!coords) {
                lon = 92.74585837;
                lat = 35.07621963;
            } else {
                // 解析坐标 (支持多种格式)
                const parts = coords.split(/[,\s]+/).filter(p => p);
                if (parts.length !== 2) {
                    alert('Invalid format. Please use: longitude, latitude');
                    return;
                }

                lon = parseFloat(parts[0]);
                lat = parseFloat(parts[1]);
            }

            if (isNaN(lon) || isNaN(lat)) {
                alert('Invalid coordinates. Please enter valid numbers');
                return;
            }

            if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
                alert('Coordinates out of range. Longitude: -180 to 180, Latitude: -90 to 90');
                return;
            }

            // 转换坐标并定位
            const coordinate = ol.proj.fromLonLat([lon, lat]);
            
            // 移动地图到目标位置
            window.map.getView().animate({
                center: coordinate,
                zoom: 16,
                duration: 1000
            });

            // 创建高亮标记
            this.createLocationMarker(coordinate);
        },

        // 创建位置标记
        createLocationMarker(coordinate) {
            // 移除旧标记
            if (this.locationMarker) {
                window.map.removeOverlay(this.locationMarker);
            }

            // 创建标记元素
            const markerElement = document.createElement('div');
            markerElement.style.cssText = `
                width: 20px;
                height: 20px;
                background: #ff4444;
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                animation: location-pulse 1s ease-in-out infinite;
            `;

            // 创建 Overlay
            this.locationMarker = new ol.Overlay({
                element: markerElement,
                positioning: 'center-center',
                stopEvent: false,
            });

            this.locationMarker.setPosition(coordinate);
            window.map.addOverlay(this.locationMarker);

            // 3秒后移除标记
            setTimeout(() => {
                if (this.locationMarker) {
                    window.map.removeOverlay(this.locationMarker);
                    this.locationMarker = null;
                }
            }, 3000);
        },

        // 切换搜索框最小化状态
        toggleSearchBox() {
            this.searchBoxMinimized = !this.searchBoxMinimized;
        },

        // 初始化搜索框拖动功能
        initSearchBoxDrag() {
            const searchBox = document.getElementById('locationSearchBox');
            const mapContainer = document.querySelector('.map-container');
            
            if (!searchBox || !mapContainer) return;

            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;

            // 限制位置在地图容器内
            const constrainPosition = () => {
                const mapRect = mapContainer.getBoundingClientRect();
                const boxRect = searchBox.getBoundingClientRect();
                
                // 计算相对于地图容器的边界
                const minX = 10;
                const maxX = mapRect.width - boxRect.width - 10;
                const minY = 10;
                const maxY = mapRect.height - boxRect.height - 10;
                
                // 限制 X 坐标
                if (xOffset < minX) xOffset = minX;
                if (xOffset > maxX) xOffset = maxX;
                
                // 限制 Y 坐标
                if (yOffset < minY) yOffset = minY;
                if (yOffset > maxY) yOffset = maxY;
                
                searchBox.style.left = `${xOffset}px`;
                searchBox.style.top = `${yOffset}px`;
            };

            // 获取初始位置
            const getInitialOffset = () => {
                const computedStyle = window.getComputedStyle(searchBox);
                xOffset = parseInt(computedStyle.left) || 60;
                yOffset = parseInt(computedStyle.top) || 10;
            };

            searchBox.addEventListener('mousedown', (e) => {
                // 如果点击的是输入框或按钮，不触发拖动
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'I') {
                    return;
                }
                
                // 如果是首次拖动，获取初始位置
                if (xOffset === 0 && yOffset === 0) {
                    getInitialOffset();
                }
                
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                isDragging = true;
                searchBox.style.cursor = 'grabbing';
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    e.preventDefault();
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                    xOffset = currentX;
                    yOffset = currentY;

                    constrainPosition();
                }
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    searchBox.style.cursor = 'move';
                }
            });

            // 设置初始光标样式
            searchBox.style.cursor = 'move';

            // 监听窗口大小变化，确保搜索框始终在可见区域内
            window.addEventListener('resize', () => {
                // 获取当前位置（如果还没有拖动过）
                if (xOffset === 0 && yOffset === 0) {
                    getInitialOffset();
                }
                constrainPosition();
            });
        },
    },
    watch: {
        measureType(newVal) {
            if (!newVal) {
                this.removeMeasureInteraction();
            }
        }
    },
    mounted() {
        // 初始化搜索框拖动功能
        this.$nextTick(() => {
            this.initSearchBoxDrag();
        });
    }
};

// 合并测量功能到主应用
Object.assign(app._component.data(), measureApp.data());
Object.assign(app._component.methods, measureApp.methods);
if (!app._component.watch) app._component.watch = {};
Object.assign(app._component.watch, measureApp.watch);

// 合并 mounted 钩子
const originalMounted = app._component.mounted;
if (measureApp.mounted) {
    app._component.mounted = function() {
        if (originalMounted) originalMounted.call(this);
        measureApp.mounted.call(this);
    };
}

app.use(router);
app.mount('#app');
