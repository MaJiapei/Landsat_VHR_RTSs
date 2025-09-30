export default {
    template: `
        <div class="container">
            <div class="map-container">
                <div id="map"></div>
                <div class="map-tools">
                    <button @click="startScreenshot" class="tool-btn" :class="{ active: isScreenshotMode }">
                        <span class="icon">📷</span>
                        Screenshot
                    </button>
                </div>
            </div>
            <div class="gutter"></div>
            <div class="results-container">
                <div class="detection-results">
                    <h3>Detection Results</h3>
                    <div v-if="loading" class="loading">Processing...</div>
                    <div v-else-if="detectionResult" class="result-panel">
                        <div class="result-image">
                            <img :src="detectionResult.image_base64" alt="Detection Result" />
                        </div>
                        <div class="result-details">
                            <h4>Detected Objects: {{detectionResult.num_detections}}</h4>
                            <pre class="json">{{JSON.stringify(detectionResult.detections, null, 2)}}</pre>
                        </div>
                    </div>
                    <div v-else class="empty-state">
                        Use the screenshot tool to capture an area for detection
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            isScreenshotMode: false,
            screenshotRect: null,
            loading: false,
            detectionResult: null,
            map: null
        }
    },
    mounted() {
        this.initMap();
    },
    methods: {
        initMap() {
            this.map = L.map('map').setView([35.06289152, 92.74256077], 16);
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19,
                attribution: 'Tiles © Esri'
            }).addTo(this.map);

            this.initResizablePanel();
        },
        initResizablePanel() {
            const container = document.querySelector('.container');
            const gutter = document.querySelector('.gutter');
            const mapContainer = document.querySelector('.map-container');
            const resultsContainer = document.querySelector('.results-container');

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
                resultsContainer.style.flex = `0 0 ${100 - percentage}%`;
                
                this.map.invalidateSize();
            }
        },
        startScreenshot() {
            this.isScreenshotMode = !this.isScreenshotMode;
            
            if (this.isScreenshotMode) {
                // 启用截图模式
                this.map.dragging.disable();
                this.map.on('mousedown', this.onMapMouseDown);
            } else {
                // 禁用截图模式
                this.map.dragging.enable();
                this.map.off('mousedown', this.onMapMouseDown);
                if (this.screenshotRect) {
                    this.map.removeLayer(this.screenshotRect);
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
                    this.map.removeLayer(rect);
                }

                const endPoint = e.containerPoint;
                const bounds = L.bounds(startPoint, endPoint);
                
                const southWest = this.map.containerPointToLatLng(bounds.min);
                const northEast = this.map.containerPointToLatLng(bounds.max);
                
                rect = L.rectangle(L.latLngBounds(southWest, northEast), {
                    color: '#0088ff',
                    weight: 2,
                    fillOpacity: 0.1
                }).addTo(this.map);
            };

            const onMouseUp = async (e) => {
                this.map.off('mousemove', onMouseMove);
                this.map.off('mouseup', onMouseUp);
                
                if (rect) {
                    this.screenshotRect = rect;
                    await this.captureAndDetect(rect.getBounds());
                }
                
                this.isScreenshotMode = false;
                this.map.dragging.enable();
            };

            this.map.on('mousemove', onMouseMove);
            this.map.on('mouseup', onMouseUp);
        },
        async captureAndDetect(bounds) {
            try {
                this.loading = true;
                
                // 获取地图可见区域的canvas
                const canvas = await html2canvas(document.querySelector('#map'));
                
                // 将canvas转换为blob
                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/png');
                });

                // 创建FormData对象
                const formData = new FormData();
                formData.append('file', blob, 'screenshot.png');

                // 发送到后端进行检测
                const response = await fetch('/api/yolo/predict', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('Detection failed');
                }

                this.detectionResult = await response.json();
            } catch (error) {
                console.error('Detection failed:', error);
                alert('Detection failed: ' + error.message);
            } finally {
                this.loading = false;
            }
        }
    }
}
