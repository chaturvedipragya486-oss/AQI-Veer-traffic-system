const app = {
    map: null,
    currentRoute: null,
    userRole: 'Citizen', 
    aqiZones: [],    // Array tracking objects: { latlng: L.LatLng, level: 'high'|'moderate'|'low' }
    zoneMarkers: [], // Holds active circles rendered over layout map framework

    // 1. App Authentication Entry point
    login(role) {
        const username = document.getElementById('username').value.trim();
        if (!username) return alert("Identification context required to clear shutter.");
        
        this.userRole = role;
        document.getElementById('user-role-display').innerText = `Role: ${role} (${username})`;
        
        // Show/Hide Administrative configuration options dynamically
        const adminPanel = document.getElementById('official-panel');
        if (role === 'Official') {
            adminPanel.classList.remove('hidden');
        } else {
            adminPanel.classList.add('hidden');
        }

        document.getElementById('shutter').classList.remove('active');
        document.getElementById('dashboard').classList.add('active');
        
        this.initMap();
    },

    logout() {
        document.getElementById('dashboard').classList.remove('active');
        document.getElementById('shutter').classList.add('active');
    },

    // 2. Initialize Map Canvas
    initMap() {
        if (this.map) {
            this.map.invalidateSize();
            return;
        }

        // Focus map layout on Jaipur area context grid
        this.map = L.map('map').setView([26.9124, 75.7873], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Capture clicks to log IoT environmental zones if profile is Official
        this.map.on('click', (e) => {
            if (this.userRole === 'Official') {
                this.createNewAqiZone(e.latlng);
            }
        });
    },

    // 3. Official Control: Generate Multi-Tier IoT Risk Sectors
    createNewAqiZone(latlng) {
        const selectedLevel = document.getElementById('aqi-level-select').value;
        
        let config = { color: '#10b981', fill: '#a7f3d0', label: 'Low/Safe AQI' }; // Low default
        if (selectedLevel === 'high') {
            config = { color: '#ef4444', fill: '#fca5a5', label: 'High AQI Hazard Zone' };
        } else if (selectedLevel === 'moderate') {
            config = { color: '#f59e0b', fill: '#fde68a', label: 'Moderate AQI Warning Zone' };
        }

        // Draw warning tracking perimeters matching sensor thresholds
        const activeCircle = L.circle(latlng, {
            color: config.color,
            fillColor: config.fill,
            fillOpacity: 0.5,
            radius: 2000 // Covers a 2km radius area
        }).addTo(this.map);

        activeCircle.bindPopup(`<b>🌱 Sensor Report: ${config.label}</b><br>Logged successfully into navigation network.`).openPopup();
        
        // Retain zone reference metadata for routing algorithm cross-analysis
        this.aqiZones.push({ latlng: latlng, level: selectedLevel });
        this.zoneMarkers.push(activeCircle);
        
        // Auto-refresh any current paths visible to show interaction with the new zone
        this.calculatePreciseRoute(true);
    },

    clearHighAQIZones() {
        this.zoneMarkers.forEach(layer => this.map.removeLayer(layer));
        this.zoneMarkers = [];
        this.aqiZones = [];
        this.calculatePreciseRoute(true);
    },

    // 4. Geocoder Engine (Address Strings to Coordinates)
    async geocode(address) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                return L.latLng(data[0].lat, data[0].lon);
            }
            return null;
        } catch (err) {
            return null;
        }
    },

    // 5. Intelligent Eco-Routing Logic
    async calculatePreciseRoute(quietMode = false) {
        const startInput = document.getElementById('start').value;
        const endInput = document.getElementById('end').value;

        if (!startInput || !endInput) {
            if (!quietMode) alert("Source and Destination inputs must be specified.");
            return;
        }

        const searchBtn = document.querySelector('.btn-search');
        searchBtn.innerText = "Analyzing Safe Tracks...";
        searchBtn.disabled = true;

        const startLatLng = await this.geocode(startInput);
        const endLatLng = await this.geocode(endInput);

        if (!startLatLng || !endLatLng) {
            if (!quietMode) alert("Could not resolve location points. Check spelling accuracy.");
            searchBtn.innerText = "Analyze & Find Safest Route";
            searchBtn.disabled = false;
            return;
        }

        if (this.currentRoute) {
            this.map.removeControl(this.currentRoute);
        }

        // Setup routing engine instance
        this.currentRoute = L.Routing.control({
            waypoints: [startLatLng, endLatLng],
            show: false,
            addWaypoints: false,
            createMarker: function() { return null; } // Cleaner UI without map cluttering pins
        }).addTo(this.map);

        // Listen for route mapping calculations to evaluate path intersection risks
        this.currentRoute.on('routesfound', (e) => {
            const coordinates = e.routes[0].coordinates; // Gets array of coordinates along the route line
            let finalStatus = 'clean'; // Fallback clean path setting

            // Loop through points on the route and check their distance from active AQI zones
            for (let point of coordinates) {
                const routePointLatLng = L.latLng(point.lat, point.lng);

                for (let zone of this.aqiZones) {
                    const distance = routePointLatLng.distanceTo(zone.latlng);
                    
                    // Inside the zone's 2000m radius
                    if (distance <= 2000) {
                        if (zone.level === 'high') {
                            finalStatus = 'danger'; // Prioritize high threat warnings
                            break;
                        } else if (zone.level === 'moderate' && finalStatus !== 'danger') {
                            finalStatus = 'warn';
                        }
                    }
                }
                if (finalStatus === 'danger') break; // Exit early if severe route threat found
            }

            // Define UI reports and routing track colors based on risk state
            let routeStyleColor = '#10b981'; // Default Safe Green Route line
            const reportBox = document.getElementById('aqi-report');
            const statusText = document.getElementById('aqi-status-text');

            reportBox.classList.remove('hidden', 'safe', 'warn', 'danger');

            if (finalStatus === 'danger') {
                routeStyleColor = '#ef4444'; // Red Route Line
                reportBox.classList.add('danger');
                statusText.innerHTML = "<b>⚠️ Route Danger Alert:</b> This path intersects an active High AQI Red Zone. For your safety, citizens should avoid this route due to sensor alerts.";
            } else if (finalStatus === 'warn') {
                routeStyleColor = '#f59e0b'; // Yellow Route Line
                reportBox.classList.add('warn');
                statusText.innerHTML = "<b>⚠️ Caution Advised:</b> This path passes through a Moderate AQI Yellow Zone. The air quality is acceptable, but sensitive groups should consider masking.";
            } else {
                reportBox.classList.add('safe');
                statusText.innerHTML = "<b>🌱 Safest Route Confirmed:</b> Your path avoids all high-pollution air grids and runs through green, clean-air corridors.";
            }

            // Override and repaint the route path lines with the correct safety color
            this.currentRoute.eachLayer((layer) => {
                if (layer instanceof L.Polyline) {
                    layer.setStyle({ color: routeStyleColor, weight: 6, opacity: 0.85 });
                }
            });

            searchBtn.innerText = "Analyze & Find Safest Route";
            searchBtn.disabled = false;
        });

        // Error handling fallback for failed route lookups
        this.currentRoute.on('routingerror', () => {
            searchBtn.innerText = "Analyze & Find Safest Route";
            searchBtn.disabled = false;
        });
    }
};