const OLA_API_KEY = "e0fSRVJPLSC86zNFyPrIlBBY8wkleXtx03EDReYS"; 
const MAP_CONTAINER_ID = 'map';
const LAYER_CONTROL_ID = 'layer-list';
const LIGHT_STYLE_BASE = "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard";
const STYLE_JSON_URL = `${LIGHT_STYLE_BASE}/style.json?api_key=${OLA_API_KEY}`;

let mapInstance = null;
let olaMaps = null;

const DEFAULT_CENTER = [77.6045, 12.9716]; 
const DEFAULT_ZOOM = 11;

/**
 * Converts an RGBA/color name string to a basic hex string for the HTML color picker.
 * @param {string} color - The color value from the map style.
 * @returns {string} The hex color code.
 */
function colorToHex(color) {
    if (typeof color !== 'string') return '#000000';
    
    if (color.startsWith('#')) return color.substring(0, 7); // Ensure only the hex part is returned
    
    const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d\.]+))?\)$/);
    if (match) {
        let hex = '#';
        for (let i = 1; i <= 3; i++) {
            let part = parseInt(match[i]).toString(16);
            hex += (part.length === 1) ? '0' + part : part;
        }
        return hex;
    }
    
    // Fallback for named colors or complex unparsed strings
    return '#333333';
}

/**
 * Populates the layer control panel with checkboxes and color pickers.
 * @param {Array<Object>} layers - The layers array from the MapLibre style object.
 */
function populateLayerControl(layers) {
    const layerList = document.getElementById(LAYER_CONTROL_ID);
    layerList.innerHTML = ''; 

    const customizableTypes = ['fill', 'line'];
    const colorProperties = {
        'fill': 'fill-color',
        'line': 'line-color',
        'background': 'background-color'
    };

    // Filter layers: Only include layers we can meaningfully interact with via simple controls
    const displayLayers = layers.filter(layer => 
        (customizableTypes.includes(layer.type) || layer.id === 'background') &&
        // Exclude layers using complex data-driven styles (stops/match)
        !Object.values(layer.paint).some(prop => typeof prop === 'object' && (prop.stops || prop.match))
    );

    displayLayers.forEach(layer => {
        const layerId = layer.id;
        const layerType = layer.type;
        const colorProp = colorProperties[layerType];
        
        // Skip if we can't determine the color property
        if (!colorProp) return; 

        // Determine initial state
        const isVisible = (layer.layout && layer.layout.visibility === 'none') ? false : true;
        const initialColor = layer.paint[colorProp] ? colorToHex(layer.paint[colorProp]) : '#333333';
        
        const label = document.createElement('div');
        label.className = 'layer-item text-gray-700 hover:bg-gray-50 rounded cursor-pointer';
        
        label.innerHTML = `
            <input type="checkbox" data-layer-id="${layerId}" data-action="visibility" ${isVisible ? 'checked' : ''}
                   class="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition duration-150 ease-in-out">
            <span class="truncate">${layerId.replace(/_/g, ' ').replace(/-/g, ' ')}</span>
            <input type="color" data-layer-id="${layerId}" data-color-prop="${colorProp}" value="${initialColor}" 
                   class="color-input">
        `;
        layerList.appendChild(label);
    });

    // --- Event Listeners for Layer Control ---
    layerList.addEventListener('change', (event) => {
        const target = event.target;
        const layerId = target.dataset.layerId;
        
        if (!mapInstance || !layerId) return;

        if (target.type === 'checkbox' && target.dataset.action === 'visibility') {
            // Handle Visibility Toggle
            const visibility = target.checked ? 'visible' : 'none';
            mapInstance.setLayoutProperty(layerId, 'visibility', visibility);

        } else if (target.type === 'color') {
            // Handle Color Change
            const newColor = target.value;
            const colorProperty = target.dataset.colorProp;
            
            if (mapInstance.getPaintProperty(layerId, colorProperty) !== undefined) {
                mapInstance.setPaintProperty(layerId, colorProperty, newColor);
            }
        }
    });
}

/**
 * Initializes or reloads the map with the specified language code.
 * @param {string} langCode - The language suffix (e.g., "-hi" for Hindi).
 */
function initializeMap(langCode = "") {
    
    const styleURL = `${LIGHT_STYLE_BASE}${langCode}/style.json?api_key=${OLA_API_KEY}`;
    
    let currentCenter = DEFAULT_CENTER;
    let currentZoom = DEFAULT_ZOOM;                    
    
    if (mapInstance) {
        // Capture current state before removal
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
        });

        // After the map loads, fetch layers and populate controls
        mapInstance.on('load', async () => {
            try {
                // Fetch the base style JSON to get the list of layers and their initial colors
                const response = await fetch(STYLE_JSON_URL);
                const styleJson = await response.json();
                populateLayerControl(styleJson.layers);
            } catch (error) {
                console.error('Failed to fetch style JSON for layer control:', error);
                document.getElementById(LAYER_CONTROL_ID).innerHTML = 
                    '<p class="text-red-500">Could not load layer list for editing.</p>';
            }
        });

    } catch (error) {
        console.error("Map initialization failed:", error);
        // Display user-friendly error
        const mapDiv = document.getElementById(MAP_CONTAINER_ID);
        mapDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-red-600 bg-red-100 p-8 rounded-xl m-4">
                <p class="font-bold text-xl">❌ Error: Map failed to load.</p>
                <p class="mt-2 text-md text-center">There was an issue initializing the map. Check the console for API key errors or network issues.</p>
            </div>
        `;
    }
}

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    const languageSelect = document.getElementById('language-select');
    
    // Initial map load
    initializeMap(languageSelect.value);

    // Set up listener for language changes
    languageSelect.addEventListener('change', (event) => {
        const newLangCode = event.target.value;
        // Re-initialize map with new language, preserving position/zoom
        initializeMap(newLangCode); 
    });
});
