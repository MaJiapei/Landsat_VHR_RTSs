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
        // 将原来script.js中的代码移到这里
        this.initMap();
    },
    methods: {
        initMap() {
            // 从原来的script.js中复制相关代码
            window.map = L.map('map').setView([35.06289152, 92.74256077], 16);
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19,
                attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            }).addTo(window.map);

            // 初始化其他功能
            this.initResizablePanel();
            this.initMapHandlers();
        },
        initResizablePanel() {
            // 从原来的script.js中复制相关代码
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

            function handleMouseMove(e) {
                if (!isResizing) return;

                const containerRect = container.getBoundingClientRect();
                const percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
                
                if (percentage < 20 || percentage > 80) return;

                mapContainer.style.flex = `0 0 ${percentage}%`;
                resultsContainer.style.flex = `0 0 ${100 - percentage}%`;
                
                window.map.invalidateSize();
                
                if (document.getElementById('plot-container').data) {
                    Plotly.Plots.resize(document.getElementById('plot-container'));
                }
            }
        },
        initMapHandlers() {
            // 从原来的script.js中复制相关代码
            window.points = [];
            window.nextPointIndex = 1;
            window.allColors = [
                '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
                '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
                '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d2', '#dbdb8d',
                '#9edae5', '#393b79', '#e6550d', '#31a354', '#756bb1'
            ];

            window.map.on('click', async (e) => {
                const lat = e.latlng.lat;
                const lng = e.latlng.lng;
                
                try {
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
                }
            });
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
    }
}
