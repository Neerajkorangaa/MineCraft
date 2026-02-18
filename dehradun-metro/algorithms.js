// ============================================
// DEHRADUN METRO - ALGORITHMS
// BFS and Dijkstra implementations
// ============================================

// BFS Algorithm - Find route with minimum stops
function bfsShortestPath(graph, sourceId, destId) {
    const visited = new Set();
    const queue = [[sourceId]];
    const distances = {};
    const times = {};

    visited.add(sourceId);
    distances[sourceId] = 0;
    times[sourceId] = 0;

    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];

        // Found destination
        if (current === destId) {
            return {
                path: path,
                totalDistance: distances[destId],
                totalTime: times[destId],
                algorithm: 'BFS'
            };
        }

        // Visit neighbors
        const neighbors = graph[current];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor.dest)) {
                visited.add(neighbor.dest);
                const newPath = [...path, neighbor.dest];
                queue.push(newPath);
                distances[neighbor.dest] = distances[current] + neighbor.distance;
                times[neighbor.dest] = times[current] + neighbor.time;
            }
        }
    }

    return null; // No path found
}

// Dijkstra Algorithm - Find route with shortest distance
function dijkstraShortestPath(graph, sourceId, destId) {
    const distances = {};
    const times = {};
    const previous = {};
    const visited = new Set();
    const unvisited = new Set(stations.map(s => s.id));

    // Initialize distances
    stations.forEach(station => {
        distances[station.id] = Infinity;
        times[station.id] = Infinity;
        previous[station.id] = null;
    });

    distances[sourceId] = 0;
    times[sourceId] = 0;

    while (unvisited.size > 0) {
        // Find unvisited node with minimum distance
        let minDist = Infinity;
        let current = null;

        for (const nodeId of unvisited) {
            if (distances[nodeId] < minDist) {
                minDist = distances[nodeId];
                current = nodeId;
            }
        }

        if (current === null || current === destId) break;

        unvisited.delete(current);
        visited.add(current);

        // Update distances to neighbors
        const neighbors = graph[current];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor.dest)) {
                const newDist = distances[current] + neighbor.distance;

                if (newDist < distances[neighbor.dest]) {
                    distances[neighbor.dest] = newDist;
                    times[neighbor.dest] = times[current] + neighbor.time;
                    previous[neighbor.dest] = current;
                }
            }
        }
    }

    // Reconstruct path
    if (distances[destId] === Infinity) {
        return null; // No path found
    }

    const path = [];
    let current = destId;
    while (current !== null) {
        path.unshift(current);
        current = previous[current];
    }

    return {
        path: path,
        totalDistance: distances[destId],
        totalTime: times[destId],
        algorithm: 'Dijkstra'
    };
}

// Calculate fare based on distance and interchanges
function calculateFare(distance, interchanges) {
    const distanceKm = distance / 1000;
    const baseFare = fareConfig.baseFare;
    const distanceCharge = Math.ceil(distanceKm * fareConfig.perKmCharge);
    const interchangeCharge = interchanges * fareConfig.interchangeCharge;

    return {
        baseFare,
        distanceCharge,
        interchangeCharge,
        total: baseFare + distanceCharge + interchangeCharge
    };
}

// Count line changes in path
function countLineChanges(path) {
    if (path.length <= 1) return 0;

    let changes = 0;
    let previousLine = getStationById(path[0]).line;

    for (let i = 1; i < path.length; i++) {
        const currentLine = getStationById(path[i]).line;
        if (currentLine !== previousLine) {
            changes++;
            previousLine = currentLine;
        }
    }

    return changes;
}
