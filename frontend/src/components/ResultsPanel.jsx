export default function ResultsPanel({ mode, amenityResponse, parcelDetail, isochroneResponse }) {
  if (mode === "nearest" && amenityResponse) {
    return (
      <div>
        <div className="control-group">
          <label>{amenityResponse.count} results near clicked point</label>
        </div>
        {amenityResponse.results.map((r) => (
          <div className="result-card" key={r.id}>
            <div className="name">{r.name}</div>
            <div className="meta">
              {r.amenity_type} · {Math.round(r.distance_m)} m away
            </div>
          </div>
        ))}
        {amenityResponse.count === 0 && (
          <div className="hint">No amenities found in range. Try increasing the radius.</div>
        )}
      </div>
    );
  }

  if (mode === "parcel" && parcelDetail) {
    const p = parcelDetail.parcel;
    return (
      <div>
        <div className="result-card">
          <div className="name">Parcel {p.apn}</div>
          <div className="meta">
            Zoning {p.zoning_code} — {p.zoning_desc}
          </div>
          <div className="meta">Land use: {p.land_use}</div>
          <div className="meta">Area: {Math.round(p.area_sqm)} m²</div>
          {parcelDetail.neighbourhood && (
            <div className="meta">Neighbourhood: {parcelDetail.neighbourhood}</div>
          )}
          <div className="meta" style={{ color: parcelDetail.in_flood_zone ? "#e0554f" : "#38c172" }}>
            {parcelDetail.in_flood_zone
              ? `⚠ In flood zone (${parcelDetail.flood_zone_types.join(", ")})`
              : "✓ Outside mapped flood zones"}
          </div>
        </div>
        <div className="control-group">
          <label>Nearby amenities (400m)</label>
        </div>
        {parcelDetail.nearby_amenities.map((r) => (
          <div className="result-card" key={r.id}>
            <div className="name">{r.name}</div>
            <div className="meta">
              {r.amenity_type} · {Math.round(r.distance_m)} m away
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (mode === "isochrone" && isochroneResponse) {
    return (
      <div>
        <div className="result-card">
          <div className="name">
            {isochroneResponse.minutes}-minute {isochroneResponse.profile} isochrone
          </div>
          <div className="meta">source: {isochroneResponse.source}</div>
        </div>
        {isochroneResponse.note && <div className="note">{isochroneResponse.note}</div>}
      </div>
    );
  }

  return <div className="hint">Click anywhere on the map to run a query.</div>;
}
