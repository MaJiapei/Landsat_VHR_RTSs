// Initialize map
const map = L.map('map').setView([35.06289152, 92.74256077], 16);

// Initialize resizable panels
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
    
    // Limit the minimum and maximum sizes
    if (percentage < 20 || percentage > 80) return;

    mapContainer.style.flex = `0 0 ${percentage}%`;
    resultsContainer.style.flex = `0 0 ${100 - percentage}%`;
    
    // Force Leaflet map to update its size
    map.invalidateSize();
    
    // Update plot size if it exists
    if (document.getElementById('plot-container').data) {
        Plotly.Plots.resize(document.getElementById('plot-container'));
    }
}
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
}).addTo(map);

// Store points data
let points = [];
let nextPointIndex = 1;

// Color management
const allColors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d2', '#dbdb8d',
    '#9edae5', '#393b79', '#e6550d', '#31a354', '#756bb1'
];

function getNextAvailableColor() {
    const usedColors = points.map(p => p.color);
    return allColors.find(color => !usedColors.includes(color)) || allColors[0];
}

function getNextPointName() {
    return `A${nextPointIndex++}`;
}

// Map click handler
map.on('click', async function(e) {
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
        
        // Add new point
        const pointColor = getNextAvailableColor();
        const pointName = getNextPointName();
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
            }).addTo(map),
            data: data
        };
        
        points.push(point);
        updatePointCards();
        updatePlot();
        
    } catch (error) {
        console.error('Analysis failed:', error);
        alert('Analysis failed: ' + error.message);
    }
});

function updatePointCards() {
    const container = document.getElementById('point-cards');
    container.innerHTML = '';
    
    points.forEach(point => {
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
        deleteBtn.onclick = () => deletePoint(point.id);
        
        details.appendChild(pointName);
        details.appendChild(prob);
        info.appendChild(colorDot);
        info.appendChild(details);
        card.appendChild(info);
        card.appendChild(deleteBtn);
        container.appendChild(card);
    });
}

function deletePoint(id) {
    const pointIndex = points.findIndex(p => p.id === id);
    if (pointIndex !== -1) {
        // Remove marker from map
        map.removeLayer(points[pointIndex].marker);
        // Remove point from array
        points.splice(pointIndex, 1);
        // Update UI
        updatePointCards();
        updatePlot();
    }
}

function updatePlot() {
    // Generate years array starting from 1986
    const getYears = length => Array.from({length}, (_, i) => 1986 + i);
    
    const traces = points.map(point => ({
        x: getYears(point.data.ndvi_values.length),
        y: point.data.ndvi_values,
        type: 'scatter',
        name: point.name,
        line: { color: point.color },
        showlegend: true
    }));
    
    const shapes = points.reduce((acc, point) => {
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
            dtick: 5  // Show tick every 5 years
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