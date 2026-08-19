const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

export const api = {
  nearest: ({ lat, lon, type, radiusM = 5000, limit = 10 }) => {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      radius_m: String(radiusM),
      limit: String(limit),
    });
    if (type) params.set("type", type);
    return request(`/api/nearest?${params.toString()}`);
  },

  amenityTypes: () => request("/api/nearest/types"),

  parcelsInViewport: (bbox) => {
    const params = new URLSearchParams({
      min_lon: String(bbox.minLon),
      min_lat: String(bbox.minLat),
      max_lon: String(bbox.maxLon),
      max_lat: String(bbox.maxLat),
    });
    return request(`/api/parcels?${params.toString()}`);
  },

  parcelDetail: (id) => request(`/api/parcels/${id}`),

  isochrone: ({ lat, lon, minutes, profile }) =>
    request(`/api/isochrone`, {
      method: "POST",
      body: JSON.stringify({ lat, lon, minutes, profile }),
    }),
};
