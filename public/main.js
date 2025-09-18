// Get env variables (Vite style)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Dynamically load Google Maps script
function loadGoogleMaps() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=visualization&callback=initMap`;
    script.async = true;
    window.initMap = resolve;
    document.head.appendChild(script);
  });
}

let map, heatmap, markers = [], predictions = [];

async function init() {
  await loadGoogleMaps();

  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 6,
    center: { lat: 37.782, lng: -122.447 },
    mapTypeId: 'roadmap'
  });

  // Load previous predictions
  await fetchAllPredictions();

  // Button click
  document.getElementById('predict-btn').addEventListener('click', () => {
    const address = document.getElementById('address').value;
    if (!address) return alert("Please enter an address");
    addPrediction(address);
  });

  // Auto-refresh every 10s
  setInterval(fetchAllPredictions, 10000);
}

// Fetch all previous predictions
async function fetchAllPredictions() {
  try {
    const res = await fetch(`${BACKEND_URL}/predictions`);
    if (!res.ok) throw new Error("Failed to fetch predictions");
    predictions = await res.json();
    updateHeatmap();
  } catch (err) {
    console.error(err);
  }
}

// Add new prediction
async function addPrediction(address) {
  try {
    const res = await fetch(`${BACKEND_URL}/predict`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ address })
    });
    if (!res.ok) throw new Error("Backend error");
    const result = await res.json();
    predictions.push(result);
    updateHeatmap();
  } catch (err) {
    console.error(err);
    alert("Failed to predict fire risk.");
  }
}

// Update heatmap & markers
function updateHeatmap() {
  if (!map) return;
  if (heatmap) heatmap.setMap(null);
  markers.forEach(m => m.setMap(null));
  markers = [];

  const heatmapData = predictions.map(loc => ({
    location: new google.maps.LatLng(loc.lat, loc.lng),
    weight: Math.max(loc.vegetation_score, loc.structure_score, loc.hazard_score)
  }));

  heatmap = new google.maps.visualization.HeatmapLayer({
    data: heatmapData,
    dissipating: true,
    radius: 40,
    opacity: 0.7
  });
  heatmap.setMap(map);

  predictions.forEach(loc => {
    const marker = new google.maps.Marker({
      position: { lat: loc.lat, lng: loc.lng },
      map: map
    });
    const info = new google.maps.InfoWindow({
      content: `
        <b>Address:</b> ${loc.address}<br>
        <b>Vegetation:</b> ${loc.vegetation_score}<br>
        <b>Structure:</b> ${loc.structure_score}<br>
        <b>Hazard:</b> ${loc.hazard_score}
      `
    });
    marker.addListener('click', () => info.open(map, marker));
    markers.push(marker);
  });
}

init();
