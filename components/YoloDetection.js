export default {
    name: 'YoloDetection',
    mounted() {
        // 监听截图事件
        window.eventBus.on('screenshot-taken', this.handleScreenshot);
    },
    unmounted() {
        // 移除事件监听
        window.eventBus.off('screenshot-taken', this.handleScreenshot);
    },
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
                        <img :src="originalImage || screenshotImage" alt="Detection Result" ref="resultImg" @load="syncCanvas" style="width:100%; height:auto; display:block;"/>
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
        }
    },
    methods: {
        handleScreenshot(data) {
            // 清理旧的 blob URL，避免内存泄漏
            if (this.objectUrl) {
                URL.revokeObjectURL(this.objectUrl);
                this.objectUrl = null;
            }

            if (data?.blob) {
                try {
                    this.objectUrl = URL.createObjectURL(data.blob);
                    this.screenshotImage = this.objectUrl;
                } catch (err) {
                    console.warn('Failed to create object URL, fallback to imageUrl', err);
                    this.screenshotImage = data?.imageUrl || null;
                }
                this.screenshotBlob = data.blob;
            } else {
                this.screenshotImage = data?.imageUrl || null;
                this.screenshotBlob = null;
            }

            this.originalImage = this.screenshotImage;
            this.detectionResult = null;
        },
        async detectObjects() {
            if (!this.screenshotBlob) return;
            
            try {
                this.loading = true;
                
                // 创建FormData对象
                const formData = new FormData();
                formData.append('file', this.screenshotBlob, 'screenshot.png');

                // 发送到后端进行检测
                const response = await fetch('/api/yolo/predict', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('Detection failed');
                }

                this.detectionResult = await response.json();
                if (!this.originalImage) {
                    this.originalImage = this.screenshotImage;
                }
                this.$nextTick(() => this.syncCanvas());
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
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
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
                ctx.strokeStyle = '#00ff00';  // 绿色，更显眼
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
            const canvas = this.$refs.overlay;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    }
}