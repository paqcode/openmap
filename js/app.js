// ── Selectores ──────────────────────────────────────────────
const distEl     = document.querySelector("#distance");
const form       = document.querySelector("#addressForm");
const latEl      = document.querySelector("#latitud");
const lonEl      = document.querySelector("#longitud");
const ubicateBtn = document.querySelector(".ubicate");
const addressInp = document.querySelector("#address");
// Opcionales: solo existen en el HTML nuevo
const mapLoading = document.querySelector("#map-loading");
const mapHint    = document.querySelector("#map-hint");
const btnText    = document.querySelector(".btn-text");
const btnSpinner = document.querySelector(".btn-spinner");

// Fallback si la geolocalización falla (Montevideo)
const FALLBACK_LAT = -34.9011;
const FALLBACK_LON = -56.1645;

let map        = null;
let destPoint  = null;
let homeMarker = null;

// ── Toast ─────────────────────────────────────────────────────
// Funciona con HTML nuevo (tiene #toast) y con HTML viejo (solo loguea)
function showToast(message, type = "info") {
  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  const container = document.querySelector("#toast");
  if (!container) {
    console.info(`[${type}] ${message}`);
    return;
  }
  const item = document.createElement("div");
  item.className = `toast-item ${type}`;
  item.textContent = `${icons[type] ?? ""} ${message}`;
  container.appendChild(item);
  setTimeout(() => item.remove(), 3800);
}

// ── Helpers null-safe ─────────────────────────────────────────
function showMapLoading(visible) {
  if (mapLoading) mapLoading.classList.toggle("hidden", !visible);
}

function hideHint() {
  if (mapHint) mapHint.classList.add("hidden");
}

function showHint() {
  if (mapHint) mapHint.classList.remove("hidden");
}

function setBtnLoading(loading) {
  if (btnText)    btnText.classList.toggle("hidden", loading);
  if (btnSpinner) btnSpinner.classList.toggle("hidden", !loading);
}

// ── Geolocalización ──────────────────────────────────────────
function ubicate() {
  if (addressInp) addressInp.value = "";

  if (!navigator.geolocation) {
    showToast("Tu navegador no soporta geolocalización. Cargando mapa por defecto.", "warning");
    createMap(FALLBACK_LAT, FALLBACK_LON);
    return;
  }

  showMapLoading(true);
  showToast("Obteniendo tu ubicación...", "info");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      createMap(position.coords.latitude, position.coords.longitude);
      showToast("Ubicación encontrada.", "success");
    },
    (error) => {
      const messages = {
        1: "Permiso denegado. Cargando mapa por defecto.",
        2: "No se pudo obtener la posición. Cargando mapa por defecto.",
        3: "Tiempo agotado. Cargando mapa por defecto.",
      };
      showToast(messages[error.code] ?? "Error de geolocalización. Cargando mapa por defecto.", "warning");
      // Siempre carga el mapa aunque falle la ubicación
      createMap(FALLBACK_LAT, FALLBACK_LON);
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

if (ubicateBtn) ubicateBtn.addEventListener("click", ubicate);

// ── Búsqueda por dirección ────────────────────────────────────
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const address = addressInp ? addressInp.value.trim() : "";

    if (!address) {
      showToast("Ingresá una dirección para buscar.", "warning");
      return;
    }

    const encodedAddress = encodeURIComponent(address).replace(/%20/g, "+");
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json`;

    setBtnLoading(true);
    showMapLoading(true);

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Error en la respuesta del servidor.");
        return response.json();
      })
      .then((data) => {
        if (data.length > 0) {
          const { lat, lon, display_name } = data[0];
          createMap(parseFloat(lat), parseFloat(lon));
          const label = display_name.split(",").slice(0, 2).join(",");
          showToast(`Mostrando: ${label}`, "success");
        } else {
          showToast("No se encontró la dirección. Intentá con más detalle.", "warning");
          showMapLoading(false);
        }
      })
      .catch(() => {
        showToast("Error de conexión. Verificá tu internet.", "error");
        showMapLoading(false);
      })
      .finally(() => {
        setBtnLoading(false);
      });
  });
}

// ── Crear / recrear mapa ──────────────────────────────────────
function createMap(lat, lon) {
  if (map) {
    map.remove();
    map = null;
  }

  destPoint  = null;
  homeMarker = null;

  if (distEl) distEl.textContent = "--";
  if (latEl)  latEl.textContent  = lat.toFixed(6);
  if (lonEl)  lonEl.textContent  = lon.toFixed(6);

  map = L.map("my_map").setView([lat, lon], 17);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const myIcon = L.icon({
    iconUrl:     "assets/my-icon.png",
    iconSize:    [50, 50],
    iconAnchor:  [25, 50],
    popupAnchor: [0, -50],
  });

  homeMarker = L.marker([lat, lon], { icon: myIcon })
    .addTo(map)
    .bindPopup("📍 Tu ubicación")
    .openPopup();

  showMapLoading(false);
  showHint();

  map.on("click", createDestPoint);
}

// ── Punto destino ─────────────────────────────────────────────
function createDestPoint(e) {
  if (destPoint) map.removeLayer(destPoint);

  destPoint = L.marker(e.latlng, { draggable: true })
    .addTo(map)
    .bindPopup("🎯 Destino — arrastralo para ajustar")
    .openPopup();

  hideHint();
  updateDistance();
  destPoint.on("drag",    updateDistance);
  destPoint.on("dragend", updateDistance);
}

// ── Calcular distancia ────────────────────────────────────────
function updateDistance() {
  if (!homeMarker || !destPoint || !distEl) return;

  const distance = map.distance(homeMarker.getLatLng(), destPoint.getLatLng());

  distEl.textContent = distance < 1000
    ? `${Math.round(distance)} m`
    : `${(distance / 1000).toFixed(2)} km`;
}

// ── Iniciar ───────────────────────────────────────────────────
ubicate();
