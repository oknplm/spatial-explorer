import { useEffect, useState } from "react";
import MapView from "./components/MapView.jsx";
import ResultsPanel from "./components/ResultsPanel.jsx";
import { api } from "./api.js";

export default function App() {
  const [mode, setMode] = useState("nearest"); // 'nearest' | 'parcel' | 'isochrone'
  const [amenityType, setAmenityType] = useState("");
  const [amenityTypes, setAmenityTypes] = useState([]);
  const [radiusM, setRadiusM] = useState(1000);
  const [minutes, setMinutes] = useState(15);
  const [profile, setProfile] = useState("walking");

  const [markerPoint, setMarkerPoint] = useState(null);
  const [amenityResponse, setAmenityResponse] = useState(null);
  const [parcelDetail, setParcelDetail] = useState(null);
  const [isochroneResponse, setIsochroneResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .amenityTypes()
      .then(setAmenityTypes)
      .catch(() => setAmenityTypes([])); // fine if DB isn't seeded yet
  }, []);

  async function handleMapClick({ lat, lon }) {
    setMarkerPoint({ lat, lon });
    setError(null);
    setLoading(true);
    try {
      if (mode === "nearest") {
        setParcelDetail(null);
        setIsochroneResponse(null);
        const resp = await api.nearest({ lat, lon, type: amenityType || undefined, radiusM });
        setAmenityResponse(resp);
      } else if (mode === "parcel") {
        setAmenityResponse(null);
        setIsochroneResponse(null);
        // Query a tiny bbox around the click, take the first parcel found there.
        const eps = 0.0006;
        const parcels = await api.parcelsInViewport({
          minLon: lon - eps,
          minLat: lat - eps,
          maxLon: lon + eps,
          maxLat: lat + eps,
        });
        if (parcels.length === 0) {
          setError("No parcel at that point.");
        } else {
          const detail = await api.parcelDetail(parcels[0].id);
          setParcelDetail(detail);
        }
      } else if (mode === "isochrone") {
        setAmenityResponse(null);
        setParcelDetail(null);
        const resp = await api.isochrone({ lat, lon, minutes, profile });
        setIsochroneResponse(resp);
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-layout">
      <div className="sidebar">
        <h1>Spatial Explorer</h1>
        <div className="subtitle">PostGIS-backed nearest-amenity, parcel/zoning, and isochrone demo</div>

        <div className="control-group">
          <label>Query mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="nearest">Nearest amenity</option>
            <option value="parcel">Parcel / zoning lookup</option>
            <option value="isochrone">Isochrone (travel-time area)</option>
          </select>
        </div>

        {mode === "nearest" && (
          <>
            <div className="control-group">
              <label>Amenity type</label>
              <select value={amenityType} onChange={(e) => setAmenityType(e.target.value)}>
                <option value="">All types</option>
                {amenityTypes.map((t) => (
                  <option key={t.amenity_type} value={t.amenity_type}>
                    {t.amenity_type} ({t.count})
                  </option>
                ))}
              </select>
            </div>
            <div className="control-group">
              <label>Search radius: {radiusM} m</label>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={radiusM}
                onChange={(e) => setRadiusM(Number(e.target.value))}
              />
            </div>
          </>
        )}

        {mode === "isochrone" && (
          <>
            <div className="control-group">
              <label>Travel mode</label>
              <select value={profile} onChange={(e) => setProfile(e.target.value)}>
                <option value="walking">Walking</option>
                <option value="cycling">Cycling</option>
                <option value="driving">Driving</option>
              </select>
            </div>
            <div className="control-group">
              <label>Minutes: {minutes}</label>
              <input
                type="range"
                min="1"
                max="60"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </div>
          </>
        )}

        {loading && <div className="hint">Loading…</div>}
        {error && <div className="note">{error}</div>}

        <ResultsPanel
          mode={mode}
          amenityResponse={amenityResponse}
          parcelDetail={parcelDetail}
          isochroneResponse={isochroneResponse}
        />

        <div className="hint">
          Click anywhere on the map. In "Nearest amenity" mode it runs an ST_DWithin + KNN (&lt;-&gt;)
          query; in "Parcel" mode it looks up the parcel under the click and checks flood-zone
          overlap; in "Isochrone" mode it requests a travel-time polygon.
        </div>
      </div>

      <MapView
        onMapClick={handleMapClick}
        markerPoint={markerPoint}
        amenityResults={amenityResponse?.results}
        parcelGeometry={parcelDetail?.parcel?.geometry}
        isochroneGeometry={isochroneResponse?.geometry}
      />
    </div>
  );
}
