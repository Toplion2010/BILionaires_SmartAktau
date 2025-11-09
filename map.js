// Map module using Leaflet

const MapModule = {
    map: null,
    markers: [],
    selectedLocation: null,
    tempMarker: null,

    // Aktau coordinates
    AKTAU_CENTER: {
        lat: 43.65,
        lng: 51.20
    },

    // Initialize the map
    init() {
        // Create map centered on Aktau
        this.map = L.map('map').setView(
            [this.AKTAU_CENTER.lat, this.AKTAU_CENTER.lng],
            12
        );

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Add click handler for selecting location
        this.map.on('click', (e) => {
            this.handleMapClick(e);
        });

        console.log('Map initialized at Aktau:', this.AKTAU_CENTER);
    },

    // Handle map clicks for location selection
    handleMapClick(e) {
        const { lat, lng } = e.latlng;

        // Store selected location
        this.selectedLocation = { lat, lng };

        // Remove previous temporary marker if exists
        if (this.tempMarker) {
            this.map.removeLayer(this.tempMarker);
        }

        // Add temporary marker
        this.tempMarker = L.marker([lat, lng], {
            icon: this.createIcon('📍', '#f59e0b')
        }).addTo(this.map);

        // Update form fields and status
        this.updateLocationFields(lat, lng);

        console.log('Location selected:', { lat, lng });
    },

    // Update location fields in the form
    updateLocationFields(lat, lng) {
        const latField = document.getElementById('latitude');
        const lngField = document.getElementById('longitude');
        const statusElement = document.getElementById('locationStatusText');

        if (latField && lngField && statusElement) {
            latField.value = lat;
            lngField.value = lng;
            statusElement.textContent = `✅ Выбрано: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            statusElement.classList.add('selected');
        }
    },

    // Add complaint marker to map
    addComplaintMarker(complaint) {
        // Support both old (latitude/longitude) and new (lat/lon) field names
        const lat = complaint.lat || complaint.latitude;
        const lon = complaint.lon || complaint.longitude;
        const { title, category, description, status, id } = complaint;

        if (!lat || !lon) return;

        // Create marker with category-specific icon
        const icon = this.createIcon(this.getCategoryIcon(category), this.getStatusColor(status));

        const marker = L.marker([lat, lon], { icon })
            .addTo(this.map)
            .bindPopup(this.createPopupContent(complaint));

        // Store marker reference
        this.markers.push({ id, marker });

        return marker;
    },

    // Create custom icon
    createIcon(emoji, color) {
        return L.divIcon({
            html: `<div style="background-color: ${color}; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${emoji}</div>`,
            className: 'custom-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    },

    // Get category icon
    getCategoryIcon(category) {
        const icons = {
            water: '💧',
            garbage: '🗑️',
            lighting: '💡',
            roads: '🛣️',
            other: '📌'
        };
        return icons[category] || '📌';
    },

    // Get status color
    getStatusColor(status) {
        const colors = {
            'new': '#f59e0b',
            'processing': '#3b82f6',
            'completed': '#10b981',
            'Получено': '#f59e0b',
            'В обработке': '#3b82f6',
            'Выполнено': '#10b981'
        };
        return colors[status] || '#6b7280';
    },

    // Create popup content for marker
    createPopupContent(complaint) {
        // Support both old and new field names
        const { title, category, description, status } = complaint;
        const createdAt = complaint.created_at || complaint.createdAt;
        const date = new Date(createdAt).toLocaleDateString('ru-RU');

        return `
            <div class="popup-content">
                <div class="popup-title">${title}</div>
                <div class="popup-category">${this.getCategoryIcon(category)} ${this.getCategoryName(category)}</div>
                <div class="popup-description">${description.substring(0, 100)}${description.length > 100 ? '...' : ''}</div>
                <div class="popup-date">📅 ${date} • ${this.getStatusName(status)}</div>
            </div>
        `;
    },

    // Get category name
    getCategoryName(category) {
        const names = {
            water: 'Водоснабжение',
            garbage: 'Мусор',
            lighting: 'Освещение',
            roads: 'Дороги',
            other: 'Другое'
        };
        return names[category] || 'Другое';
    },

    // Get status name
    getStatusName(status) {
        const names = {
            new: 'Получено',
            processing: 'В обработке',
            completed: 'Выполнено'
        };
        return names[status] || 'Получено';
    },

    // Clear all markers
    clearMarkers() {
        this.markers.forEach(({ marker }) => {
            this.map.removeLayer(marker);
        });
        this.markers = [];
    },

    // Clear temporary marker
    clearTempMarker() {
        if (this.tempMarker) {
            this.map.removeLayer(this.tempMarker);
            this.tempMarker = null;
        }
        this.selectedLocation = null;
    },

    // Reload all complaint markers
    reloadMarkers() {
        this.clearMarkers();
        const complaints = API.getComplaints();
        complaints.forEach(complaint => {
            this.addComplaintMarker(complaint);
        });
    }
};

// Export MapModule globally for compatibility
window.MapModule = MapModule;

export default MapModule;
