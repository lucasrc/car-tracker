const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = (1 - WGS84_F) * WGS84_A;
const EPSILON = 1e-12;

export function vincentyDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const lambda1 = (lon1 * Math.PI) / 180;
  const lambda2 = (lon2 * Math.PI) / 180;

  const L = lambda2 - lambda1;
  const U1 = Math.atan((1 - WGS84_F) * Math.tan(phi1));
  const U2 = Math.atan((1 - WGS84_F) * Math.tan(phi2));

  let lambda = L;
  let sinSigma: number;
  let cosSigma: number;
  let sigma: number;
  let sinAlpha: number;
  let cos2Alpha: number;
  let cos2SigmaM: number;

  let iteration = 0;
  do {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);

    sinSigma = Math.sqrt(
      Math.pow(Math.cos(U2) * sinLambda, 2) +
        Math.pow(
          Math.cos(U1) * Math.sin(U2) - Math.sin(U1) * Math.cos(U2) * cosLambda,
          2,
        ),
    );

    if (sinSigma === 0) return 0;

    cosSigma =
      Math.sin(U1) * Math.sin(U2) + Math.cos(U1) * Math.cos(U2) * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);

    sinAlpha = (Math.cos(U1) * Math.cos(U2) * sinLambda) / sinSigma;
    cos2Alpha = 1 - sinAlpha * sinAlpha;

    cos2SigmaM =
      cos2Alpha !== 0
        ? cosSigma - (2 * Math.sin(U1) * Math.sin(U2)) / cos2Alpha
        : 0;

    const C = (WGS84_F / 16) * cos2Alpha * (4 + WGS84_F * (4 - 3 * cos2Alpha));

    lambda =
      L +
      (1 - C) *
        WGS84_F *
        sinAlpha *
        (sigma +
          C *
            sinSigma *
            (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));

    iteration++;
  } while (Math.abs(lambda - L) > EPSILON && iteration < 200);

  if (iteration >= 200) {
    return haversineDistance(lat1, lon1, lat2, lon2);
  }

  const u2 =
    ((WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B)) * cos2Alpha;
  const A = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));

  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          (B / 6) *
            cos2SigmaM *
            (-3 + 4 * sinSigma * sinSigma) *
            (-3 + 4 * cos2SigmaM * cos2SigmaM)));

  return WGS84_B * A * (sigma - deltaSigma);
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function calculateTotalDistance(
  coordinates: { lat: number; lng: number; accuracy?: number }[],
): number {
  if (coordinates.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];

    if (prev.accuracy !== undefined && prev.accuracy > 30) continue;
    if (curr.accuracy !== undefined && curr.accuracy > 30) continue;

    total += vincentyDistance(prev.lat, prev.lng, curr.lat, curr.lng);
  }

  return total;
}
