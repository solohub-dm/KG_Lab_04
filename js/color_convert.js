
function validateColor(color, space) {
  switch (space) {
    case 'RGB':
      return (
        Array.isArray(color) &&
        color.length === 3 &&
        color.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)
      );
    case 'CMYK':
      return (
        Array.isArray(color) &&
        color.length === 4 &&
        color.every((v) => typeof v === 'number' && v >= 0 && v <= 100)
      );
    case 'HSB':
      return (
        Array.isArray(color) &&
        color.length === 3 &&
        typeof color[0] === 'number' && color[0] >= 0 && color[0] <= 360 &&
        typeof color[1] === 'number' && color[1] >= 0 && color[1] <= 1 &&
        typeof color[2] === 'number' && color[2] >= 0 && color[2] <= 1
      );
    case 'XYZ':
      return (
        Array.isArray(color) &&
        color.length === 3 &&
        color.every((v) => typeof v === 'number' && v >= 0 && v <= 1)
      );
    case 'Lab':
      return (
        Array.isArray(color) &&
        color.length === 3 &&
        typeof color[0] === 'number' && color[0] >= 0 && color[0] <= 100 &&   
        typeof color[1] === 'number' && color[1] >= -200 && color[1] <= 200 &&
        typeof color[2] === 'number' && color[2] >= -200 && color[2] <= 200  
      );
    default:
      return false;
  }
}

function normalizeArr(arr) {
  return arr.map(x => x / 255);
}

// ---------------------------
// RGB <-> CMYK
// ---------------------------
const mod = document.getElementById('mod');
// RGB -> CMYK
function RGBtoCMYK([r, g, b], muls = [1,1,1,1]) {
  let [R, G, B] = normalizeArr([r, g, b]);

  let K = 0;
  if (!mod.checked)
    K = 1 - Math.max(R, G, B);
  else 
    K = 1 - (0.3 * R + 0.59 * G + 0.11 * B);

  let C = 0, M = 0, Y = 0;

  if (K < 1 ) {
    C = (1 - R - K) / (1 - K);
    M = (1 - G - K) / (1 - K);
    Y = (1 - B - K) / (1 - K);
  }

  C = Math.round(C * 100 * muls[0]);
  M = Math.round(M * 100 * muls[1]);
  Y = Math.round(Y * 100 * muls[2]);
  K = Math.round(K * 100 * muls[3]);

  C = Math.max(0, Math.min(100, C));
  M = Math.max(0, Math.min(100, M));
  Y = Math.max(0, Math.min(100, Y));
  K = Math.max(0, Math.min(100, K));

  return [C, M, Y, K];
}

// CMYK -> RGB
function CMYKtoRGB([C, M, Y, K], muls = [1,1,1]) {
  C = C / 100; M = M / 100; Y = Y / 100; K = K / 100;
  let R = 255 * (1 - C) * (1 - K);
  let G = 255 * (1 - M) * (1 - K);
  let B = 255 * (1 - Y) * (1 - K);

  R = Math.round(R * (muls[0]));
  G = Math.round(G * (muls[1]));
  B = Math.round(B * (muls[2]));

  R = Math.max(0, Math.min(255, R));
  G = Math.max(0, Math.min(255, G));
  B = Math.max(0, Math.min(255, B));

  return [R, G, B];
}

// ---------------------------
// RGB <-> HSB
// ---------------------------

// RGB -> HSB
function RGBtoHSB([r, g, b], muls = [1,1,1], opts = {}) {
  let [R, G, B] = normalizeArr([r, g, b]);
  let max = Math.max(R, G, B), min = Math.min(R, G, B);
  let delta = max - min;
  let H = 0, S = 0, V = max;

  if (delta !== 0) {
    if      (max === R) H = ((G - B) / delta) % 6;
    else if (max === G) H = (B - R) / delta + 2;
    else H = (R - G) / delta + 4;
    
    H *= 60;
    if (H < 0) H += 360;
  }

  S = max === 0 ? 0 : delta / max;

  let applyMul = true;
  if (opts && opts.useH) {
    let hStart = Number(opts.hueStart) || 0;
    let hEnd = Number(opts.hueEnd) || 0;
    if (hStart <= hEnd) {
      applyMul = (H >= hStart && H <= hEnd);
    } else {
      applyMul = (H >= hStart || H <= hEnd);
    }
  }
  if (!opts || !opts.useH) {
    applyMul = true;
  }
  H = H * (muls[0]);
  if (applyMul) {
    S = S * (muls[1]);
    V = V * (muls[2]);
  }
  
  H = Math.max(0, Math.min(360, Math.round(H)));
  S = Math.max(0, Math.min(1, S));
  V = Math.max(0, Math.min(1, V));
  return [H, S, V];
}

// HSB -> RGB
function HSBtoRGB([H, S, V], muls = [1,1,1]) {
  let C = V * S;
  let X = C * (1 - Math.abs((H / 60) % 2 - 1));
  let m = V - C;
  let r = 0, g = 0, b = 0;

  if (H < 60) [r, g, b] = [C, X, 0];
  else if (H < 120) [r, g, b] = [X, C, 0];
  else if (H < 180) [r, g, b] = [0, C, X];
  else if (H < 240) [r, g, b] = [0, X, C];
  else if (H < 300) [r, g, b] = [X, 0, C];
  else [r, g, b] = [C, 0, X];

  let R = Math.round((r + m) * 255);
  let G = Math.round((g + m) * 255);
  let B = Math.round((b + m) * 255);

  R = Math.round(R * (muls[0]));
  G = Math.round(G * (muls[1]));
  B = Math.round(B * (muls[2]));

  R = Math.max(0, Math.min(255, R));
  G = Math.max(0, Math.min(255, G));
  B = Math.max(0, Math.min(255, B));
  return [R, G, B];
}

// ---------------------------
// RGB <-> XYZ
// ---------------------------

// RGB -> XYZ
function RGBtoXYZ([R, G, B], muls = [1,1,1]) {
  [R, G, B] = normalizeArr([R, G, B]).map(c =>
    c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92
  );
  R *= 100; G *= 100; B *= 100;
  let X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  let Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let Z = R * 0.0193 + G * 0.1192 + B * 0.9505;

  X = (X / 95.047) * muls[0];
  Y = (Y / 100.0) * muls[1];
  Z = (Z / 108.883) * muls[2];

  X = Math.max(0, Math.min(1, X));
  Y = Math.max(0, Math.min(1, Y));
  Z = Math.max(0, Math.min(1, Z));

  return [X, Y, Z];
}

// XYZ -> RGB
function XYZtoRGB([X, Y, Z], muls = [1,1,1]) {
  X = X * 95.047;
  Y = Y * 100.0;
  Z = Z * 108.883;
  X /= 100; Y /= 100; Z /= 100;
  let R = X * 3.2406 + Y * -1.5372 + Z * -0.4986;
  let G = X * -0.9689 + Y * 1.8758 + Z * 0.0415;
  let B = X * 0.0557 + Y * -0.2040 + Z * 1.0570;
  [R, G, B] = [R, G, B].map(c =>
    c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c
  );

  R = Math.round(R * 255);
  G = Math.round(G * 255);
  B = Math.round(B * 255);
  
  R = Math.round(R * (muls[0]));
  G = Math.round(G * (muls[1]));
  B = Math.round(B * (muls[2]));

  R = Math.round(Math.max(0, Math.min(255, R)));
  G = Math.round(Math.max(0, Math.min(255, G)));
  B = Math.round(Math.max(0, Math.min(255, B)));

  return [R, G, B];
}

// ---------------------------
// XYZ <-> Lab
// ---------------------------

// XYZ -> Lab
function XYZtoLab([X, Y, Z], muls = [1,1,1]) {
  X = X * 95.047;
  Y = Y * 100.0;
  Z = Z * 108.883;
  let [Xr, Yr, Zr] = [95.047, 100.0, 108.883];
  let fx = X / Xr, fy = Y / Yr, fz = Z / Zr;
  [fx, fy, fz] = [fx, fy, fz].map(t =>
    t > 0.008856 ? Math.pow(t, 1 / 3) : (7.787 * t) + 16 / 116
  );
  let L = (116 * fy) - 16;
  let a = 500 * (fx - fy);
  let b = 200 * (fy - fz);

  L = L * (muls[0]);
  a = a * (muls[1]);
  b = b * (muls[2]);

  L = Math.max(0, Math.min(100, L));
  a = Math.max(-200, Math.min(200, a));
  b = Math.max(-200, Math.min(200, b));
  return [L, a, b];
}

// Lab -> XYZ
function LabtoXYZ([L, a, b], muls = [1,1,1]) {
  let Y = (L + 16) / 116;
  let X = a / 500 + Y;
  let Z = Y - b / 200;
  [X, Y, Z] = [X, Y, Z].map(t => {
    let t3 = Math.pow(t, 3);
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  });

  let xNorm = X * 95.047 / 95.047;
  let yNorm = Y * 100.0 / 100.0;
  let zNorm = Z * 108.883 / 108.883;

  xNorm = xNorm * (muls[0]);
  yNorm = yNorm * (muls[1]);
  zNorm = zNorm * (muls[2]);

  xNorm = Math.max(0, Math.min(1, xNorm));
  yNorm = Math.max(0, Math.min(1, yNorm));
  zNorm = Math.max(0, Math.min(1, zNorm));

  return [xNorm, yNorm, zNorm];
}

// ---------------------------
// Роутер кольорів
// ---------------------------
function colorRouterMul(from, to, value, muls, opts) {
  if (from === to) {
    if (muls && Array.isArray(muls)) {
      return value.map((v, i) => v * (muls[i]));
    }
    return value;
  }
  if (!validateColor(value, from)) {
    console.error('Invalid input color for space', from, to, value, muls, opts);
    console.error('Array.isArray(color)', value);
    throw new Error(`Invalid input color for space ${from}`);
  }

  const convert = {
    RGB: { 
      CMYK: RGBtoCMYK, 
      HSB: (v, m) => RGBtoHSB(v, m, opts),
      XYZ: RGBtoXYZ
    },
    CMYK: { 
      RGB: CMYKtoRGB 
    },
    HSB: { 
      RGB: HSBtoRGB 
    },
    XYZ: { 
      Lab: XYZtoLab,
      RGB: XYZtoRGB
    },
    Lab: { 
      XYZ: LabtoXYZ 
    }
  };

  if (!colorRouterMul.paths) {
    colorRouterMul.paths = { ...paths };
  }
  const localPaths = colorRouterMul.paths;

  const pathKey = `${from}→${to}`;
  let path = localPaths[pathKey];

  if (!path) {
    const queue = [[from]];
    const visited = new Set();
    while (queue.length) {
      const currentPath = queue.shift();
      const last = currentPath[currentPath.length - 1];
      if (last === to) {
        path = currentPath;
        break;
      }
      visited.add(last);
      const neighbors = Object.keys(convert[last] || {});
      for (const n of neighbors) {
        if (!visited.has(n)) {
          queue.push([...currentPath, n]);
        }
      }
    }
    if (!path) throw new Error(`No conversion path from ${from} to ${to}`);
    localPaths[pathKey] = path;
  }

  let result = value;
  for (let i = 0; i < path.length - 1; i++) {
    const func = convert[path[i]]?.[path[i + 1]];
    if (!func) throw new Error(`Missing converter: ${path[i]} → ${path[i + 1]}`);

    if (i === path.length - 2 && muls && Array.isArray(muls)) {
      result = func(result, muls);
    } else {
      result = func(result);
    }

    if (!validateColor(result, path[i+1])) {
      console.error('Invalid color after', path[i], '→', path[i+1], result);
      throw new Error(`Invalid intermediate color for space ${path[i+1]}`);
    }
  }
  return result;
}


const paths = {
  // // Lab ->
  // 'Lab→RGB': ['Lab', 'XYZ', 'RGB'],
  // 'Lab→CMYK': ['Lab', 'XYZ', 'RGB', 'CMYK'],
  // 'Lab→HSB': ['Lab', 'XYZ', 'RGB', 'HSB'],
  // 'Lab→XYZ': ['Lab', 'XYZ'],

  // // CMYK ->
  // 'CMYK→Lab': ['CMYK', 'RGB', 'XYZ', 'Lab'],
  // 'CMYK→HSB': ['CMYK', 'RGB', 'HSB'],
  // 'CMYK→XYZ': ['CMYK', 'RGB', 'XYZ'],
  // 'CMYK→RGB': ['CMYK', 'RGB'],

  // // HSB ->
  // 'HSB→Lab': ['HSB', 'RGB', 'XYZ', 'Lab'],
  // 'HSB→CMYK': ['HSB', 'RGB', 'CMYK'],
  // 'HSB→XYZ': ['HSB', 'RGB', 'XYZ'],
  // 'HSB→RGB': ['HSB', 'RGB'],

  // // RGB ->
  // 'RGB→Lab': ['RGB', 'XYZ', 'Lab'],
  // 'RGB→CMYK': ['RGB', 'CMYK'],
  // 'RGB→HSB': ['RGB', 'HSB'],
  // 'RGB→XYZ': ['RGB', 'XYZ'],

  // // XYZ ->
  // 'XYZ→Lab': ['XYZ', 'Lab'],
  // 'XYZ→CMYK': ['XYZ', 'RGB', 'CMYK'],
  // 'XYZ→HSB': ['XYZ', 'RGB', 'HSB'],
  // 'XYZ→RGB': ['XYZ', 'RGB']
};
