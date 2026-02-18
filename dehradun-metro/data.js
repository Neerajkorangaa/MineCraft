// ============================================
// DEHRADUN METRO - DATA FILE (UPDATED)
// 33 stations across 3 lines based on actual Dehradun map
// ============================================

// Station data - based on hand-drawn Dehradun map
const stations = [
    // YELLOW LINE (Line 1): Rishikesh to Mussoorie - 14 stations
    { id: 1, name: "Rishikesh", line: "yellow", isInterchange: false },
    { id: 2, name: "Tapovan", line: "yellow", isInterchange: false },
    { id: 3, name: "Raiwala", line: "yellow", isInterchange: false },
    { id: 4, name: "Jolly Grant Airport", line: "yellow", isInterchange: false },
    { id: 5, name: "Doiwala", line: "yellow", isInterchange: false },
    { id: 6, name: "Clement Town", line: "yellow", isInterchange: false },
    { id: 7, name: "Subhash Nagar", line: "yellow", isInterchange: false },
    { id: 8, name: "ISBT", line: "yellow", isInterchange: true },
    { id: 9, name: "Dalanwala", line: "yellow", isInterchange: false },
    { id: 10, name: "Rajpur", line: "yellow", isInterchange: true },
    { id: 11, name: "Tapkeshwar", line: "yellow", isInterchange: false },
    { id: 12, name: "Ghuchupani", line: "yellow", isInterchange: false },
    { id: 13, name: "Rispa", line: "yellow", isInterchange: false },
    { id: 14, name: "Mussoorie Diversion", line: "yellow", isInterchange: false },

    // BLUE LINE (Line 2): Selaqui to Lacchi Wala - 12 stations (+ ISBT shared)
    { id: 15, name: "Selaqui", line: "blue", isInterchange: false },
    { id: 16, name: "Graphic Era Hospital", line: "blue", isInterchange: false },
    { id: 17, name: "Jhajra", line: "blue", isInterchange: false },
    { id: 18, name: "IMA", line: "blue", isInterchange: false },
    { id: 19, name: "Sudhowala", line: "blue", isInterchange: false },
    { id: 20, name: "Prem Nagar", line: "blue", isInterchange: false },
    { id: 21, name: "Nanda Ki Chowki", line: "blue", isInterchange: false },
    { id: 22, name: "Majra", line: "blue", isInterchange: false },
    // ISBT (id 8) is shared interchange Yellow + Blue
    { id: 23, name: "Banjarawala", line: "blue", isInterchange: false },
    { id: 24, name: "Doon University", line: "blue", isInterchange: false },
    { id: 25, name: "Mothrowala", line: "blue", isInterchange: false },
    { id: 26, name: "Lacchi Wala", line: "blue", isInterchange: false },

    // RED LINE (Line 3): FRI to Maldevta - 7 stations (+ Rajpur shared)
    { id: 27, name: "FRI", line: "red", isInterchange: false },
    { id: 28, name: "Ballupur", line: "red", isInterchange: false },
    // Rajpur (id 10) is shared interchange Yellow + Red
    { id: 29, name: "Jakhan", line: "red", isInterchange: false },
    { id: 30, name: "Fun N Food", line: "red", isInterchange: false },
    { id: 31, name: "Dehradun Zoo", line: "red", isInterchange: false },
    { id: 32, name: "Sahastradhara", line: "red", isInterchange: false },
    { id: 33, name: "Maldevta", line: "red", isInterchange: false }
];

// Route connections - bidirectional edges
const routes = [
    // YELLOW LINE connections (Rishikesh to Mussoorie)
    { from: 1, to: 2, distance: 3000, time: 5 },
    { from: 2, to: 3, distance: 4000, time: 6 },
    { from: 3, to: 4, distance: 6000, time: 8 },
    { from: 4, to: 5, distance: 4000, time: 6 },
    { from: 5, to: 6, distance: 5000, time: 7 },
    { from: 6, to: 7, distance: 2000, time: 3 },
    { from: 7, to: 8, distance: 2000, time: 3 },
    { from: 8, to: 9, distance: 1500, time: 3 },
    { from: 9, to: 10, distance: 2000, time: 3 },
    { from: 10, to: 11, distance: 3000, time: 4 },
    { from: 11, to: 12, distance: 2500, time: 4 },
    { from: 12, to: 13, distance: 3000, time: 5 },
    { from: 13, to: 14, distance: 4000, time: 6 },

    // BLUE LINE connections (Selaqui to Lacchi Wala through ISBT)
    { from: 15, to: 16, distance: 3000, time: 5 },
    { from: 16, to: 17, distance: 2500, time: 4 },
    { from: 17, to: 18, distance: 3000, time: 4 },
    { from: 18, to: 19, distance: 2000, time: 3 },
    { from: 19, to: 20, distance: 2500, time: 4 },
    { from: 20, to: 21, distance: 1500, time: 3 },
    { from: 21, to: 22, distance: 2000, time: 3 },
    { from: 22, to: 8, distance: 1500, time: 3 },   // Majra → ISBT (interchange)
    { from: 8, to: 23, distance: 2000, time: 3 },    // ISBT → Banjarawala
    { from: 23, to: 24, distance: 2500, time: 4 },
    { from: 24, to: 25, distance: 2000, time: 3 },
    { from: 25, to: 26, distance: 3000, time: 5 },

    // RED LINE connections (FRI to Maldevta through Rajpur)
    { from: 27, to: 28, distance: 2000, time: 3 },
    { from: 28, to: 10, distance: 1500, time: 3 },   // Ballupur → Rajpur (interchange)
    { from: 10, to: 29, distance: 2000, time: 3 },    // Rajpur → Jakhan
    { from: 29, to: 30, distance: 2000, time: 3 },
    { from: 30, to: 31, distance: 1500, time: 3 },
    { from: 31, to: 32, distance: 3000, time: 4 },
    { from: 32, to: 33, distance: 2500, time: 4 }
];

// Fare constants
const fareConfig = {
    baseFare: 10,
    perKmCharge: 3,
    interchangeCharge: 5
};

// Helper function to get station by ID
function getStationById(id) {
    return stations.find(s => s.id === id);
}

// Helper function to get station by name
function getStationByName(name) {
    return stations.find(s => s.name.toLowerCase() === name.toLowerCase());
}

// Build adjacency list for graph
function buildGraph() {
    const graph = {};

    // Initialize graph
    stations.forEach(station => {
        graph[station.id] = [];
    });

    // Add bidirectional edges
    routes.forEach(route => {
        graph[route.from].push({
            dest: route.to,
            distance: route.distance,
            time: route.time
        });
        graph[route.to].push({
            dest: route.from,
            distance: route.distance,
            time: route.time
        });
    });

    return graph;
}
