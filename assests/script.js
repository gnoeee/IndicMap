const OLA_API_KEY = "e0fSRVJPLSC86zNFyPrIlBBY8wkleXtx03EDReYS"; 
const MAP_CONTAINER_ID = 'map';
const LAYER_LIST_ID = 'layer-list'; // ID for the list container inside the panel
const LIGHT_STYLE_BASE = "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard";
const STYLE_JSON_URL = `${LIGHT_STYLE_BASE}/style.json?api_key=${OLA_API_KEY}`;

let mapInstance = null;
let olaMaps = null;

const DEFAULT_CENTER = [77.6045, 12.9716]; 
const DEFAULT_ZOOM = 12; // Slightly increased zoom for better first impression

/**
 * Converts an RGBA/color name string to a basic hex string for the HTML color picker.
 */
function colorToHex(color) {
    if (typeof color !== 'string') return '#000000';
    if (color.startsWith('#')) return color.substring(0, 7);
    
    const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d\.]+))?\)$/);
    if (match) {
        let hex = '#';
        for (let i = 1; i <= 3; i++) {
            let part = parseInt(match[i]).toString(16);
            hex += (part.length === 1) ? '0' + part : part;
        }
        return hex;
    }
    return '#333333';
}

/**
 * Populates the layer control panel.
 */
function populateLayerControl(layers) {
    const layerList = document.getElementById(LAYER_LIST_ID);
    layerList.innerHTML = ''; 

    const customizableTypes = ['fill', 'line'];
    const colorProperties = { 'fill': 'fill-color', 'line': 'line-color', 'background': 'background-color' };

    const displayLayers = layers.filter(layer => 
        (customizableTypes.includes(layer.type) || layer.id === 'background') &&
        !Object.values(layer.paint).some(prop => typeof prop === 'object' && (prop.stops || prop.match))
    );

    displayLayers.forEach(layer => {
        const layerId = layer.id;
        const layerType = layer.type;
        const colorProp = colorProperties[layerType];
        if (!colorProp) return; 

        const isVisible = (layer.layout && layer.layout.visibility === 'none') ? false : true;
        const initialColor = layer.paint[colorProp] ? colorToHex(layer.paint[colorProp]) : '#333333';
        
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-white/50 px-2 rounded transition-colors';
        
        item.innerHTML = `
            <div class="flex items-center space-x-3 overflow-hidden">
                <input type="checkbox" data-layer-id="${layerId}" data-action="visibility" ${isVisible ? 'checked' : ''}
                       class="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer">
                <span class="text-xs text-gray-700 font-medium truncate select-none" title="${layerId}">${layerId.replace(/_/g, ' ')}</span>
            </div>
            <input type="color" data-layer-id="${layerId}" data-color-prop="${colorProp}" value="${initialColor}" 
                   class="color-input flex-shrink-0 ml-2">
        `;
        layerList.appendChild(item);
    });

    // Event Delegation
    layerList.addEventListener('change', (event) => {
        const target = event.target;
        const layerId = target.dataset.layerId;
        if (!mapInstance || !layerId) return;

        if (target.type === 'checkbox' && target.dataset.action === 'visibility') {
            const visibility = target.checked ? 'visible' : 'none';
            mapInstance.setLayoutProperty(layerId, 'visibility', visibility);
        } else if (target.type === 'color') {
            const newColor = target.value;
            const colorProperty = target.dataset.colorProp;
            // setPaintProperty might throw if property doesn't exist, check first
            if (mapInstance.getPaintProperty(layerId, colorProperty) !== undefined) {
                mapInstance.setPaintProperty(layerId, colorProperty, newColor);
            }
        }
    });
}

/**
 * Initializes map
 */
function initializeMap(langCode = "") {
    const styleURL = `${LIGHT_STYLE_BASE}${langCode}/style.json?api_key=${OLA_API_KEY}`;
    
    let currentCenter = DEFAULT_CENTER;
    let currentZoom = DEFAULT_ZOOM;                    
    
    if (mapInstance) {
        currentCenter = mapInstance.getCenter().toArray();
        currentZoom = mapInstance.getZoom();
        mapInstance.remove(); 
        mapInstance = null;
        document.getElementById(MAP_CONTAINER_ID).innerHTML = '';
    } else if (!olaMaps) {
        olaMaps = new OlaMaps({ apiKey: OLA_API_KEY });
    }
	
    try {
        mapInstance = olaMaps.init({
            style: styleURL,
            container: MAP_CONTAINER_ID,
            center: currentCenter,
            zoom: currentZoom,
            attributionControl: false // We'll add custom attribution if needed or stick to default location
        });

        // Add standard navigation controls (compass only) to a clean position if desired, 
        // but we are using custom buttons for Zoom.
        // mapInstance.addControl(new olaMaps.NavigationControl({ showZoom: false }), 'bottom-right');

        mapInstance.on('load', async () => {
            try {
                const response = await fetch(STYLE_JSON_URL);
                const styleJson = await response.json();
                populateLayerControl(styleJson.layers);
            } catch (error) {
                console.error('Failed to fetch layers:', error);
                document.getElementById(LAYER_LIST_ID).innerHTML = '<p class="text-red-500 text-xs">Failed to load layers.</p>';
            }
        });

    } catch (error) {
        console.error("Map init error:", error);
    }
}

// --- UI Interaction Logic ---

function setupUIHandlers() {
    // 1. Layer Panel Toggle
    const layerBtn = document.getElementById('layer-toggle');
    const layerPanel = document.getElementById('layer-panel');
    let isLayerPanelOpen = false;

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!layerBtn.contains(e.target) && !layerPanel.contains(e.target) && isLayerPanelOpen) {
            layerPanel.classList.remove('open');
            isLayerPanelOpen = false;
        }
    });

    layerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isLayerPanelOpen = !isLayerPanelOpen;
        if (isLayerPanelOpen) {
            layerPanel.classList.add('open');
        } else {
            layerPanel.classList.remove('open');
        }
    });

    // 2. Zoom Controls
    document.getElementById('zoom-in').addEventListener('click', () => {
        if(mapInstance) mapInstance.zoomIn();
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        if(mapInstance) mapInstance.zoomOut();
    });

    // 3. Current Location
    const locateBtn = document.getElementById('locate-btn');
    locateBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        locateBtn.classList.add('animate-pulse'); // Feedback

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                if (mapInstance) {
                    mapInstance.flyTo({
                        center: [longitude, latitude],
                        zoom: 14,
                        essential: true
                    });
                    
                    // Add a marker
                    // Note: OlaMaps SDK might behave differently for markers, standard MapLibre syntax:
                    // new olaMaps.Marker().setLngLat([longitude, latitude]).addTo(mapInstance);
                    // Since we don't have the Marker constructor exposed directly on mapInstance traditionally,
                    // we might need to check the SDK docs. For now, flyTo is sufficient specific feedback.
                }
                locateBtn.classList.remove('animate-pulse');
            },
            (error) => {
                console.error("Geolocation error:", error);
                alert('Unable to retrieve your location');
                locateBtn.classList.remove('animate-pulse');
            },
            { enableHighAccuracy: true } // Request best possible accuracy
        );
    });

    // 4. Language Selector
    const languageSelect = document.getElementById('language-select');
    languageSelect.addEventListener('change', (event) => {
        initializeMap(event.target.value);
    });
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    const languageSelect = document.getElementById('language-select');
    initializeMap(languageSelect.value);
    setupUIHandlers();
});
