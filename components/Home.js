export default {
    template: `
        <div class="home-container">
            <h1 class="home-title">RTS Analysis System</h1>
            <div class="card-container">
                <router-link to="/rts" class="feature-card">
                    <div class="card-icon">📊</div>
                    <h2>RTS Analysis</h2>
                    <p>Analyze RTS using NDVI time series data and interactive mapping.</p>
                </router-link>
                <router-link to="/yolo" class="feature-card">
                    <div class="card-icon">🔍</div>
                    <h2>YOLO Detection</h2>
                    <p>Perform object detection using YOLO model on images.</p>
                </router-link>
            </div>
        </div>
    `
}