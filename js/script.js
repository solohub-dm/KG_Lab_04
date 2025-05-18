const wrapperInfluenceSum = document.getElementById('wrapper-log-summary-body');
const wrapperInfluenceLog = document.getElementById('wrapper-log-influence-body');

function updateTitleOperation(mode, from, to) {
  const titleOp = document.getElementById('title-operation');
  if (mode === 'before-load' || from === undefined) {
    titleOp.textContent = 'Open file to convert';
  } else if (mode === 'loaded') {
    titleOp.textContent = from || 'RGB';
  } else if (mode === 'convert') {
    titleOp.textContent = `${from} convert to ${to}`;
  }
}

window.convertButtons.forEach(btn => {
  btn.addEventListener('click', function() {
    if (!loadedImage) return;
    window.convertButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const space = btn.dataset.space;
    document.querySelectorAll('.wrapper-convert-item-body').forEach(div => {
      if (div.id === 'wrapper-convert-item-body-' + space) {
        div.style.display = 'flex';

        const form = div.querySelector('form');
        if (form) {
          form.reset();
          form.querySelectorAll('input[type="range"]').forEach(range => {
            const num = form.querySelector(`input[name="${range.name}_num"]`);
            if (num) num.value = range.value;
          });
        }
      } else if (div.id === 'wrapper-convert-item-body-info') {
        div.style.display = 'none';
      } else {
        div.style.display = 'none';
      }
    });

    updateTitleOperation('convert', getCurrentColorSpace(), space);

    canvasFinal.style.display = 'block';
    fitAndDrawCanvases();

    syncOverlayVisibility();
    setSelectionEnabled(true);
    // setSaveUndoEnabled(true);
  });
});

let undoStack = [];
let redoStack = [];
let originalRgbMatrixObj = { matrix: null, colorSpace: 'RGB' };
let currentColorMatrixObj = { matrix: null, colorSpace: 'RGB' };
let previewMatrixObj = null;

window.originalRgbMatrixObj = originalRgbMatrixObj;
window.currentColorMatrixObj = currentColorMatrixObj;
window.previewMatrixObj = previewMatrixObj;

function getCurrentMatrix() {
  return currentColorMatrixObj.matrix;
}
function getCurrentColorSpace() {
  return currentColorMatrixObj.colorSpace;
}
function setCurrentMatrixObj(obj) {
  currentColorMatrixObj = { matrix: cloneMatrix(obj.matrix), colorSpace: obj.colorSpace };
  window.currentColorMatrixObj = currentColorMatrixObj;
}
function getOriginalMatrix() {
  return originalRgbMatrixObj.matrix;
}
function getOriginalColorSpace() {
  return originalRgbMatrixObj.colorSpace;
}
function setOriginalMatrixObj(obj) {
  originalRgbMatrixObj = { matrix: cloneMatrix(obj.matrix), colorSpace: obj.colorSpace };
  window.originalRgbMatrixObj = originalRgbMatrixObj;
}
function getPreviewMatrix() {
  return previewMatrixObj ? previewMatrixObj.matrix : null;
}
function getPreviewColorSpace() {
  return previewMatrixObj ? previewMatrixObj.colorSpace : null;
}
function setPreviewMatrixObj(obj) {
  previewMatrixObj = obj ? { matrix: cloneMatrix(obj.matrix), colorSpace: obj.colorSpace } : null;
  window.previewMatrixObj = previewMatrixObj;
}

function imageDataToMatrix(imgData) {
  const w = imgData.width, h = imgData.height, d = imgData.data;
  const matrix = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      row.push([d[i], d[i+1], d[i+2]]); 
    }
    matrix.push(row);
  }
  return matrix;
}
function matrixToImageData(matrix, space) {
  // console.log('matrixToImageData start');
  const h = matrix.length, w = matrix[0].length;
  const imgData = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let rgb;
      if (space === 'RGB') {
        rgb = matrix[y][x];
      } else {
        rgb = colorRouterMul(space, 'RGB', matrix[y][x], [1,1,1]);
      }
      imgData.data[i] = rgb[0];
      imgData.data[i+1] = rgb[1];
      imgData.data[i+2] = rgb[2];
      imgData.data[i+3] = 255;
    }
  }
  // console.log('matrix', matrix[0][0]);
  // console.log('colorSpace', space);
  // console.log('matrixToImageData end');
  return imgData;
}
window.matrixToImageData = matrixToImageData;

function cloneMatrix(matrix) {
  if (!matrix) return null;
  return matrix.map(row => row.map(px => [...px]));
}

const colorSpaces = ['RGB', 'CMYK', 'HSB', 'XYZ', 'Lab'];
colorSpaces.forEach(space => {
  const form = document.getElementById('form-convert-' + space);
  if (!form) return;

  form.querySelectorAll('input[type="range"]').forEach(range => {
    const num = form.querySelector(`input[name="${range.name}_num"]`);
    if (num) {
      range.addEventListener('input', () => {
        num.value = range.value;
        num.setAttribute('data-prev', range.value);
        num.dispatchEvent(new Event('input', { bubbles: true }));
      });

      num.value = range.value;
      num.setAttribute('data-prev', range.value);
      // num.addEventListener('input', () => {
      //   range.value = num.value;
        
      // });

      num.addEventListener('beforeinput', (e) => {
        if (!e.data) return;

        if (e.data && !/[\d.,]/.test(e.data)) {
          e.preventDefault();
          return;
        }
      });

      num.addEventListener('blur', () => {
        // console.log('blur');
        let val = num.value.replace(/,/g, '.');
        val = val.replace(/[^\d.]/g, '');

        const firstDot = val.indexOf('.');
        if (firstDot !== -1) {
          val = val.slice(0, firstDot + 1) + val.slice(firstDot + 1).replace(/\./g, '');
        }

        if (/^\d+\.\d{3,}$/.test(val)) {
          val = val.replace(/(\.\d{2}).*$/, '$1');
        }

        if (val === '' || val === '.') {
          num.value = num.getAttribute('data-prev') || '';
          updateAllRangeTracks();
          return;
        }

        if (/^\d+(\.\d{0,2})?$/.test(val)) {
          let floatVal = parseFloat(val);
          if (isNaN(floatVal) || floatVal < parseFloat(range.min) || floatVal > parseFloat(range.max)) {
            num.value = num.getAttribute('data-prev');
            updateAllRangeTracks();
          } else {
            floatVal = Math.max(0, Math.min(2, floatVal));
            num.value = floatVal;
            range.value = floatVal;
            num.setAttribute('data-prev', floatVal);
            updateAllRangeTracks();
            form.dispatchEvent(new Event('submit', { cancelable: true }));
          }
          return;
        }

        if (/^\d+$/.test(val)) {
          let floatVal = parseFloat(val);
          if (isNaN(floatVal) || floatVal < parseFloat(range.min) || floatVal > parseFloat(range.max)) {
            num.value = num.getAttribute('data-prev');
            updateAllRangeTracks();
          } else {
            floatVal = Math.max(0, Math.min(2, floatVal));
            num.value = floatVal;
            range.value = floatVal;
            num.setAttribute('data-prev', floatVal);
            updateAllRangeTracks();
            form.dispatchEvent(new Event('submit', { cancelable: true }));
          }
          return;
        }

        num.value = num.getAttribute('data-prev') || '';
        updateAllRangeTracks();
      });

      num.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          num.blur();
        }
      });
    }
  });

  form.addEventListener('reset', function(e) {
    mod.checked = false;
    form.querySelectorAll('input[type="range"]').forEach(range => {
      const num = form.querySelector(`input[name="${range.name}_num"]`);
      if (num) num.value = range.value;
    });
    form.dispatchEvent(new Event('submit', {cancelable:true}));
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    // console.log('submit start');
    let previewMatrix = cloneMatrix(getCurrentMatrix());

    let mulKeys = [];
    if (space === 'RGB') mulKeys = ['r_mul','g_mul','b_mul'];
    else if (space === 'CMYK') mulKeys = ['c_mul','m_mul','y_mul','k_mul'];
    else if (space === 'HSB') mulKeys = ['h_mul','s_mul','b_mul'];
    else if (space === 'XYZ') mulKeys = ['x_mul','y_mul','z_mul'];
    else if (space === 'Lab') mulKeys = ['l_mul','a_mul','b_mul'];
    let muls = mulKeys.map(k => parseFloat(new FormData(form).get(k)));

    let opts = {};
    if (space === 'HSB') {
      const useH = document.getElementById('ignoreHue')?.checked;
      const hueStart = Number(document.getElementById('hueStart')?.value) || 0;
      const hueEnd = Number(document.getElementById('hueEnd')?.value) || 0;
      opts = { useH, hueStart, hueEnd };
      muls[0] = 1;
    }

    let w = previewMatrix[0].length, h = previewMatrix.length;
    let selCoords = selection ? getMatrixSelectionCoords(selection, canvasInitial, w, h) : null;
    let x0 = 0, y0 = 0, x1 = w, y1 = h;
    if (selCoords) {
      x0 = selCoords.x0; y0 = selCoords.y0;
      x1 = selCoords.x1; y1 = selCoords.y1;
    }

    let currentMatrix = getCurrentMatrix();
    let currentColorSpace = getCurrentColorSpace();

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let px = currentMatrix[y][x];
        // if (!Array.isArray(px) || px.length !== 3 || px.some(v => typeof v !== 'number' || isNaN(v))) {
        //   px = [0,0,0];
        // } else {
        //   px = px.map(v => Math.max(0, Math.min(255, Math.round(v))));
        // }
        let result;
        if (!selCoords || (x >= x0 && x < x1 && y >= y0 && y < y1)) {
          if (space === 'HSB') {
            result = colorRouterMul(currentColorSpace, space, px, muls, opts);
          } else {
            result = colorRouterMul(currentColorSpace, space, px, muls);
          }
        } else {
          result = colorRouterMul(currentColorSpace, space, px, [1,1,1,1]);
        }

        previewMatrix[y][x] = result;
      }
    }

    setPreviewMatrixObj({ matrix: previewMatrix, colorSpace: space });
    const imgData = matrixToImageData(previewMatrix, space);
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = imgData.width;
    tmpCanvas.height = imgData.height;
    tmpCanvas.getContext('2d').putImageData(imgData, 0, 0);
    canvasFinal.width = canvasFinal.offsetWidth;
    canvasFinal.height = canvasFinal.offsetHeight;
    const ctxDst = canvasFinal.getContext('2d');
    ctxDst.clearRect(0, 0, canvasFinal.width, canvasFinal.height);
    ctxDst.drawImage(tmpCanvas, 0, 0, canvasFinal.width, canvasFinal.height);

    // console.log('currentMatrix', getCurrentMatrix()[0][0]);
    // console.log('currentColorSpace', getCurrentColorSpace());

    // console.log('previewMatrix', getPreviewMatrix()[0][0]);
    // console.log('previewColorSpace', getPreviewColorSpace());

    // console.log('submit end');
  });

  form.querySelectorAll('input[type="range"], input[type="number"]').forEach(input => {
    input.addEventListener('input', function() {
      form.dispatchEvent(new Event('submit', {cancelable: true}));
    });
  });
});


if (mod) {
  mod.addEventListener('change', function() {
    const form = document.getElementById('form-convert-CMYK');
    if (form) form.dispatchEvent(new Event('submit', {cancelable:true}));
  });
}

function convertToRgb(matrix, space) {
  let w = matrix[0].length, h = matrix.length;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let px = matrix[y][x];
      let result = colorRouterMul(space, 'RGB', px);
      matrix[y][x] = result;
    }
  }
}

const panelColor = document.getElementById('wrapper-control-pixel-color');

document.getElementById('button-convert-save').addEventListener('click', function() {
  if (!canvasFinal || canvasFinal.style.display !== 'block') return;
  // console.log('save start');
  let oldMatrix = cloneMatrix(getCurrentMatrix());
  let oldColorSpace = getCurrentColorSpace();

  // console.log('oldMatrix', oldMatrix[0][0]);
  // console.log('oldColorSpace', oldColorSpace);
  
  undoStack.push({ matrix: oldMatrix, colorSpace: oldColorSpace });
  redoStack = [];

  let newMatrix = getPreviewMatrix() ? cloneMatrix(getPreviewMatrix()) : cloneMatrix(getCurrentMatrix());
  let newColorSpace = getPreviewColorSpace() || getCurrentColorSpace();
  setCurrentMatrixObj({ matrix: newMatrix, colorSpace: newColorSpace });
  setPreviewMatrixObj(null);

  // console.log('newMatrix', getCurrentMatrix()[0][0]);
  // console.log('newColorSpace', getCurrentColorSpace());

  const imgDataNew = matrixToImageData(getCurrentMatrix(), getCurrentColorSpace());
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = imgDataNew.width;
  tmpCanvas.height = imgDataNew.height;
  tmpCanvas.getContext('2d').putImageData(imgDataNew, 0, 0);

  canvasInitial.width = canvasInitial.offsetWidth;
  canvasInitial.height = canvasInitial.offsetHeight;
  const ctxI = canvasInitial.getContext('2d');
  ctxI.clearRect(0, 0, canvasInitial.width, canvasInitial.height);
  ctxI.drawImage(tmpCanvas, 0, 0, canvasInitial.width, canvasInitial.height);
  canvasFinal.style.display = 'none';

  const wrappers = document.querySelectorAll('.wrapper-canvas-item');
  if (wrappers[1]) wrappers[1].style.display = 'none';
  window.clearSelection();
  syncOverlayVisibility();
  document.querySelectorAll('.wrapper-convert-item-body').forEach(div => {
    if (div.id === 'wrapper-convert-item-body-info') div.style.display = 'flex';
    else div.style.display = 'none';
  });
  setSelectionEnabled(false);
  if (typeof fitAndDrawCanvases === 'function') fitAndDrawCanvases();

  document.querySelectorAll('.color-space-btn').forEach(btn => btn.classList.remove('active'));

  canvasInitialOverlay.style.cursor = 'default';
  panelColor.style.display = '';

  updateTitleOperation('loaded', getCurrentColorSpace());

  let res = analyzeColorMatrices(getOriginalMatrix(), getOriginalColorSpace(), newMatrix, newColorSpace)
  renderColorAnalysis(res, wrapperInfluenceSum, true, getOriginalColorSpace(), newColorSpace);
  res = analyzeColorMatrices(oldMatrix, oldColorSpace, newMatrix, newColorSpace)
  renderColorAnalysis(res, wrapperInfluenceLog, false, oldColorSpace, newColorSpace);

  // console.log('save end');
});


const btns = document.querySelectorAll('.button-convert');
if (btns[1]) btns[1].addEventListener('click', function() {
  setSelectionEnabled(false);
  window.clearSelection();

  canvasFinal.style.display = 'none';
  const wrappers = document.querySelectorAll('.wrapper-canvas-item');
  if (wrappers[1]) wrappers[1].style.display = 'none';
  syncOverlayVisibility(); 

  updateTitleOperation('loaded', getCurrentColorSpace());
  if (typeof fitAndDrawCanvases === 'function') fitAndDrawCanvases();
  
  canvasInitialOverlay.style.cursor = 'default';
  panelColor.style.display = '';

});

document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    const wrapperFinal = document.getElementById('wrapper-canvas-item-final');
    if (wrapperFinal.style.display !== 'flex') {
      if (undoStack.length >= 1) {
        redoStack.push({ matrix: cloneMatrix(getCurrentMatrix()), colorSpace: getCurrentColorSpace() });
        const last = undoStack[undoStack.length - 1];
        undoStack.pop();

        setCurrentMatrixObj(last);
        const imgDataNew = matrixToImageData(getCurrentMatrix(), getCurrentColorSpace());
        canvasInitial.width = imgDataNew.width;
        canvasInitial.height = imgDataNew.height;
        const ctxI = canvasInitial.getContext('2d');
        ctxI.clearRect(0, 0, canvasInitial.width, canvasInitial.height);
        ctxI.putImageData(imgDataNew, 0, 0);

        let newMatrix = getCurrentMatrix();
        let newColorSpace = getCurrentColorSpace();

        let originalMatrix = getOriginalMatrix();
        let originalColorSpace = getOriginalColorSpace();

        if(wrapperInfluenceLog.lastChild) wrapperInfluenceLog.removeChild(wrapperInfluenceLog.lastChild);
        let res = analyzeColorMatrices(originalMatrix, originalColorSpace, newMatrix, newColorSpace)
        renderColorAnalysis(res, wrapperInfluenceSum, true, originalColorSpace, newColorSpace);

        if (undoStack.length === 0) 
          if(wrapperInfluenceSum.lastChild) wrapperInfluenceSum.removeChild(wrapperInfluenceSum.lastChild);
      } 
    }
    if (wrapperFinal) wrapperFinal.style.display = 'none';
    setSelectionEnabled(false);
    window.clearSelection();
    // setSaveUndoEnabled(false);
    if (typeof canvasFinal !== 'undefined') canvasFinal.style.display = 'none';
    document.querySelectorAll('.wrapper-convert-item-body').forEach(div => {
      if (div.id === 'wrapper-convert-item-body-info') div.style.display = 'flex';
      else div.style.display = 'none';
    });
    document.querySelectorAll('.color-space-btn').forEach(btn => btn.classList.remove('active'));
    updateTitleOperation('loaded', getCurrentColorSpace());
    document.querySelectorAll('.wrapper-convert-item-body form').forEach(form => {
      form.reset();
      form.querySelectorAll('input[type="range"]').forEach(range => {
        const num = form.querySelector(`input[name="${range.name}_num"]`);
        if (num) num.value = range.value;
      });
    });
    updateAllRangeTracks();
    // setSaveUndoEnabled(false);
    if (typeof fitAndDrawCanvases === 'function') fitAndDrawCanvases();
    canvasInitialOverlay.style.cursor = 'default';
    panelColor.style.display = '';
  }

  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
    if (redoStack.length > 0) {
      let oldMatrix = cloneMatrix(getCurrentMatrix());
      let oldColorSpace = getCurrentColorSpace();
      undoStack.push({ matrix: oldMatrix, colorSpace: oldColorSpace });

      const next = redoStack.pop();
      setCurrentMatrixObj(next);
      let newMatrix = cloneMatrix(getPreviewMatrix());
      let newColorSpace = getPreviewColorSpace();

      const imgDataNew = matrixToImageData(newMatrix, newColorSpace);
      canvasInitial.width = imgDataNew.width;
      canvasInitial.height = imgDataNew.height;
      const ctxI = canvasInitial.getContext('2d');
      ctxI.clearRect(0, 0, canvasInitial.width, canvasInitial.height);
      ctxI.putImageData(imgDataNew, 0, 0);
      const wrapperFinal = document.getElementById('wrapper-canvas-item-final');
      if (wrapperFinal && wrapperFinal.style.display === 'flex') {
        wrapperFinal.style.display = 'none';
        window.previewMatrixObj = null;
        if (canvasFinal) {
          const ctxF = canvasFinal.getContext('2d');
          ctxF && ctxF.clearRect(0, 0, canvasFinal.width, canvasFinal.height);
        }
      }
      setSelectionEnabled(false);
      window.clearSelection();
      // setSaveUndoEnabled(false);
      document.querySelectorAll('.wrapper-convert-item-body').forEach(div => {
        if (div.id === 'wrapper-convert-item-body-info') div.style.display = 'flex';
        else div.style.display = 'none';
      });
      document.querySelectorAll('.color-space-btn').forEach(btn => btn.classList.remove('active'));
      updateTitleOperation('loaded', getCurrentColorSpace());
      document.querySelectorAll('.wrapper-convert-item-body form').forEach(form => {
        form.reset();
        form.querySelectorAll('input[type="range"]').forEach(range => {
          const num = form.querySelector(`input[name="${range.name}_num"]`);
          if (num) num.value = range.value;
        });
      });
      updateAllRangeTracks();
      // setSaveUndoEnabled(false);
      hideUndoSave();
      if (typeof fitAndDrawCanvases === 'function') fitAndDrawCanvases();
      canvasInitialOverlay.style.cursor = 'default';
      panelColor.style.display = '';

      let originalMatrix = getOriginalMatrix();
      let originalColorSpace = getOriginalColorSpace();

      let res = analyzeColorMatrices(originalMatrix, originalColorSpace, newMatrix, newColorSpace)
      renderColorAnalysis(res, wrapperInfluenceSum, true, originalColorSpace, newColorSpace);
      res = analyzeColorMatrices(oldMatrix, oldColorSpace, newMatrix, newColorSpace)
      renderColorAnalysis(res, wrapperInfluenceLog, false, oldColorSpace, newColorSpace);
    }
  }
});

document.getElementById('button-convert-undo').addEventListener('click', function() {
  window.previewMatrixObj = null;
  if (canvasFinal) {
    const ctxF = canvasFinal.getContext('2d');
    ctxF && ctxF.clearRect(0, 0, canvasFinal.width, canvasFinal.height);
    const wrapperFinal = document.getElementById('wrapper-canvas-item-final');
    if (wrapperFinal) wrapperFinal.style.display = 'none';
  }
  setSelectionEnabled(false);
  window.clearSelection();
  // setSaveUndoEnabled(false);
  document.querySelectorAll('.wrapper-convert-item-body').forEach(div => {
    if (div.id === 'wrapper-convert-item-body-info') div.style.display = 'flex';
    else div.style.display = 'none';
  });

  document.querySelectorAll('.color-space-btn').forEach(btn => btn.classList.remove('active'));
  currentColorSpace = 'RGB';
  updateTitleOperation('loaded', currentColorSpace);
  document.querySelectorAll('.wrapper-convert-item-body form').forEach(form => {
    form.reset();
    form.querySelectorAll('input[type="range"]').forEach(range => {
      const num = form.querySelector(`input[name="${range.name}_num"]`);
      if (num) num.value = range.value;
    });
  });
  updateAllRangeTracks();

  if (typeof fitAndDrawCanvases === 'function') fitAndDrawCanvases();
  canvasInitialOverlay.style.cursor = 'default';
  panelColor.style.display = '';
});


const convertControl = document.querySelector('.wrapper-convert-control');
const btnUndo = document.getElementById('button-convert-undo');
const btnSave = document.getElementById('button-convert-save');
btnUndo.style.display = 'none';
btnSave.style.display = 'none';

convertButtons.forEach(btn => {
  btn.addEventListener('click', function() {
    btnUndo.style.display = 'inline-block';
    btnSave.style.display = 'inline-block';
    panelColor.style.display = 'none';
  });
});

function hideUndoSave() {
  btnUndo.style.display = 'none';
  btnSave.style.display = 'none';
}

document.getElementById('button-convert-save').addEventListener('click', function() {
  hideUndoSave();
});
document.getElementById('button-convert-undo').addEventListener('click', function() {
  hideUndoSave();
});

function updateAllRangeTracks() {
  document.querySelectorAll('.wrapper-convert-item-body input[type="range"]').forEach(function(range) {
    var min = parseFloat(range.min);
    var max = parseFloat(range.max);
    var val = parseFloat(range.value);
    var percent = ((val - min) / (max - min)) * 100;
    range.style.setProperty('--percent', percent + '%');
    if (range.style.background !== undefined) {
      range.style.background =
        'linear-gradient(to right, var(--success-accent) 0%, var(--success-accent) ' + percent + '%, var(--gray-panel) ' + percent + '%, var(--gray-panel) 100%)';
    }
  });
}

updateAllRangeTracks();
document.querySelectorAll('.wrapper-convert-item-body input[type="range"]').forEach(function(range) {
  range.addEventListener('input', updateAllRangeTracks);
});
document.querySelectorAll('.wrapper-convert-item-body form').forEach(function(form) {
  form.addEventListener('reset', function() {
    setTimeout(function() {
      updateAllRangeTracks();
      form.dispatchEvent(new Event('submit', {cancelable:true}));
    }, 0); 
  });
});

document.getElementById('toggle-log-body-down').addEventListener('click', function() {
  const resizeLog = document.getElementById('resize-log-vertical');
  if (resizeLog) resizeLog.style.display = 'none';
});
document.getElementById('toggle-log-body-up').addEventListener('click', function() {
  const resizeLog = document.getElementById('resize-log-vertical');
  if (resizeLog) resizeLog.style.display = '';
});

updateTitleOperation('before-load');

window.submitActiveConvertForm = function() {
  const activeFormDiv = Array.from(document.querySelectorAll('.wrapper-convert-item-body'))
    .find(div => getComputedStyle(div).display === 'flex');
  if (activeFormDiv) {
    const form = activeFormDiv.querySelector('form');
    if (form) form.dispatchEvent(new Event('submit', {cancelable:true}));
  }
};

function getMatrixSelectionCoords(selection, canvas, matrixWidth, matrixHeight) {
  if (!selection) return null;
  const scaleX = matrixWidth / canvas.width;
  const scaleY = matrixHeight / canvas.height;
  let x0 = Math.round(selection.x * scaleX);
  let y0 = Math.round(selection.y * scaleY);
  let x1 = Math.round((selection.x + selection.w) * scaleX);
  let y1 = Math.round((selection.y + selection.h) * scaleY);

  x0 = Math.max(0, Math.min(matrixWidth, x0));
  y0 = Math.max(0, Math.min(matrixHeight, y0));
  x1 = Math.max(0, Math.min(matrixWidth, x1));
  y1 = Math.max(0, Math.min(matrixHeight, y1));
  return {x0, y0, x1, y1};
}

function analyzeColorMatrices(matrixAS, colorSpaceA, matrixBS, colorSpaceB, threshold = 0) {
  const matrixA = cloneMatrix(matrixAS);
  const matrixB = cloneMatrix(matrixBS);

  if (colorSpaceA !== 'RGB') 
    convertToRgb(matrixA, colorSpaceA);
  if (colorSpaceB !== 'RGB')
    convertToRgb(matrixB, colorSpaceB);

  const h = matrixA.length;
  const w = h > 0 ? matrixA[0].length : 0;
  const channels = w > 0 ? matrixA[0][0].length : 0;

  let totalDiff = 0;
  let minDiff = null;
  let maxDiff = 0;
  let maxDiffCoord = null;
  let maxDiffColor = null;
  let changedPixels = 0;
  let unchangedPixels = 0;
  let channelDiffSum = Array(channels).fill(0);
  let channelDiffMax = Array(channels).fill(0);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pxA = matrixA[y][x];
      const pxB = matrixB[y][x];
      let pxDiff = 0;
      let pxChannelDiffs = [];
      for (let c = 0; c < channels; c++) {
        const diff = Math.abs(pxA[c] - pxB[c]);
        pxChannelDiffs.push(diff);
        channelDiffSum[c] += diff;
        if (diff > channelDiffMax[c]) channelDiffMax[c] = diff;
        pxDiff += diff;
      }
      if (pxDiff > maxDiff) {
        maxDiff = pxDiff;
        maxDiffCoord = {x, y};
        maxDiffColor = pxB.slice();
      }
      if (pxDiff > threshold) changedPixels++;
      else unchangedPixels++;
      if (pxDiff > 0 && (minDiff === null || pxDiff < minDiff)) minDiff = pxDiff;
      totalDiff += pxDiff;
    }
  }

  const totalPixels = h * w;
  const avgDiff = totalPixels > 0 ? totalDiff / totalPixels : 0;
  const accuracy = totalPixels > 0 ? (unchangedPixels / totalPixels) * 100 : 0;
  const percentChanged = totalPixels > 0 ? (changedPixels / totalPixels) * 100 : 0;
  const channelAvgDiff = channelDiffSum.map(sum => totalPixels > 0 ? sum / totalPixels : 0);

  return {
    accuracy: accuracy, 
    avgColorError: avgDiff,
    maxColorError: maxDiff,
    minColorError: minDiff === null ? 0 : minDiff,
    colorThatChangedTheMost: {
      coord: maxDiffCoord,
      color: maxDiffColor
    },
    percentChanged: percentChanged,
    channelStats: {
      avg: channelAvgDiff,
      max: channelDiffMax
    }
  };
}


function renderColorAnalysis(analysis, targetDiv, isOnly = false, fromSystem = 'RGB', toSystem = 'RGB') {
  if (typeof targetDiv === 'string') {
    targetDiv = document.getElementById(targetDiv);
  }
  if (!targetDiv) return;

  const hasChild = targetDiv.firstChild;


  const fmt = (v, d=2) => (typeof v === 'number' ? v.toFixed(d) : v);

  let html = `<div class="color-analysis-summary">`;
  if (hasChild) html += `<hr>`

  html += `<div class="color-analysis-title">${fromSystem} <span class="color-analysis-arrow">&#8594;</span> ${toSystem}</div>`;

  html += `<b>Accuracy:</b> ${fmt(analysis.accuracy, 2)}%<br>`;
  html += `<b>Average color error:</b> ${fmt(analysis.avgColorError, 3)} (out of 255)<br>`;
  html += `<b>Max color error:</b> ${fmt(analysis.maxColorError, 3)} (out of 255)<br>`;
  html += `<b>Min color error:</b> ${fmt(analysis.minColorError, 3)} (out of 255)<br>`;

  if (analysis.colorThatChangedTheMost && analysis.colorThatChangedTheMost.coord && analysis.colorThatChangedTheMost.color) {
    const c = analysis.colorThatChangedTheMost.color;
    html += `<b>Color that changed the most:</b> 
      <span class="color-analysis-swatch" style="background:rgb(${c.map(v=>Math.round(v)).join(',')});"></span>
      rgb(${c.map(v=>Math.round(v)).join(', ')}) at (${analysis.colorThatChangedTheMost.coord.x}, ${analysis.colorThatChangedTheMost.coord.y})<br>`;
  }

  html += `<b>Percent of changed pixels:</b> ${fmt(analysis.percentChanged, 2)}%<br>`;

  if (analysis.channelStats) {
    html += `<b>Channel-wise avg error:</b> [${analysis.channelStats.avg.map(v=>fmt(v,3)).join(', ')}] (out of 255)<br>`;
    html += `<b>Channel-wise max error:</b> [${analysis.channelStats.max.map(v=>fmt(v,3)).join(', ')}] (out of 255)<br>`;
  }
  html += `</div>`;

  const analysisDiv = document.createElement('div');
  analysisDiv.className = 'color-analysis-summary';
  analysisDiv.innerHTML = html.replace(/^<div[^>]*>|<\/div>$/g, '');
  while (isOnly && targetDiv.firstChild) targetDiv.removeChild(targetDiv.firstChild);
  targetDiv.appendChild(analysisDiv);
  if (!isOnly && hasChild) {
    targetDiv.scrollTop = targetDiv.scrollHeight;
  }
}