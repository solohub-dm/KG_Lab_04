const placeholder = document.getElementById('canvas-placeholder');
const fileInput = document.getElementById('file-input');

const wrapperCanvas = document.getElementById('wrapper-canvas');

const canvasInitial = document.getElementById('canvas-initial');
const canvasInitialOverlay = document.getElementById('canvas-initial-overlay');
const wrapperInitial = canvasInitial.parentElement;
console.log('wrapperInitial', wrapperInitial);

const canvasFinal = document.getElementById('canvas-final');
const canvasFinalOverlay = document.getElementById('canvas-final-overlay');
const wrapperFinal = canvasFinal.parentElement;

const convertButtons = document.querySelectorAll('.color-space-btn');
window.convertButtons = convertButtons;
const infoText = document.getElementById('text-convert-item-body-info');

function setInitialState() {
  wrapperInitial.style.display = 'none';
  wrapperFinal.style.display = 'none';
  placeholder.style.display = 'flex';
  convertButtons.forEach(btn => btn.disabled = true);
  infoText.textContent = 'Open file to convert';
}
setInitialState();

let loadedImage = null;
let loadedImageNaturalWidth = 0;
let loadedImageNaturalHeight = 0;

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = function(ev) {
    const img = new Image();
    img.onload = function() {
      loadedImage = img;
      loadedImageNaturalWidth = img.width;
      loadedImageNaturalHeight = img.height;

      showInitialCanvas();
      infoText.textContent = 'Choose system to convert';
      convertButtons.forEach(btn => btn.disabled = false);

      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = img.width;
      tmpCanvas.height = img.height;

      const tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.drawImage(img, 0, 0, img.width, img.height);

      const imgData = tmpCtx.getImageData(0, 0, img.width, img.height);
      const rgbMatrix = imageDataToMatrix(imgData);

      setCurrentMatrixObj({ matrix: rgbMatrix, colorSpace: 'RGB' });
      setOriginalMatrixObj({ matrix: rgbMatrix, colorSpace: 'RGB' });
      undoStack = [{ matrix: cloneMatrix(rgbMatrix), colorSpace: 'RGB' }];
      redoStack = [];

      updateTitleOperation('loaded', getCurrentColorSpace());
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  panelColor.style.display = '';
}

placeholder.addEventListener('click', () => fileInput.click());

placeholder.addEventListener('dragover', e => {
  e.preventDefault();
  placeholder.style.background = 'var(--gray-panel)';
});
placeholder.addEventListener('dragleave', e => {
  e.preventDefault();
  placeholder.style.background = 'var(--gray-panel-light)';
});
placeholder.addEventListener('drop', e => {
  e.preventDefault();
  placeholder.style.background = 'var(--gray-panel-light)';
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', e => {
  if (e.target.files && e.target.files[0]) {
    handleFile(e.target.files[0]);
  }
});

let originalRgbMatrix = null;

function syncOverlayVisibility() {

  syncOverlaySize(canvasInitial, canvasInitialOverlay);
  syncOverlaySize(canvasFinal, canvasFinalOverlay);
  
  if (selection) {
    syncDrawSelection();
  }
}

function syncOverlaySize(mainCanvas, overlayCanvas) {
  overlayCanvas.width = mainCanvas.width;
  overlayCanvas.height = mainCanvas.height;
  
  overlayCanvas.style.width = mainCanvas.style.width;
  overlayCanvas.style.height = mainCanvas.style.height;
}

function clearOverlay(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawSelectionOverlay(ctx, selection) {

  clearOverlay(ctx);
  if (!selection) return;
  
  ctx.save();
  ctx.globalAlpha = 0.3; 
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
  ctx.restore();
  
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#ffe600';
  ctx.lineWidth = 2;
  ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);
  
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(selection.x + 1, selection.y + 1, selection.w - 2, selection.h - 2);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#ffe600';
  const handles = [
    [selection.x, selection.y], 
    [selection.x + selection.w, selection.y], 
    [selection.x, selection.y + selection.h], 
    [selection.x + selection.w, selection.y + selection.h],
  ];
 
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  handles.forEach(([hx, hy]) => ctx.fillRect(hx - 4, hy - 4, 8, 8));

  ctx.fillStyle = '#ffe600';
  handles.forEach(([hx, hy]) => ctx.fillRect(hx - 3, hy - 3, 6, 6));
  ctx.restore();
}

function syncDrawSelection() {
  [
    {main: canvasInitial, overlay: canvasInitialOverlay},
    {main: canvasFinal, overlay: canvasFinalOverlay}
  ].forEach(({main, overlay}) => {
    if (getComputedStyle(main).display !== 'none') {
      syncOverlaySize(main, overlay);
      const ctx = overlay.getContext('2d');
      drawSelectionOverlay(ctx, selection);
    } else {
      clearOverlay(overlay.getContext('2d'));
    }
  });
}

function clearSelection() {
  const hadSelection = !!selection;
  selection = null;
  syncDrawSelection && syncDrawSelection();
  if (hadSelection) 
    window.submitActiveConvertForm();
}
window.clearSelection = clearSelection;

function showInitialCanvas() {
  placeholder.style.display = 'none';
  wrapperInitial.style.display = 'flex';
  wrapperFinal.style.display = 'none';
  
  const initialContainer = canvasInitial.parentElement;
  initialContainer.style.maxWidth = 'none';
  initialContainer.style.flex = '0 0 auto'; 
  initialContainer.style.margin = '0 auto'; 
  
  syncOverlayVisibility();
  fitAndDrawCanvases();
  if (loadedImage) syncDrawSelection();
}

function showBothCanvases() {
  placeholder.style.display = 'none';
  wrapperInitial.style.display = 'flex';
  wrapperFinal.style.display = 'flex';
  
  wrapperInitial.style.maxWidth = 'calc(50%)';
  wrapperFinal.style.maxWidth = 'calc(50%)';
  wrapperInitial.style.flex = '';
  wrapperFinal.style.flex = '';
  wrapperInitial.style.margin = '0';
  wrapperFinal.style.margin = '0';
  syncOverlayVisibility();

  const activeFormDiv = Array.from(document.querySelectorAll('.wrapper-convert-item-body'))
    .find(div => getComputedStyle(div).display === 'flex');
  if (activeFormDiv) {
    const form = activeFormDiv.querySelector('form');
    if (form) form.dispatchEvent(new Event('submit', {cancelable:true}));
  }

  fitAndDrawCanvases();
  if (loadedImage) syncDrawSelection();
}

convertButtons.forEach(btn => {
  btn.addEventListener('click', function() {
    showBothCanvases();
  });
});

function getFittedSize(imgWidth, imgHeight, maxWidth, maxHeight) {
  const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1);
  
  return {
    width: Math.floor(imgWidth * ratio),
    height: Math.floor(imgHeight * ratio)
  };
}

function fitAndDrawCanvases() {
  if (!loadedImage) return;
  const style = getComputedStyle(wrapperCanvas);
  const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

  const canvasRect = wrapperCanvas.getBoundingClientRect();
  const gap = 32;
  const canvasesCount = wrapperFinal.style.display === 'flex' ? 2 : 1;
  
  const maxW = Math.floor((canvasRect.width - paddingX - (canvasesCount - 1) * gap) / canvasesCount);
  const maxH = Math.floor(canvasRect.height - paddingY - 8);
  const size = getFittedSize(loadedImageNaturalWidth, loadedImageNaturalHeight, maxW, maxH);
  
  if (canvasesCount === 1) {
    wrapperInitial.style.maxWidth = 'none';
    wrapperInitial.style.flex = '0 0 auto';
  } else {
    wrapperInitial.style.maxWidth = 'calc(50%)';
    wrapperFinal.style.maxWidth = 'calc(50%)';
  }

  canvasInitial.width = size.width;
  canvasInitial.height = size.height;  
  wrapperInitial.style.width = size.width + 'px';
  wrapperInitial.style.height = size.height + 'px';
  wrapperInitial.style.margin = canvasesCount === 1 ? '0 auto' : '0';

  canvasInitial.style.width = size.width + 'px';
  canvasInitial.style.height = size.height + 'px';
  const ctx1 = canvasInitial.getContext('2d');
  ctx1.clearRect(0, 0, size.width, size.height);
  if (window.currentColorMatrix) {
    const imgData = window.matrixToImageData(window.currentColorMatrix);
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = imgData.width;
    tmpCanvas.height = imgData.height;
    tmpCanvas.getContext('2d').putImageData(imgData, 0, 0);
    ctx1.drawImage(tmpCanvas, 0, 0, size.width, size.height);  } else {
    ctx1.drawImage(loadedImage, 0, 0, size.width, size.height);
  }

  if (wrapperFinal.style.display === 'flex') {    
    canvasFinal.width = size.width;
    canvasFinal.height = size.height;    
    wrapperFinal.style.width = size.width + 'px';
    wrapperFinal.style.height = size.height + 'px';
    wrapperFinal.style.margin = '0'; 

    canvasFinal.style.width = size.width + 'px';
    canvasFinal.style.height = size.height + 'px';
    const ctx2 = canvasFinal.getContext('2d');
    ctx2.clearRect(0, 0, canvasFinal.width, canvasFinal.height);
    if (window.previewMatrix && typeof window.matrixToImageData === 'function') {
      const imgDataF = window.matrixToImageData(window.previewMatrix);
      const tmpCanvasF = document.createElement('canvas');
      tmpCanvasF.width = imgDataF.width;
      tmpCanvasF.height = imgDataF.height;
      tmpCanvasF.getContext('2d').putImageData(imgDataF, 0, 0);
      ctx2.drawImage(tmpCanvasF, 0, 0, canvasFinal.width, canvasFinal.height);
    } else {
      ctx2.drawImage(loadedImage, 0, 0, canvasFinal.width, canvasFinal.height);
    }
  }

  syncOverlayVisibility();
}

window.addEventListener('resize', function() {
  fitAndDrawCanvases();
  syncOverlayVisibility();
});

let selection = null;
let dragMode = null; 
let dragOffset = {x:0, y:0};
let resizeEdge = null;
let isMouseDown = false;
let mouseDownPos = null;
const SELECTION_MIN_SIZE = 10;
const DRAG_THRESHOLD = 4; 

function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.round((evt.clientX - rect.left) * (canvas.width / rect.width)),
    y: Math.round((evt.clientY - rect.top) * (canvas.height / rect.height))
  };
}

function getResizeEdge(sel, pos, tol=6) {
  const {x, y, w, h} = sel;
  let edge = '';

  if (Math.abs(pos.y - y) < tol && pos.x >= x - tol && pos.x <= x + w + tol) edge += 'n';
  else if (Math.abs(pos.y - (y + h)) < tol && pos.x >= x - tol && pos.x <= x + w + tol) edge += 's';
  if (Math.abs(pos.x - x) < tol && pos.y >= y - tol && pos.y <= y + h + tol) edge += 'w';
  else if (Math.abs(pos.x - (x + w)) < tol && pos.y >= y - tol && pos.y <= y + h + tol) edge += 'e';

  return edge || (
    (pos.x > x && pos.x < x + w && pos.y > y && pos.y < y + h) ? 'move' : null
  );
}

[canvasInitialOverlay, canvasFinalOverlay].forEach(canvas => {
  canvas.addEventListener('mousedown', function(e) {
    if (!selectionEnabled) return;
    if (!loadedImage) return;
    const pos = getMousePos(canvas, e);
    mouseDownPos = pos;
    isMouseDown = true;

    if (selection) {
      const edge = getResizeEdge(selection, pos);
      if (edge && edge !== 'move') {
        dragMode = 'resize';
        resizeEdge = edge;
        dragOffset = {x: pos.x, y: pos.y};
        return;
      } else if (edge === 'move') {
        dragMode = 'move';
        dragOffset = {x: pos.x - selection.x, y: pos.y - selection.y};
        return;
      }
    }
    dragMode = null;
  });

  canvas.addEventListener('mousemove', function(e) {
    if (!selectionEnabled) return;
    if (!loadedImage) return;
    const pos = getMousePos(canvas, e);
    let cursor = 'default';
    if (selection) {
      const edge = getResizeEdge(selection, pos);
      if (edge && edge !== 'move') {
        const map = {n:'ns-resize', s:'ns-resize', e:'ew-resize', w:'ew-resize',
          ne:'nesw-resize', nw:'nwse-resize', se:'nwse-resize', sw:'nesw-resize'};
        cursor = map[edge] || 'pointer';
      } else if (edge === 'move') {
        cursor = 'move';
      }
    }
    canvas.style.cursor = cursor;

    if (!isMouseDown) return;
    if (!dragMode && mouseDownPos) {
      const dx = pos.x - mouseDownPos.x;
      const dy = pos.y - mouseDownPos.y;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        selection = {x: mouseDownPos.x, y: mouseDownPos.y, w: 0, h: 0};
        dragMode = 'new';
        dragOffset = {x: mouseDownPos.x, y: mouseDownPos.y};
      } else {
        return; 
      }
    }

    if (dragMode === 'new') {
      let x1 = mouseDownPos.x;
      let y1 = mouseDownPos.y;
      let x2 = pos.x;
      let y2 = pos.y;

      let x = Math.max(0, Math.min(x1, x2));
      let y = Math.max(0, Math.min(y1, y2));
      let w = Math.abs(x2 - x1);
      let h = Math.abs(y2 - y1);

      w = Math.min(w, canvas.width - x);
      h = Math.min(h, canvas.height - y);
      w = Math.max(SELECTION_MIN_SIZE, w);
      h = Math.max(SELECTION_MIN_SIZE, h);
      selection.x = x;
      selection.y = y;
      selection.w = w;
      selection.h = h;
      if (window.submitActiveConvertForm) window.submitActiveConvertForm();
    } else if (dragMode === 'move') {
      let nx = pos.x - dragOffset.x;
      let ny = pos.y - dragOffset.y;
      nx = Math.max(0, Math.min(nx, canvas.width - selection.w));
      ny = Math.max(0, Math.min(ny, canvas.height - selection.h));
      selection.x = nx;
      selection.y = ny;
      if (window.submitActiveConvertForm) window.submitActiveConvertForm();
    } else if (dragMode === 'resize') {
      let {x, y, w, h} = selection;
      let dx = pos.x - dragOffset.x;
      let dy = pos.y - dragOffset.y;
      if (resizeEdge.includes('e')) w = Math.max(SELECTION_MIN_SIZE, w + dx);
      if (resizeEdge.includes('s')) h = Math.max(SELECTION_MIN_SIZE, h + dy);
      if (resizeEdge.includes('w')) {
        let nx = x + dx;
        let nw = w - dx;
        if (nx < 0) { nw += nx; nx = 0; }
        if (nw >= SELECTION_MIN_SIZE) { x = nx; w = nw; }
      }
      if (resizeEdge.includes('n')) {
        let ny = y + dy;
        let nh = h - dy;
        if (ny < 0) { nh += ny; ny = 0; }
        if (nh >= SELECTION_MIN_SIZE) { y = ny; h = nh; }
      }
      if (x + w > canvas.width) w = canvas.width - x;
      if (y + h > canvas.height) h = canvas.height - y;
      selection.x = x; selection.y = y; selection.w = w; selection.h = h;
      dragOffset = {x: pos.x, y: pos.y};
      if (window.submitActiveConvertForm) window.submitActiveConvertForm();
    }
    syncDrawSelection();
  });

  canvas.addEventListener('mouseup', function(e) {
    if (!selectionEnabled) return;
    isMouseDown = false;
    mouseDownPos = null;
    if (dragMode === null && selection) {
      const pos = getMousePos(canvas, e);
      const edge = getResizeEdge(selection, pos);
      if (!edge) {
        selectionBase = null;
        clearSelection();
        return;
      }
    }
    setSelectionBase(); 
    dragMode = null;
    resizeEdge = null;
  }, true);

  canvas.addEventListener('mouseleave', function(e) {
    isMouseDown = false;
    mouseDownPos = null;
    dragMode = null;
    resizeEdge = null;
  });

  canvas.addEventListener('dblclick', function(e) {
    if (!selectionEnabled) return;
    if (!loadedImage) return;
    if (!selection) return;
    const pos = getMousePos(canvas, e);
    if (
      pos.x >= selection.x && pos.x <= selection.x + selection.w &&
      pos.y >= selection.y && pos.y <= selection.y + selection.h
    ) {
      selectionBase = null;
      clearSelection();
    }
  });
});

let selectionEnabled = false;
function setSelectionEnabled(enabled) {
  selectionEnabled = enabled;
}

let selectionBase = null;

function setSelectionBase() {
  if (selection && canvasInitial) {
    selectionBase = {
      x: selection.x,
      y: selection.y,
      w: selection.w,
      h: selection.h,
      canvasWidth: canvasInitial.width,
      canvasHeight: canvasInitial.height
    };
  }
}

[canvasInitial, canvasFinal].forEach(canvas => {
  canvas.addEventListener('mousedown', function(e) {
    if (!selectionEnabled) return;
    if (!loadedImage) return;
    const pos = getMousePos(canvas, e);
    mouseDownPos = pos;
    isMouseDown = true;

    if (selection) {
      const edge = getResizeEdge(selection, pos);
      if (edge && edge !== 'move') {
        dragMode = 'resize';
        resizeEdge = edge;
        dragOffset = {x: pos.x, y: pos.y};
        return;
      } else if (edge === 'move') {
        dragMode = 'move';
        dragOffset = {x: pos.x - selection.x, y: pos.y - selection.y};
        return;
      }
    }

    dragMode = null;
  }, true);

  canvas.addEventListener('mousemove', function(e) {
    if (!selectionEnabled) return;
    if (!loadedImage) return;
    const pos = getMousePos(canvas, e);
    let cursor = 'default';
    if (selection) {
      const edge = getResizeEdge(selection, pos);
      if (edge && edge !== 'move') {
        const map = {n:'ns-resize', s:'ns-resize', e:'ew-resize', w:'ew-resize',
          ne:'nesw-resize', nw:'nwse-resize', se:'nwse-resize', sw:'nesw-resize'};
        cursor = map[edge] || 'pointer';
      } else if (edge === 'move') {
        cursor = 'move';
      }
    }
    canvas.style.cursor = cursor;

    if (!isMouseDown) return;

    if (!dragMode && mouseDownPos) {
      const dx = pos.x - mouseDownPos.x;
      const dy = pos.y - mouseDownPos.y;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {

        selection = {x: mouseDownPos.x, y: mouseDownPos.y, w: 0, h: 0};
        dragMode = 'new';
        dragOffset = {x: mouseDownPos.x, y: mouseDownPos.y};
      } else {
        return; 
      }
    }

    if (dragMode === 'new') {
      let x1 = mouseDownPos.x;
      let y1 = mouseDownPos.y;
      let x2 = pos.x;
      let y2 = pos.y;

      let x = Math.max(0, Math.min(x1, x2));
      let y = Math.max(0, Math.min(y1, y2));
      let w = Math.abs(x2 - x1);
      let h = Math.abs(y2 - y1);
  
      w = Math.min(w, canvas.width - x);
      h = Math.min(h, canvas.height - y);
      w = Math.max(SELECTION_MIN_SIZE, w);
      h = Math.max(SELECTION_MIN_SIZE, h);
      selection.x = x;
      selection.y = y;
      selection.w = w;
      selection.h = h;
      if (window.submitActiveConvertForm) window.submitActiveConvertForm();
    } else if (dragMode === 'move') {
      let nx = pos.x - dragOffset.x;
      let ny = pos.y - dragOffset.y;
      nx = Math.max(0, Math.min(nx, canvas.width - selection.w));
      ny = Math.max(0, Math.min(ny, canvas.height - selection.h));
      selection.x = nx;
      selection.y = ny;
      if (window.submitActiveConvertForm) window.submitActiveConvertForm();
    } else if (dragMode === 'resize') {
      let {x, y, w, h} = selection;
      let dx = pos.x - dragOffset.x;
      let dy = pos.y - dragOffset.y;
      if (resizeEdge.includes('e')) w = Math.max(SELECTION_MIN_SIZE, w + dx);
      if (resizeEdge.includes('s')) h = Math.max(SELECTION_MIN_SIZE, h + dy);
      if (resizeEdge.includes('w')) {
        let nx = x + dx;
        let nw = w - dx;
        if (nx < 0) { nw += nx; nx = 0; }
        if (nw >= SELECTION_MIN_SIZE) { x = nx; w = nw; }
      }
      if (resizeEdge.includes('n')) {
        let ny = y + dy;
        let nh = h - dy;
        if (ny < 0) { nh += ny; ny = 0; }
        if (nh >= SELECTION_MIN_SIZE) { y = ny; h = nh; }
      }
      if (x + w > canvas.width) w = canvas.width - x;
      if (y + h > canvas.height) h = canvas.height - y;
      selection.x = x; selection.y = y; selection.w = w; selection.h = h;
      dragOffset = {x: pos.x, y: pos.y};
      if (window.submitActiveConvertForm) window.submitActiveConvertForm();
    }
    syncDrawSelection();
  }, true);

  canvas.addEventListener('mouseup', function(e) {
    if (!selectionEnabled) return;
    isMouseDown = false;
    mouseDownPos = null;
    if (dragMode === null && selection) {

      const pos = getMousePos(canvas, e);
      const edge = getResizeEdge(selection, pos);
      if (!edge) {
        selectionBase = null;
        clearSelection();
        return;
      }
    }
    setSelectionBase();
    dragMode = null;
    resizeEdge = null;
  }, true);

  canvas.addEventListener('mouseleave', function(e) {
    isMouseDown = false;
    mouseDownPos = null;
    dragMode = null;
    resizeEdge = null;
  });
});

function updateSelectionForCanvasResize(newWidth, newHeight) {
  if (!selectionBase) return;
  if (!selection) return;
  const scaleX = newWidth / selectionBase.canvasWidth;
  const scaleY = newHeight / selectionBase.canvasHeight;
  selection.x = selectionBase.x * scaleX;
  selection.y = selectionBase.y * scaleY;
  selection.w = selectionBase.w * scaleX;
  selection.h = selectionBase.h * scaleY;
}

function observeWrapperCanvasItemResize() {
  const wrappers = document.querySelectorAll('.wrapper-canvas-item');
  wrappers.forEach(wrapper => {
    let prevWidth = wrapper.offsetWidth;
    let prevHeight = wrapper.offsetHeight;
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if ((prevWidth !== 0 && prevHeight !== 0) && (newWidth !== prevWidth || newHeight !== prevHeight)) {
          updateSelectionForCanvasResize(newWidth, newHeight);
          syncDrawSelection();
        }
        prevWidth = newWidth;
        prevHeight = newHeight;
      }
    });
    resizeObserver.observe(wrapper);
  });
}

window.addEventListener('DOMContentLoaded', observeWrapperCanvasItemResize);
const magnifier = document.getElementById('canvas-magnifier');

let magCanvas = document.createElement('canvas');
magCanvas.width = 80;
magCanvas.height = 80;
magnifier.innerHTML = '';
magnifier.appendChild(magCanvas);

const MAG_SIZE = 80; 
const MAG_SRC = 5;    
const PIXEL_SIZE = MAG_SIZE / MAG_SRC;
function showMagnifier(x, y) {
  const rect = canvasInitial.getBoundingClientRect();
  const cx = Math.round((x - rect.left) * (canvasInitial.width / rect.width));
  const cy = Math.round((y - rect.top) * (canvasInitial.height / rect.height));

  const sx = Math.max(0, Math.min(canvasInitial.width - MAG_SRC, cx - Math.floor(MAG_SRC/2)));
  const sy = Math.max(0, Math.min(canvasInitial.height - MAG_SRC, cy - Math.floor(MAG_SRC/2)));
  const ctx = magCanvas.getContext('2d');
  ctx.clearRect(0,0,magCanvas.width,magCanvas.height);

  const imgData = canvasInitial.getContext('2d').getImageData(sx, sy, MAG_SRC, MAG_SRC);

  for (let py = 0; py < MAG_SRC; py++) {
    for (let px = 0; px < MAG_SRC; px++) {
      const i = (py * MAG_SRC + px) * 4;
      const r = imgData.data[i], g = imgData.data[i+1], b = imgData.data[i+2], a = imgData.data[i+3];
      ctx.fillStyle = `rgba(${r},${g},${b},${a/255})`;
      ctx.fillRect(px * PIXEL_SIZE, py * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    }
  }
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffff00'; 
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 2;
  ctx.strokeRect(2 * PIXEL_SIZE, 2 * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= MAG_SRC; i++) {

    ctx.beginPath();
    ctx.moveTo(i * PIXEL_SIZE, 0);
    ctx.lineTo(i * PIXEL_SIZE, MAG_SIZE);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * PIXEL_SIZE);
    ctx.lineTo(MAG_SIZE, i * PIXEL_SIZE);
    ctx.stroke();
  }
  ctx.restore();

  magnifier.style.display = 'block';
  const wrapperRect = wrapperInitial.getBoundingClientRect();
  const magHeight = magnifier.offsetHeight || 60;

  magnifier.style.left = (x - wrapperRect.left) + 'px';
  magnifier.style.top = (y - wrapperRect.top - magHeight) + 'px';
}

wrapperInitial.addEventListener('mousemove', function(e) {
  if (window._canvasContextMenuOpen) return;

  const final = document.getElementById('wrapper-canvas-item-final');
  if (!final || final.style.display === 'flex') {
    magnifier.style.display = 'none';
    return;
  }
  showMagnifier(e.clientX, e.clientY);
});
wrapperInitial.addEventListener('mouseleave', function() {
  magnifier.style.display = 'none';
});

const panelColors = document.getElementById('wrapper-control-pixel-color');
panelColors.style.display = 'none';

function updatePixelColorPanels(rgb, cmyk, hsb, xyz, lab) {
  const set = (id, val, bg) => {
    const el = document.getElementById(id);
    const valEl = document.getElementById('pixel-color-value-' + id.split('-').pop());
    if (el) {
      if (valEl) valEl.textContent = val;
      el.parentElement.style.background = bg;
    }
  };
  set('title-pixel-color-RGB', rgb.join(', '), `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);

  let cmykBg = '';
  if (window.colorRouterMul) {
    const cmykRgb = window.colorRouterMul('CMYK', 'RGB', cmyk, [1,1,1]);
    cmykBg = `rgb(${cmykRgb[0]},${cmykRgb[1]},${cmykRgb[2]})`;
  } else {
    const c = cmyk[0] / 100, m = cmyk[1] / 100, y = cmyk[2] / 100, k = cmyk[3] / 100;
    cmykBg = `rgb(${Math.round(255 * (1 - c) * (1 - k))},${Math.round(255 * (1 - m) * (1 - k))},${Math.round(255 * (1 - y) * (1 - k))})`;
  }
  set('title-pixel-color-CMYK', cmyk.map(x=>x.toFixed(2)).join(', '), cmykBg);

  let hsbBg = '';
  if (window.colorRouterMul) {
    const hsbRgb = window.colorRouterMul('HSB', 'RGB', hsb, [1,1,1]);
    hsbBg = `rgb(${hsbRgb[0]},${hsbRgb[1]},${hsbRgb[2]})`;
  } else {
    const h = hsb[0], s = hsb[1], v = hsb[2];
    hsbBg = `hsl(${Math.round(h)},${Math.round(s*100)}%,${Math.round(v*100/2)}%)`;
  }
  set('title-pixel-color-HSB', hsb.map(x=>x.toFixed(2)).join(', '), hsbBg);

  let xyzBg = '';
  if (window.colorRouterMul) {
    const xyzRgb = window.colorRouterMul('XYZ', 'RGB', xyz, [1,1,1]);
    xyzBg = `rgb(${xyzRgb[0]},${xyzRgb[1]},${xyzRgb[2]})`;
  }
  set('title-pixel-color-XYZ', xyz.map(x=>x.toFixed(2)).join(', '), xyzBg);

  let labBg = '';
  if (window.colorRouterMul) {
    const labRgb = window.colorRouterMul('Lab', 'RGB', lab, [1,1,1]);
    labBg = `rgb(${labRgb[0]},${labRgb[1]},${labRgb[2]})`;
  }
  set('title-pixel-color-Lab', lab.map(x=>x.toFixed(2)).join(', '), labBg);
}

canvasInitialOverlay.addEventListener('mousemove', function(e) {
  if (window._canvasContextMenuOpen) return;
  console.log('mousemove');
  if (!loadedImage || wrapperFinal.style.display === 'flex') return;
  const rect = canvasInitial.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) * (canvasInitial.width / rect.width));
  const y = Math.floor((e.clientY - rect.top) * (canvasInitial.height / rect.height));
  if (x < 0 || y < 0 || x >= canvasInitial.width || y >= canvasInitial.height) return;
  const ctx = canvasInitial.getContext('2d');
  const data = ctx.getImageData(x, y, 1, 1).data;
  const rgb = [data[0], data[1], data[2]];
  const cmyk = window.colorRouterMul ? window.colorRouterMul('RGB', 'CMYK', rgb, [1,1,1,1]) : [0,0,0,0];
  const hsb = window.colorRouterMul ? window.colorRouterMul('RGB', 'HSB', rgb, [1,1,1]) : [0,0,0];
  const xyz = window.colorRouterMul ? window.colorRouterMul('RGB', 'XYZ', rgb, [1,1,1]) : [0,0,0];
  const lab = window.colorRouterMul ? window.colorRouterMul('RGB', 'Lab', rgb, [1,1,1]) : [0,0,0];
  updatePixelColorPanels(rgb, cmyk, hsb, xyz, lab);
});

function clearPixelColorPanels() {
  ['RGB','CMYK','HSB','XYZ','Lab'].forEach(sys => {
    const el = document.getElementById('pixel-color-value-' + sys);
    const div = document.getElementById('title-pixel-color-' + sys);
    if (el) {
      el.textContent = '';
      div.parentElement.style.background = '';
    }
  });
}

canvasInitialOverlay.addEventListener('mouseleave', function() {
  clearPixelColorPanels();
});

const menu = document.getElementById('canvas-context-menu');
const saveBtn = document.getElementById('context-save-png');
const delBtn = document.getElementById('context-delete-img');

console.log('wrapperInitial', wrapperInitial);
wrapperInitial.addEventListener('contextmenu', function(e) {
  console.log('contextmenu');
  if (wrapperFinal && wrapperFinal.style.display === 'flex') return;
  e.preventDefault();
  const wrapperRect = wrapperInitial.getBoundingClientRect();
  menu.style.display = 'block';
  menu.style.left = (e.clientX - wrapperRect.left) + 'px';
  menu.style.top = (e.clientY - wrapperRect.top) + 'px';
  if (magnifier) magnifier.style.display = 'none';
  window._canvasContextMenuOpen = true;
  clearPixelColorPanels();
});

document.addEventListener('mousedown', function(e) {
  if (!menu.contains(e.target)) {
    menu.style.display = 'none';
    window._canvasContextMenuOpen = false;
  }
});

saveBtn.addEventListener('click', function() {
  menu.style.display = 'none';
  window._canvasContextMenuOpen = false;
  if (magnifier) magnifier.style.display = 'none';
  const link = document.createElement('a');
  link.download = 'canvas.png';
  link.href = canvasInitial.toDataURL('image/png');
  link.click();
});


delBtn.addEventListener('click', function() {
  menu.style.display = 'none';
  window._canvasContextMenuOpen = false;
  if (magnifier) magnifier.style.display = 'none';

  loadedImage = null;
  loadedImageNaturalWidth = 0;
  loadedImageNaturalHeight = 0;

  window.currentColorMatrixObj = { matrix: null, colorSpace: 'RGB' };
  window.originalRgbMatrixObj = { matrix: null, colorSpace: 'RGB' };
  window.previewMatrixObj = null;

  if (typeof undoStack !== 'undefined') undoStack.length = 0;
  if (typeof redoStack !== 'undefined') redoStack.length = 0;

  if (typeof setInitialState === 'function') setInitialState();
});

