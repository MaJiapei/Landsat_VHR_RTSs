// 空白路由组件
const EmptyRoute = {
    template: `
        <div class="empty-route">
            <h3>Route 1</h3>
            <p>This route is currently empty.</p>
        </div>
    `
};

// 时间序列分析组件
const TimeSeriesAnalysis = {
    template: `
        <div class="time-series-container">
            <div class="points-container">
                <h3>Selected Points</h3>
                <div id="point-cards"></div>
            </div>
            <div class="plot-container">
                <div id="plot-container"></div>
            </div>
        </div>
    `,
    mounted() {
        this.initMapHandlers();
    },
    methods: {
        initMapHandlers() {
            // 确保地图已初始化
            if (!window.map) return;

            // 清空现有点
            if (window.points) {
                window.points.forEach(point => {
                    if (point.marker) {
                        window.map.removeLayer(point.marker);
                    }
                });
            }

            window.points = [];
            window.nextPointIndex = 1;
            window.allColors = [
                '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
                '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
                '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d2', '#dbdb8d',
                '#9edae5', '#393b79', '#e6550d', '#31a354', '#756bb1'
            ];

            window.map.on('click', this.handleMapClick);
        },
        async handleMapClick(e) {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            
            try {
                // 获取根实例来更新全局加载状态
                const root = this.$root || this;
                if (root.timeseriesLoading !== undefined) {
                    root.timeseriesLoading = true;
                }
                const response = await fetch('http://localhost:8000/api/analyze', {
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
                const point = {
                    id: Date.now(),
                    name: pointName,
                    lat,
                    lng,
                    color: pointColor,
                    marker: L.circleMarker([lat, lng], {
                        radius: 8,
                        fillColor: pointColor,
                        color: '#fff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(window.map),
                    data: data
                };
                
                window.points.push(point);
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
                window.map.removeLayer(window.points[pointIndex].marker);
                window.points.splice(pointIndex, 1);
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
        if (window.map) {
            window.map.off('click', this.handleMapClick);
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
                const response = await fetch('http://localhost:8000/api/yolo/predict', {
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

// 路由配置
const routes = [
    { path: '/', redirect: '/route1' },
    { 
        path: '/route1', 
        component: EmptyRoute,
        name: 'route1'
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
            timeseriesLoading: false
        };
    },
    watch: {
        $route(to) {
            this.currentRoute = to.path;
        }
    },
    mounted() {
        // 初始化地图
        this.initMap();
        this.currentRoute = this.$route.path;
        this.initResizablePanel();
    },
    methods: {
        initResizablePanel() {
            const container = document.querySelector('.main-layout');
            const gutter = document.querySelector('.gutter');
            const mapContainer = document.querySelector('.map-container');
            const rightPanel = document.querySelector('.right-panel');

            let isResizing = false;

            gutter.addEventListener('mousedown', (e) => {
                isResizing = true;
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', () => {
                    isResizing = false;
                    document.removeEventListener('mousemove', handleMouseMove);
                });
            });

            const handleMouseMove = (e) => {
                if (!isResizing) return;

                const containerRect = container.getBoundingClientRect();
                const percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
                
                if (percentage < 20 || percentage > 80) return;

                mapContainer.style.flex = `0 0 ${percentage}%`;
                rightPanel.style.width = `${100 - percentage}%`;
                
                window.map.invalidateSize();
                
                // 如果存在plot容器且有数据，重新调整大小
                const plotContainer = document.getElementById('plot-container');
                if (plotContainer && plotContainer.data) {
                    Plotly.Plots.resize(plotContainer);
                }
            }
        },
        initMap() {
            window.map = L.map('map').setView([35.06289152, 92.74256077], 16);
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19,
                attribution: 'Tiles © Esri',
                crossOrigin: 'anonymous'
            }).addTo(window.map);
        },
        startScreenshot() {
            this.isScreenshotMode = !this.isScreenshotMode;
            
            if (this.isScreenshotMode) {
                // 启用截图模式
                window.map.dragging.disable();
                window.map.on('mousedown', this.onMapMouseDown);
            } else {
                // 禁用截图模式
                window.map.dragging.enable();
                window.map.off('mousedown', this.onMapMouseDown);
                if (this.screenshotRect) {
                    window.map.removeLayer(this.screenshotRect);
                    this.screenshotRect = null;
                }
            }
        },
        onMapMouseDown(e) {
            if (!this.isScreenshotMode) return;

            const startPoint = e.containerPoint;
            let rect = null;

            const onMouseMove = (e) => {
                if (rect) {
                    window.map.removeLayer(rect);
                }

                const endPoint = e.containerPoint;
                const bounds = L.bounds(startPoint, endPoint);
                
                const southWest = window.map.containerPointToLatLng(bounds.min);
                const northEast = window.map.containerPointToLatLng(bounds.max);
                
                rect = L.rectangle(L.latLngBounds(southWest, northEast), {
                    color: '#0088ff',
                    weight: 2,
                    fillOpacity: 0.1
                }).addTo(window.map);
            };

            const onMouseUp = async (e) => {
                window.map.off('mousemove', onMouseMove);
                window.map.off('mouseup', onMouseUp);
                
                if (rect) {
                    // 在截图前移除矩形，避免被截图捕获
                    const selectedBounds = rect.getBounds();
                    try { window.map.removeLayer(rect); } catch (err) {}
                    this.screenshotRect = null;
                    await this.captureAndDetect(selectedBounds);
                }
                
                this.isScreenshotMode = false;
                window.map.dragging.enable();
            };

            window.map.on('mousemove', onMouseMove);
            window.map.on('mouseup', onMouseUp);
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

                // 计算所选矩形在容器中的像素范围
                const sw = bounds.getSouthWest();
                const ne = bounds.getNorthEast();
                const p1 = window.map.latLngToContainerPoint(sw);
                const p2 = window.map.latLngToContainerPoint(ne);

                const x = Math.min(p1.x, p2.x);
                const y = Math.min(p1.y, p2.y);
                const w = Math.abs(p2.x - p1.x);
                const h = Math.abs(p2.y - p1.y);

                if (w < 5 || h < 5) {
                    throw new Error('Selection too small');
                }

                // 处理 DPR 缩放（html2canvas 可能按 devicePixelRatio 放大）
                const scaleX = fullCanvas.width / mapEl.clientWidth;
                const scaleY = fullCanvas.height / mapEl.clientHeight;

                const sx = Math.round(x * scaleX);
                const sy = Math.round(y * scaleY);
                const swidth = Math.round(w * scaleX);
                const sheight = Math.round(h * scaleY);

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

app.use(router);
app.mount('#app');
