import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { api } from "../api.js";

const DEMO_CENTER = [-79.3762, 43.6552]; // downtown Toronto / Riverdale, matching the seed data extent

const EMPTY_FC = { type: "FeatureCollection", features: [] };

// Free vector basemap style, no API key required.
const STYLE_URL = "https://demotiles.maplibre.org/style.json";

// Zoning code -> color, shared with the legend component below.
// Codes follow Toronto's actual Zoning By-law 569-2013 categories.
export const ZONING_COLORS = {
  R: "#6fa8dc",   // residential
  RM: "#3d78c9",  // residential multiple
  CR: "#e0a72f",  // commercial residential
  CL: "#c97a2f",  // commercial local
  E: "#a35b8c",   // employment industrial
  I: "#4c8c6f",   // institutional
  O: "#4caf7d",   // open space
};

export default function MapView({
  onMapClick,
  markerPoint,
  amenityResults,
  parcelGeometry,
  isochroneGeometry,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const clickMarkerRef = useRef(null);
  const debounceRef = useRef(null);

  // Initialize map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: STYLE_URL,
      center: DEMO_CENTER,
      zoom: 14.5,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      // Base layer: every parcel in the current viewport, colored by zoning
      // code. This is what makes the map legible before you've clicked
      // anything, and demonstrates the bbox (&&) query independently of
      // the click-driven detail lookup.
      map.addSource("zoning-parcels", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "zoning-fill",
        type: "fill",
        source: "zoning-parcels",
        paint: {
          "fill-color": [
            "match",
            ["get", "zoning_code"],
            "R", ZONING_COLORS.R,
            "RM", ZONING_COLORS.RM,
            "CR", ZONING_COLORS.CR,
            "CL", ZONING_COLORS.CL,
            "E", ZONING_COLORS.E,
            "I", ZONING_COLORS.I,
            "O", ZONING_COLORS.O,
            "#888888",
          ],
          "fill-opacity": 0.45,
        },
      });
      map.addLayer({
        id: "zoning-line",
        type: "line",
        source: "zoning-parcels",
        paint: { "line-color": "#0b0f14", "line-width": 0.5, "line-opacity": 0.5 },
      });

      map.addSource("isochrone", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "isochrone-fill",
        type: "fill",
        source: "isochrone",
        paint: { "fill-color": "#2f6feb", "fill-opacity": 0.15 },
      });
      map.addLayer({
        id: "isochrone-line",
        type: "line",
        source: "isochrone",
        paint: { "line-color": "#2f6feb", "line-width": 2 },
      });

      map.addSource("parcel", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "parcel-fill",
        type: "fill",
        source: "parcel",
        paint: { "fill-color": "#e0a72f", "fill-opacity": 0.35 },
      });
      map.addLayer({
        id: "parcel-line",
        type: "line",
        source: "parcel",
        paint: { "line-color": "#e0a72f", "line-width": 2 },
      });

      map.addSource("amenities", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "amenities-points",
        type: "circle",
        source: "amenities",
        paint: {
          "circle-radius": 6,
          "circle-color": "#38c172",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#0b1a10",
        },
      });
    });

    map.on("click", (e) => {
      onMapClick({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    const loadZoningForViewport = () => {
      const b = map.getBounds();
      api
        .parcelsInViewport({
          minLon: b.getWest(),
          minLat: b.getSouth(),
          maxLon: b.getEast(),
          maxLat: b.getNorth(),
        })
        .then((parcels) => {
          if (!map.getSource("zoning-parcels")) return;
          const fc = {
            type: "FeatureCollection",
            features: parcels.map((p) => ({
              type: "Feature",
              properties: { zoning_code: p.zoning_code, apn: p.apn },
              geometry: p.geometry,
            })),
          };
          map.getSource("zoning-parcels").setData(fc);
        })
        .catch(() => {
          /* DB not seeded yet, or API unreachable — leave the base layer empty */
        });
    };

    map.on("load", loadZoningForViewport);
    map.on("moveend", () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(loadZoningForViewport, 250);
    });

    return () => {
      clearTimeout(debounceRef.current);
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (clickMarkerRef.current) clickMarkerRef.current.remove();
    if (markerPoint) {
      clickMarkerRef.current = new maplibregl.Marker({ color: "#ff5c5c" })
        .setLngLat([markerPoint.lon, markerPoint.lat])
        .addTo(map);
    }
  }, [markerPoint]);

  // Amenity results layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("amenities")) return;
    const fc = {
      type: "FeatureCollection",
      features: (amenityResults || []).map((a) => ({
        type: "Feature",
        properties: { name: a.name, amenity_type: a.amenity_type, distance_m: a.distance_m },
        geometry: { type: "Point", coordinates: [a.lon, a.lat] },
      })),
    };
    map.getSource("amenities").setData(fc);
  }, [amenityResults]);

  // Parcel highlight layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("parcel")) return;
    const fc = parcelGeometry
      ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: parcelGeometry }] }
      : EMPTY_FC;
    map.getSource("parcel").setData(fc);
  }, [parcelGeometry]);

  // Isochrone layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("isochrone")) return;
    const fc = isochroneGeometry
      ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: isochroneGeometry }] }
      : EMPTY_FC;
    map.getSource("isochrone").setData(fc);
  }, [isochroneGeometry]);

  return (
    <div className="map-container">
      <div ref={mapContainerRef} />
      <ZoningLegend />
    </div>
  );
}

const ZONING_LABELS = {
  R: "Residential",
  RM: "Residential Multiple",
  CR: "Commercial Residential",
  CL: "Commercial Local",
  E: "Employment Industrial",
  I: "Institutional",
  O: "Open Space",
};

function ZoningLegend() {
  return (
    <div className="legend">
      <div className="legend-title">Zoning</div>
      {Object.entries(ZONING_COLORS).map(([code, color]) => (
        <div className="legend-row" key={code}>
          <span className="legend-swatch" style={{ background: color }} />
          <span>
            {code} — {ZONING_LABELS[code]}
          </span>
        </div>
      ))}
    </div>
  );
}
