const canvas = document.getElementById('hueCanvas');

const ctx = canvas.getContext('2d');
const size = canvas.width;
const center = size / 2;
const outerRadius = center - 3;
const ringWidth = 24;
const innerRadius = outerRadius - ringWidth;
const knobRadius = ringWidth / 2 + 1.5;

const inputStart = document.getElementById('hueStart');
const inputEnd = document.getElementById('hueEnd');

let hueStart = parseInt(inputStart.value, 10);
let hueEnd = parseInt(inputEnd.value, 10);
let dragging = null; // 'start' | 'end' | null

function drawHueRing() { 
  // Draw hue gradient ring pixel by pixel
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const r = Math.sqrt(dx*dx + dy*dy);
      if (r >= innerRadius - 1 && r <= outerRadius + 1) {
        let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
        if (angle < 0) angle += 360;
        const rgb = hslToRgb(angle/360, 1, 0.5);
        const idx = (y * size + x) * 4;
        data[idx] = rgb[0];
        data[idx+1] = rgb[1];
        data[idx+2] = rgb[2];
        data[idx+3] = 255;
      } else if (r < innerRadius) {
        const idx = (y * size + x) * 4;
        data[idx+3] = 0;
      } else {
        const idx = (y * size + x) * 4;
        data[idx+3] = 0;
      }
    }
  }
  ctx.putImageData(image, 0, 0);

  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, outerRadius + 2, 0, 2*Math.PI, false);
  ctx.strokeStyle = '#35363c'; 
  ctx.lineWidth = 4;

  ctx.stroke();
  ctx.restore();
  // inner arc
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, innerRadius - 2, 0, 2*Math.PI, false);
  ctx.strokeStyle = '#35363c';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s == 0) {
    r = g = b = l;
  } else {
    const hue2rgb = function(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
}

function drawRangeArc(start, end, width) {
  let a1 = (start - 90) * Math.PI / 180;
  let a2 = (end - 90) * Math.PI / 180;
  if (a2 < a1) a2 += Math.PI * 2;
  // Використовуємо колір зовнішнього контуру повзунка
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, outerRadius + 2, a1, a2, false);
  ctx.strokeStyle = '#292a2f'; 
  ctx.lineWidth = 4;
  ctx.shadowColor = '#21232c5c';
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.restore();
  // inner arc
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, innerRadius - 2, a1, a2, false);
  ctx.strokeStyle = '#292a2f';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#21232c5c';
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.restore();

        ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, outerRadius -7, a1, a2, false);
  ctx.strokeStyle = '#f8fcff'; 
  ctx.lineWidth = 3;

  ctx.stroke();
  ctx.restore();
  // inner arc
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, innerRadius + 7, a1, a2, false);
  ctx.strokeStyle = '#f8fcff';
  ctx.lineWidth = 3;

  ctx.stroke();
  ctx.restore();

}

function drawKnob(angle, highlight, isStart) {
  const rad = (angle - 90) * Math.PI / 180;
  const x = center + Math.cos(rad) * (innerRadius + ringWidth/2);
  const y = center + Math.sin(rad) * (innerRadius + ringWidth/2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, knobRadius, 0, 2 * Math.PI);
  ctx.lineWidth = 4;
  ctx.strokeStyle = highlight ? '#23242a' : '#292a2f';
  ctx.shadowColor = highlight ? '#21232c5c' : '#21232c5c';
  ctx.shadowBlur = highlight ? 6 : 0;
  ctx.stroke();
  // Малюємо півкруг, зрізаний паралельно до радіуса
  // Визначаємо напрямок радіуса
  let startAngle;
  let endAngle;
  if (isStart) {
    startAngle = rad + Math.PI - 0.1;
    endAngle = rad + 0.1;
  } else {
    startAngle = rad - 0.1; 
    endAngle = rad + Math.PI + 0.1;
  }

  ctx.beginPath();
  ctx.arc(x, y, knobRadius-8.5, startAngle, endAngle, false);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f8fcff';
  ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, size, size);
  drawHueRing();
  // Draw selected range
  let start = hueStart;
  let end = hueEnd;
  let diff = (end - start + 360) % 360;
  if (diff === 0 && hueStart !== hueEnd) diff = 360;
  if (diff > 360) diff = 0;
  if (diff > 0) {
    drawRangeArc(start, end, 4);
  }
  drawKnob(hueStart, dragging === 'start', true);
  drawKnob(hueEnd, dragging === 'end');
}

draw();

function getAngleFromPoint(x, y) {
  // x, y are in client coordinates, need to scale to canvas coordinates
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx = (x - rect.left) * scaleX;
  const cy = (y - rect.top) * scaleY;
  const dx = cx - center;
  const dy = cy - center;
  let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  if (angle < 0) angle += 360;
  return angle;
}

function knobHitTest(angle, mx, my) {
  // mx, my are in client coordinates, need to scale to canvas coordinates
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx = (mx - rect.left) * scaleX;
  const cy = (my - rect.top) * scaleY;
  const rad = (angle - 90) * Math.PI / 180;
  const x = center + Math.cos(rad) * (innerRadius + ringWidth/2);
  const y = center + Math.sin(rad) * (innerRadius + ringWidth/2);
  return Math.hypot(cx - x, cy - y) <= knobRadius + 4;
}

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX;
  const my = e.clientY;
  if (knobHitTest(hueStart, mx, my)) {
    dragging = 'start';
  } else if (knobHitTest(hueEnd, mx, my)) {
    dragging = 'end';
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const mx = e.clientX;
  const my = e.clientY;
  const angle = Math.round(getAngleFromPoint(mx, my)) % 360;
  if (dragging === 'start') {
    hueStart = angle;
    inputStart.value = hueStart;
  } else if (dragging === 'end') {
    hueEnd = angle;
    inputEnd.value = hueEnd;
  }
  draw();
});

window.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = null;
  window.submitActiveConvertForm && window.submitActiveConvertForm();
  draw();
});

inputStart.addEventListener('input', (e) => {
  hueStart = Math.max(0, Math.min(359, parseInt(e.target.value, 10) || 0));
  draw();
});
inputEnd.addEventListener('input', (e) => {
  hueEnd = Math.max(0, Math.min(359, parseInt(e.target.value, 10) || 0));
  draw();
});

// --- Автоматичне переведення при зміні hue-range-selector ---
['hueStart', 'hueEnd'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    // При знятті фокусу
    el.addEventListener('blur', () => {
      window.submitActiveConvertForm && window.submitActiveConvertForm();
    });
    // При натисканні Enter
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        window.submitActiveConvertForm && window.submitActiveConvertForm();
      }
    });
  }
});
const ignoreHueEl = document.getElementById('ignoreHue');
if (ignoreHueEl) {
  ignoreHueEl.addEventListener('input', () => {
    window.submitActiveConvertForm && window.submitActiveConvertForm();
  });
  ignoreHueEl.addEventListener('change', () => {
    window.submitActiveConvertForm && window.submitActiveConvertForm();
  });
}

const formHSB = document.getElementById('form-convert-HSB');
if (formHSB) {
  formHSB.addEventListener('reset', () => {

    inputStart.value = 30;
    inputEnd.value = 120;
    hueStart = 30;
    hueEnd = 120;
    draw();

    window.submitActiveConvertForm && window.submitActiveConvertForm();
  });
}