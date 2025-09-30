export default {
    template: `
        <div class="container">
            <div class="map-container">
                <div id="map"></div>
            </div>
            <div class="gutter"></div>
            <div class="results-container">
                <div class="points-container">
                    <h3>Selected Points</h3>
                    <div id="point-cards"></div>
                </div>
                <div class="plot-container">
                    <div id="plot-container"></div>
                </div>
            </div>
        </div>
    `,
    mounted() {
        this.initMap();
    },
    methods: {
        initMap() {
            window.map = L.map('map').setView([35.06289152, 92.74256077], 16);
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19,
                attribution: 'Tiles © Esri'
            }).addTo(window.map);

            this.initResizablePanel();
            this.initMapHandlers();
        },
        // ... 其他方法保持不变 ...
    }
}
