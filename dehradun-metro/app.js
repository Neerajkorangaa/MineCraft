// ============================================
// DEHRADUN METRO - MAIN APPLICATION (UPDATED)
// 33 stations, 3 lines, interactive map
// ============================================

let graph = null;
let currentRoute = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    graph = buildGraph();
    initializeStationSelects();
    renderMetroMap();
    attachEventListeners();
});

// Populate station dropdown selects
function initializeStationSelects() {
    const sourceSelect = document.getElementById('source');
    const destSelect = document.getElementById('destination');

    // Group stations by line
    const lines = [
        { name: 'Yellow Line', stations: stations.filter(s => s.line === 'yellow') },
        { name: 'Blue Line', stations: stations.filter(s => s.line === 'blue') },
        { name: 'Red Line', stations: stations.filter(s => s.line === 'red') }
    ];

    lines.forEach(line => {
        const srcGroup = document.createElement('optgroup');
        srcGroup.label = line.name;
        const destGroup = document.createElement('optgroup');
        destGroup.label = line.name;

        line.stations.forEach(station => {
            const srcOpt = new Option(station.name + (station.isInterchange ? ' ★' : ''), station.id);
            const destOpt = new Option(station.name + (station.isInterchange ? ' ★' : ''), station.id);
            srcGroup.appendChild(srcOpt);
            destGroup.appendChild(destOpt);
        });

        sourceSelect.appendChild(srcGroup);
        destSelect.appendChild(destGroup);
    });
}

// Attach event listeners
function attachEventListeners() {
    document.getElementById('findRoute').addEventListener('click', findRoute);
    document.getElementById('clearRoute').addEventListener('click', clearRoute);
    document.getElementById('zoomIn').addEventListener('click', () => zoomMap(1.2));
    document.getElementById('zoomOut').addEventListener('click', () => zoomMap(0.8));
    document.getElementById('resetZoom').addEventListener('click', () => resetMapZoom());
}

// Find Route button handler
function findRoute() {
    const sourceId = parseInt(document.getElementById('source').value);
    const destId = parseInt(document.getElementById('destination').value);
    const algorithm = document.querySelector('input[name="algorithm"]:checked').value;

    if (!sourceId || !destId) {
        alert('Please select both source and destination stations');
        return;
    }

    if (sourceId === destId) {
        alert('Source and destination cannot be the same');
        return;
    }

    let result;
    if (algorithm === 'bfs') {
        result = bfsShortestPath(graph, sourceId, destId);
    } else {
        result = dijkstraShortestPath(graph, sourceId, destId);
    }

    if (!result) {
        alert('No route found between these stations');
        return;
    }

    currentRoute = result;
    displayRoute(result);
    highlightRouteOnMap(result.path);
}

// Clear route
function clearRoute() {
    document.getElementById('source').value = '';
    document.getElementById('destination').value = '';
    document.getElementById('welcomeMessage').style.display = 'block';
    document.getElementById('routeResult').style.display = 'none';
    currentRoute = null;
    renderMetroMap();
}

// Display route in right panel
function displayRoute(result) {
    document.getElementById('welcomeMessage').style.display = 'none';
    document.getElementById('routeResult').style.display = 'block';

    const journeyPath = document.getElementById('journeyPath');
    journeyPath.innerHTML = '';

    let previousLine = null;
    result.path.forEach((stationId, index) => {
        const station = getStationById(stationId);
        const isFirst = index === 0;
        const isLast = index === result.path.length - 1;

        // Get effective line (for interchange stations)
        let effectiveLine = station.line;
        if (station.isInterchange && previousLine) {
            // Determine which line we're on based on neighbors
            if (index < result.path.length - 1) {
                const nextStation = getStationById(result.path[index + 1]);
                if (nextStation.line !== station.line && nextStation.line === previousLine) {
                    effectiveLine = previousLine;
                }
            }
        }

        // Check for line change
        if (previousLine && previousLine !== effectiveLine) {
            const changeDiv = document.createElement('div');
            changeDiv.className = 'change-indicator';
            changeDiv.innerHTML = '⚠️ Change to ' + getLineName(effectiveLine) + ' Line at ' + station.name;
            journeyPath.appendChild(changeDiv);
        }

        // Add connector
        if (!isFirst) {
            const connector = document.createElement('div');
            connector.className = 'path-connector ' + (previousLine || effectiveLine) + '-line';
            journeyPath.appendChild(connector);
        }

        // Add station
        const stationDiv = document.createElement('div');
        stationDiv.className = 'path-station';

        const icon = document.createElement('div');
        icon.className = 'path-icon ' + effectiveLine + '-line';
        icon.textContent = isFirst ? '🚩' : isLast ? '🎯' : '🚇';

        const details = document.createElement('div');
        details.className = 'path-details';
        details.innerHTML = '<strong>' + station.name + '</strong>' +
            '<small>' + getLineName(effectiveLine) + ' Line' +
            (station.isInterchange ? ' (Interchange)' : '') + '</small>';

        stationDiv.appendChild(icon);
        stationDiv.appendChild(details);
        journeyPath.appendChild(stationDiv);

        previousLine = effectiveLine;
    });

    // Display summary
    const lineChanges = countLineChanges(result.path);
    document.getElementById('totalStations').textContent = result.path.length;
    document.getElementById('totalDistance').textContent = (result.totalDistance / 1000).toFixed(2) + ' km';
    document.getElementById('totalTime').textContent = result.totalTime + ' min';
    document.getElementById('lineChanges').textContent = lineChanges;

    // Display fare
    const fare = calculateFare(result.totalDistance, lineChanges);
    document.getElementById('totalFare').textContent = '\u20B9 ' + fare.total;

    const fareBreakdown = document.getElementById('fareBreakdown');
    let fareHtml = '<div class="fare-line"><span>Base Fare</span><span>\u20B9 ' + fare.baseFare + '</span></div>' +
        '<div class="fare-line"><span>Distance Charge</span><span>\u20B9 ' + fare.distanceCharge + '</span></div>';
    if (lineChanges > 0) {
        fareHtml += '<div class="fare-line"><span>Interchange Fee</span><span>\u20B9 ' + fare.interchangeCharge + '</span></div>';
    }
    fareBreakdown.innerHTML = fareHtml;
}

// Get line display name
function getLineName(line) {
    const names = { yellow: 'Yellow', blue: 'Blue', red: 'Red' };
    return names[line] || line;
}

// ============================================
// METRO MAP RENDERING - Updated for 33 stations
// ============================================

let mapScale = 1;

function renderMetroMap() {
    const mapContainer = document.getElementById('metroMap');
    mapContainer.innerHTML = '';

    // Station positions on the visual map (x, y)
    // Layout based on Dehradun geography
    const stationPositions = {
        // YELLOW LINE (vertical, center) - Rishikesh (bottom) to Mussoorie (top)
        14: { x: 380, y: 30 },   // Mussoorie Diversion (top)
        13: { x: 380, y: 70 },   // Rispa
        12: { x: 380, y: 110 },  // Ghuchupani
        11: { x: 380, y: 150 },  // Tapkeshwar
        10: { x: 380, y: 195 },  // Rajpur (interchange Y+R)
        9: { x: 380, y: 240 },  // Dalanwala
        8: { x: 380, y: 290 },  // ISBT (interchange Y+B)
        7: { x: 380, y: 340 },  // Subhash Nagar
        6: { x: 380, y: 385 },  // Clement Town
        5: { x: 380, y: 430 },  // Doiwala
        4: { x: 380, y: 480 },  // Jolly Grant Airport
        3: { x: 380, y: 525 },  // Raiwala
        2: { x: 380, y: 565 },  // Tapovan
        1: { x: 380, y: 610 },  // Rishikesh (bottom)

        // BLUE LINE (horizontal through ISBT)
        15: { x: 30, y: 290 },   // Selaqui (far left)
        16: { x: 80, y: 290 },   // Graphic Era Hospital
        17: { x: 130, y: 290 },  // Jhajra
        18: { x: 180, y: 290 },  // IMA
        19: { x: 220, y: 290 },  // Sudhowala
        20: { x: 260, y: 290 },  // Prem Nagar
        21: { x: 300, y: 290 },  // Nanda Ki Chowki
        22: { x: 340, y: 290 },  // Majra
        // ISBT at 8 (380, 290) shared
        23: { x: 430, y: 290 },  // Banjarawala
        24: { x: 490, y: 290 },  // Doon University
        25: { x: 550, y: 290 },  // Mothrowala
        26: { x: 620, y: 290 },  // Lacchi Wala (far right)

        // RED LINE (through Rajpur, extending left and right)
        27: { x: 250, y: 195 },  // FRI (left of Rajpur)
        28: { x: 315, y: 195 },  // Ballupur
        // Rajpur at 10 (380, 195) shared
        29: { x: 450, y: 195 },  // Jakhan (right of Rajpur)
        30: { x: 510, y: 195 },  // Fun N Food
        31: { x: 570, y: 195 },  // Dehradun Zoo
        32: { x: 640, y: 195 },  // Sahastradhara
        33: { x: 710, y: 195 }   // Maldevta (far right)
    };

    // Draw lines first (behind stations)
    drawMetroLines(mapContainer, stationPositions);

    // Draw stations on top
    stations.forEach(station => {
        const pos = stationPositions[station.id];
        if (!pos) return;

        // Station dot
        const stationDot = document.createElement('div');
        stationDot.className = 'map-station ' + station.line + '-line' + (station.isInterchange ? ' interchange' : '');
        stationDot.style.left = pos.x + 'px';
        stationDot.style.top = pos.y + 'px';
        stationDot.title = station.name;
        stationDot.dataset.id = station.id;

        // Click to select station
        stationDot.addEventListener('click', function () {
            const src = document.getElementById('source');
            const dest = document.getElementById('destination');
            if (!src.value) {
                src.value = station.id;
            } else if (!dest.value) {
                dest.value = station.id;
            }
        });

        // Station label
        const label = document.createElement('div');
        label.className = 'station-label';
        label.textContent = station.name;

        // Position label based on context
        if (station.line === 'yellow' && !station.isInterchange) {
            // Yellow line vertical - label to the right
            label.style.left = (pos.x + 16) + 'px';
            label.style.top = (pos.y - 8) + 'px';
        } else if (station.line === 'blue') {
            // Blue line horizontal - label above
            label.style.left = (pos.x - 20) + 'px';
            label.style.top = (pos.y - 25) + 'px';
        } else if (station.line === 'red') {
            // Red line - label below
            label.style.left = (pos.x - 20) + 'px';
            label.style.top = (pos.y + 18) + 'px';
        } else {
            // Interchange - label to right
            label.style.left = (pos.x + 20) + 'px';
            label.style.top = (pos.y - 8) + 'px';
        }

        mapContainer.appendChild(stationDot);
        mapContainer.appendChild(label);
    });
}

function drawMetroLines(container, positions) {
    // Draw Yellow Line (vertical: 14→13→12→...→1)
    for (let i = 14; i > 1; i--) {
        const current = positions[i];
        const next = positions[i - 1];
        if (current && next) {
            drawLine(container, current, next, 'yellow-line');
        }
    }

    // Draw Blue Line (horizontal: 15→16→...→22→8→23→...→26)
    const blueOrder = [15, 16, 17, 18, 19, 20, 21, 22, 8, 23, 24, 25, 26];
    for (let i = 0; i < blueOrder.length - 1; i++) {
        const current = positions[blueOrder[i]];
        const next = positions[blueOrder[i + 1]];
        if (current && next) {
            drawLine(container, current, next, 'blue-line');
        }
    }

    // Draw Red Line: 27→28→10→29→30→31→32→33
    const redOrder = [27, 28, 10, 29, 30, 31, 32, 33];
    for (let i = 0; i < redOrder.length - 1; i++) {
        const current = positions[redOrder[i]];
        const next = positions[redOrder[i + 1]];
        if (current && next) {
            drawLine(container, current, next, 'red-line');
        }
    }
}

function drawLine(container, pos1, pos2, className) {
    const line = document.createElement('div');
    line.className = 'map-line ' + className;

    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    line.style.width = length + 'px';
    line.style.left = (pos1.x + 6) + 'px';
    line.style.top = (pos1.y + 6) + 'px';
    line.style.transform = 'rotate(' + angle + 'deg)';

    container.appendChild(line);
}

function highlightRouteOnMap(path) {
    renderMetroMap();

    const allStations = document.querySelectorAll('.map-station');
    path.forEach(stationId => {
        allStations.forEach(dot => {
            if (parseInt(dot.dataset.id) === stationId) {
                dot.style.boxShadow = '0 0 20px 5px rgba(255, 215, 0, 0.9)';
                dot.style.transform = 'scale(1.8)';
                dot.style.zIndex = '100';
            }
        });
    });
}

function zoomMap(factor) {
    mapScale *= factor;
    const mapEl = document.getElementById('metroMap');
    mapEl.style.transform = 'scale(' + mapScale + ')';
    mapEl.style.transformOrigin = 'top left';
}

function resetMapZoom() {
    mapScale = 1;
    const mapEl = document.getElementById('metroMap');
    mapEl.style.transform = 'scale(1)';
}
