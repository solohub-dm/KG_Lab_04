// --- Title-operation logic ---
function updateTitleOperation(mode, from, to) {
  const titleOp = document.getElementById('title-operation');
  if (mode === 'before-load') {
    titleOp.textContent = 'Open file to convert';
  } else if (mode === 'loaded') {
    titleOp.textContent = from || 'RGB';
  } else if (mode === 'convert') {
    titleOp.textContent = `${from} convert to ${to}`;
  }
}

// --- Відображення другого canvas після вибору системи ---
window.convertButtons.forEach(btn => {
  btn.addEventListener('click', function() {
    if (!loadedImage) return;
    // Активуємо відповідну кнопку
    window.convertButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Показуємо відповідний блок форми, приховуємо інші
    const space = btn.dataset.space;
    document.querySelectorAll('.wrapper-convert-item-body').forEach(div => {
      if (div.id === 'wrapper-convert-item-body-' + space) {
        div.style.display = 'flex';
        // Скидаємо значення input-ів у формі при переході між системами
        const form = div.querySelector('form');
        if (form) {
          form.reset();
          // Синхронізуємо range і number після reset
          form.querySelectorAll('input[type="range"]').forEach(range => {
            const num = form.querySelector(`input[name="${range.name}_num"]`);
            if (num) num.value = range.value;
          });
        }
      } else if (div.id === 'wrapper-convert-item-body-info') {
        div.style.display = 'none';
      } else if (div.id === 'wrapper-convert-item-body-influence') {

      } else {
        div.style.display = 'none';
      }
    });
    // --- ОНОВЛЕНО: оновити заголовок операції ---
    const titleOp = document.getElementById('title-operation');
    titleOp.textContent = `${currentColorSpace} convert to ${space}`;
    // ---
    canvasFinal.style.display = 'block';
    fitAndDrawCanvases();
    // updateCurrentColorMatrixFromCanvas();
    syncOverlayVisibility(); // Синхронізувати overlay
    // --- Додатково: дозволити selection, активувати Save/Undo ---
    setSelectionEnabled(true);
    setSaveUndoEnabled(true);
  });
});

let currentImageData = null;   // ImageData поточного стану
let currentColorMatrix = null; // 2D масив кольорів у поточній системі
let currentColorSpace = 'RGB'; // Поточний простір
let undoStack = [];
let redoStack = [];

function imageDataToMatrix(imgData) {
  const w = imgData.width, h = imgData.height, d = imgData.data;
  const matrix = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      row.push([d[i], d[i+1], d[i+2]]); // RGB
    }
    matrix.push(row);
  }
  return matrix;
}
function matrixToImageData(matrix) {
  const h = matrix.length, w = matrix[0].length;
  const imgData = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let rgb;
      // --- Patch: завжди приводити до цілих чисел у діапазоні 0-255 ---
      if (currentColorSpace === 'RGB') {
        rgb = matrix[y][x];
        rgb = [
          Math.max(0, Math.min(255, Math.round(rgb[0]))),
          Math.max(0, Math.min(255, Math.round(rgb[1]))),
          Math.max(0, Math.min(255, Math.round(rgb[2])))
        ];
      } else {
        rgb = colorRouterMul(currentColorSpace, 'RGB', matrix[y][x], [1,1,1]);
        rgb = [
          Math.max(0, Math.min(255, Math.round(rgb[0]))),
          Math.max(0, Math.min(255, Math.round(rgb[1]))),
          Math.max(0, Math.min(255, Math.round(rgb[2])))
        ];
      }
      imgData.data[i] = rgb[0];
      imgData.data[i+1] = rgb[1];
      imgData.data[i+2] = rgb[2];
      imgData.data[i+3] = 255;
    }
  }
  return imgData;
}
function cloneMatrix(matrix) {
  return matrix.map(row => row.map(px => [...px]));
}

// --- Обробка форм для коефіцієнтів впливу та конвертації зображення ---
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

      // --- Додаємо: при input у number оновлювати range ---
      num.addEventListener('input', () => {
        range.value = num.value;
        num.setAttribute('data-prev', num.value);
      });

      num.addEventListener('beforeinput', (e) => {
        if (!e.data) return;

        if (e.data && !/[\d.,]/.test(e.data)) {
          // console.log('Заборонено символ:', e.data);
          e.preventDefault();
          return;
        }
      });

      num.addEventListener('blur', () => {
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
          return;
        }

        if (/^\d+(\.\d{0,2})?$/.test(val)) {
          let floatVal = parseFloat(val);
          if (isNaN(floatVal) || floatVal < parseFloat(range.min) || floatVal > parseFloat(range.max)) {
            num.value = num.getAttribute('data-prev');
          } else {
            floatVal = Math.max(0, Math.min(2, floatVal));
            num.value = floatVal;
            range.value = floatVal;
            num.setAttribute('data-prev', floatVal);
            form.dispatchEvent(new Event('submit', { cancelable: true }));
          }
          return;
        }

        if (/^\d+$/.test(val)) {
          let floatVal = parseFloat(val);
          if (isNaN(floatVal) || floatVal < parseFloat(range.min) || floatVal > parseFloat(range.max)) {
            num.value = num.getAttribute('data-prev');
          } else {
            floatVal = Math.max(0, Math.min(2, floatVal));
            num.value = floatVal;
            range.value = floatVal;
            num.setAttribute('data-prev', floatVal);
            form.dispatchEvent(new Event('submit', { cancelable: true }));
          }
          return;
        }

        num.value = num.getAttribute('data-prev') || '';
      });

      num.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          num.blur();
        }
      });
    }
  });

  form.addEventListener('reset', function(e) {
    form.querySelectorAll('input[type="range"]').forEach(range => {
      const num = form.querySelector(`input[name="${range.name}_num"]`);
      if (num) num.value = range.value;
    });
    form.dispatchEvent(new Event('submit', {cancelable:true}));
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (!currentColorMatrix) return;
    let previewMatrix = cloneMatrix(currentColorMatrix);
    let mulKeys = [];
    if (space === 'RGB') mulKeys = ['r_mul','g_mul','b_mul'];
    else if (space === 'CMYK') mulKeys = ['c_mul','m_mul','y_mul','k_mul'];
    else if (space === 'HSB') mulKeys = ['h_mul','s_mul','b_mul'];
    else if (space === 'XYZ') mulKeys = ['x_mul','y_mul','z_mul'];
    else if (space === 'Lab') mulKeys = ['l_mul','a_mul','b_mul'];
    let muls = mulKeys.map(k => parseFloat(new FormData(form).get(k)) || 1);
    let w = previewMatrix[0].length, h = previewMatrix.length;
    // --- Визначаємо координати selection у матриці ---
    let selCoords = selection ? getMatrixSelectionCoords(selection, canvasInitial, w, h) : null;
    let x0 = 0, y0 = 0, x1 = w, y1 = h;
    if (selCoords) {
      x0 = selCoords.x0; y0 = selCoords.y0;
      x1 = selCoords.x1; y1 = selCoords.y1;
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let px = currentColorMatrix[y][x];
        if (!Array.isArray(px) || px.length !== 3 || px.some(v => typeof v !== 'number' || isNaN(v))) {
          px = [0,0,0];
        } else {
          px = px.map(v => Math.max(0, Math.min(255, Math.round(v))));
        }
        let result;
        if (!selCoords || (x >= x0 && x < x1 && y >= y0 && y < y1)) {
          result = colorRouterMul(currentColorSpace, space, px, muls);
        } else {
          result = colorRouterMul(currentColorSpace, space, px, [1,1,1,1]);
        }
        if (space !== 'RGB') result = colorRouterMul(space, 'RGB', result, [1,1,1]);
        previewMatrix[y][x] = result;
      }
    }

    window.previewMatrix = previewMatrix;
    // --- Масштабуємо для відображення на canvasFinal ---
    const imgData = matrixToImageData(previewMatrix);
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = imgData.width;
    tmpCanvas.height = imgData.height;
    tmpCanvas.getContext('2d').putImageData(imgData, 0, 0);
    canvasFinal.width = canvasFinal.offsetWidth;
    canvasFinal.height = canvasFinal.offsetHeight;
    const ctxDst = canvasFinal.getContext('2d');
    ctxDst.clearRect(0, 0, canvasFinal.width, canvasFinal.height);
    ctxDst.drawImage(tmpCanvas, 0, 0, canvasFinal.width, canvasFinal.height);
  });

  form.querySelectorAll('input[type="range"], input[type="number"]').forEach(input => {
    input.addEventListener('input', function() {
      form.dispatchEvent(new Event('submit', {cancelable: true}));
    });
  });
});

const panelColor = document.getElementById('wrapper-control-pixel-color');

// --- Save button ---
document.getElementById('button-convert-save').addEventListener('click', function() {
  if (!canvasFinal || canvasFinal.style.display !== 'block') return;
  // --- Оновлюємо всю матрицю ---
  let newMatrix = window.previewMatrix ? cloneMatrix(window.previewMatrix) : cloneMatrix(currentColorMatrix);
  undoStack.push(cloneMatrix(newMatrix));
  redoStack = [];
  currentColorMatrix = newMatrix;
  window.currentColorMatrix = currentColorMatrix;
  window.matrixToImageData = matrixToImageData;
  window.previewMatrix = null;
  // Відображаємо на canvasInitial (масштабуємо для поточного розміру)
  const imgDataNew = matrixToImageData(currentColorMatrix);
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = imgDataNew.width;
  tmpCanvas.height = imgDataNew.height;
  tmpCanvas.getContext('2d').putImageData(imgDataNew, 0, 0);
  canvasInitial.width = canvasInitial.offsetWidth;
  canvasInitial.height = canvasInitial.offsetHeight;
  const ctxI = canvasInitial.getContext('2d');
  ctxI.clearRect(0, 0, canvasInitial.width, canvasInitial.height);
  ctxI.drawImage(tmpCanvas, 0, 0, canvasInitial.width, canvasInitial.height);
  // Приховуємо canvasFinal
  canvasFinal.style.display = 'none';
  // Приховуємо wrapper-canvas-item (другий)
  const wrappers = document.querySelectorAll('.wrapper-canvas-item');
  if (wrappers[1]) wrappers[1].style.display = 'none';
  syncOverlayVisibility(); // Оновити видимість overlay
  // Показуємо info-блок
  document.querySelectorAll('.wrapper-convert-item-body').forEach(div => {
    if (div.id === 'wrapper-convert-item-body-info') div.style.display = 'flex';
    else div.style.display = 'none';
  });
  // --- Після збереження: скинути selection, деактивувати Save/Undo, скинути активну кнопку, оновити заголовок ---
  setSelectionEnabled(false);
  window.clearSelection();
  setSaveUndoEnabled(false);
  document.querySelectorAll('.color-space-btn').forEach(btn => btn.classList.remove('active'));
  currentColorSpace = 'RGB';
  // --- ОНОВЛЕНО: оновити заголовок на поточну систему ---
  updateTitleOperation('loaded', currentColorSpace);
  // --- Додаємо переобчислення розміру wrapper-canvas-item ---
  if (typeof fitAndDrawCanvases === 'function') fitAndDrawCanvases();
  canvasInitialOverlay.style.cursor = 'default';
  panelColor.style.display = '';
});

// --- При завантаженні фото ---
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
      // --- Створюємо currentColorMatrix з оригінального зображення ---
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = img.width;
      tmpCanvas.height = img.height;
      const tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.drawImage(img, 0, 0, img.width, img.height);
      const imgData = tmpCtx.getImageData(0, 0, img.width, img.height);
      currentColorMatrix = imageDataToMatrix(imgData);
      currentColorSpace = 'RGB';
      window.currentColorMatrix = currentColorMatrix;
      window.matrixToImageData = matrixToImageData;
      undoStack = [cloneMatrix(currentColorMatrix)];
      redoStack = [];
      // --- ОНОВЛЕНО: оновити заголовок ---
      const titleOp = document.getElementById('title-operation');
      titleOp.textContent = currentColorSpace;
      updateTitleOperation('loaded', currentColorSpace);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  panelColor.style.display = '';

}

// --- Overlay/selection state control ---
function setConvertButtonsEnabled(enabled) {
  convertButtons.forEach(btn => btn.disabled = !enabled);
}
function setSaveUndoEnabled(enabled) {
  const btns = document.querySelectorAll('.button-convert');
  // Save = другий, Undo = перший (Reset)
  if (btns[0]) btns[0].disabled = !enabled; // Reset
  if (btns[1]) btns[1].disabled = !enabled; // Save
}

// --- Patch: при завантаженні фото ---
const origHandleFile = handleFile;
handleFile = function(file) {
  origHandleFile(file);
  setSelectionEnabled(false); // Заборонити selection до вибору системи
  setSaveUndoEnabled(false); // Save/Undo неактивні до вибору системи
  window.clearSelection();
  
  // Розблокувати кнопки вибору системи
  convertButtons.forEach(btn => btn.disabled = false);
  updateTitleOperation('loaded', currentColorSpace);
};

// --- Patch: Undo/Save очищають selection, вихід з режиму переведення ---
const btns = document.querySelectorAll('.button-convert');
if (btns[1]) btns[1].addEventListener('click', function() { // Save
  setSelectionEnabled(false);
  window.clearSelection();
  setSaveUndoEnabled(false);
  // Приховати canvas-final
  canvasFinal.style.display = 'none';
  // Приховати wrapper-canvas-item (другий)
  const wrappers = document.querySelectorAll('.wrapper-canvas-item');
  if (wrappers[1]) wrappers[1].style.display = 'none';
  syncOverlayVisibility(); // Оновити видимість overlay
  // --- ОНОВЛЕНО: оновити заголовок на поточну систему ---
  updateTitleOperation('loaded', currentColorSpace);
  // --- Додаємо переобчислення розміру wrapper-canvas-item ---
  if (typeof fitAndDrawCanvases === 'function') fitAndDrawCanvases();
  canvasInitialOverlay.style.cursor = 'default';
  panelColor.style.display = '';

});

// --- Undo (Ctrl+Z) також очищає selection і блокує selection ---
document.addEventListener('keydown', function(e) {
  // console.log('keydown', e);
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    // console.log('Ctrl+Z pressed');
    // --- Відновити попередній стан з undoStack ---

            const wrapperFinal = document.getElementById('wrapper-canvas-item-final');
    // console.log('wrapperFinal', wrapperFinal.style.display);
    if (wrapperFinal.style.display !== 'flex') {
      if (undoStack.length > 1) {
        redoStack.push(cloneMatrix(currentColorMatrix));
        undoStack.pop();
        currentColorMatrix = cloneMatrix(undoStack[undoStack.length - 1]);
        // ОНОВЛЕНО: оновити window.currentColorMatrix після Undo
        window.currentColorMatrix = currentColorMatrix;
        const imgDataNew = matrixToImageData(currentColorMatrix);
        canvasInitial.width = imgDataNew.width;
        canvasInitial.height = imgDataNew.height;
        const ctxI = canvasInitial.getContext('2d');
        ctxI.clearRect(0, 0, canvasInitial.width, canvasInitial.height);
        ctxI.putImageData(imgDataNew, 0, 0);
      }
    }
    if (wrapperFinal) wrapperFinal.style.display = 'none';
    
    setSelectionEnabled(false);
    window.clearSelection();
    setSaveUndoEnabled(false);
    // --- Приховати другий canvas ---
    if (typeof canvasFinal !== 'undefined') canvasFinal.style.display = 'none';
    // --- Приховати меню опцій для обраної системи ---
    document.querySelectorAll('.wrapper-convert-item-body').forEach(div => {
      if (div.id === 'wrapper-convert-item-body-info') div.style.display = 'flex';
      else div.style.display = 'none';
    });
    // --- Скинути активну кнопку системи ---
    document.querySelectorAll('.color-space-btn').forEach(btn => btn.classList.remove('active'));
    // --- Скинути поточну систему ---
    currentColorSpace = 'RGB';
    // --- Відновити текст на operation ---
    const titleOp = document.getElementById('title-operation');
    titleOp.textContent = 'Open file to convert';
    // --- Скинути всі значення input range та number ---
    document.querySelectorAll('.wrapper-convert-item-body form').forEach(form => {
      form.reset();
      form.querySelectorAll('input[type="range"]').forEach(range => {
        const num = form.querySelector(`input[name="${range.name}_num"]`);
        if (num) num.value = range.value;
      });
    });
    updateAllRangeTracks();
    // --- Деактивувати Save/Undo ---
    setSaveUndoEnabled(false);
    if (typeof fitAndDrawCanvases === 'function') fitAndDrawCanvases();
    canvasInitialOverlay.style.cursor = 'default';
  panelColor.style.display = '';


  }
  // --- Redo (Ctrl+Shift+Z) ---
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
    // Якщо є redoStack
    if (redoStack.length > 0) {
      undoStack.push(cloneMatrix(currentColorMatrix));
      currentColorMatrix = cloneMatrix(redoStack.pop());
      window.currentColorMatrix = currentColorMatrix;
      const imgDataNew = matrixToImageData(currentColorMatrix);
      canvasInitial.width = imgDataNew.width;
      canvasInitial.height = imgDataNew.height;
      const ctxI = canvasInitial.getContext('2d');
      ctxI.clearRect(0, 0, canvasInitial.width, canvasInitial.height);
      ctxI.putImageData(imgDataNew, 0, 0);
      // --- Якщо wrapperFinal.style.display === 'flex', приховати переведення ---
      const wrapperFinal = document.getElementById('wrapper-canvas-item-final');
      if (wrapperFinal && wrapperFinal.style.display === 'flex') {
        wrapperFinal.style.display = 'none';
        window.previewMatrix = null;
        if (canvasFinal) {
          const ctxF = canvasFinal.getContext('2d');
          ctxF && ctxF.clearRect(0, 0, canvasFinal.width, canvasFinal.height);
        }
      }
      setSelectionEnabled(false);
      window.clearSelection();
      setSaveUndoEnabled(false);
      // --- Приховати меню опцій для обраної системи ---
      document.querySelectorAll('.wrapper-convert-item-body').forEach(div => {
        if (div.id === 'wrapper-convert-item-body-info') div.style.display = 'flex';
        else div.style.display = 'none';
      });
      // --- Скинути активну кнопку системи ---
      document.querySelectorAll('.color-space-btn').forEach(btn => btn.classList.remove('active'));
      // --- Скинути поточну систему ---
      currentColorSpace = 'RGB';
      // --- Відновити текст на operation ---
      const titleOp = document.getElementById('title-operation');
      titleOp.textContent = 'Open file to convert';
      // --- Скинути всі значення input range та number ---
      document.querySelectorAll('.wrapper-convert-item-body form').forEach(form => {
        form.reset();
        form.querySelectorAll('input[type="range"]').forEach(range => {
          const num = form.querySelector(`input[name="${range.name}_num"]`);
          if (num) num.value = range.value;
        });
      });
      updateAllRangeTracks();
      setSaveUndoEnabled(false);
      hideUndoSave();

      if (typeof fitAndDrawCanvases === 'function') fitAndDrawCanvases();
      canvasInitialOverlay.style.cursor = 'default';
  panelColor.style.display = '';

    }
  }
});

// --- Undo (кнопка) ---
document.getElementById('button-convert-undo').addEventListener('click', function() {
  // --- Відновити попередній стан з undoStack ---
  // if (undoStack.length > 1) {
  //     redoStack.push(cloneMatrix(currentColorMatrix));
  //     undoStack.pop();
  //     currentColorMatrix = cloneMatrix(undoStack[undoStack.length - 1]);
  //     // ОНОВЛЕНО: оновити window.currentColorMatrix після Undo
  //     window.currentColorMatrix = currentColorMatrix;
  //   const imgDataNew = matrixToImageData(currentColorMatrix);
  //   // Сховати другий wrapper ДО зміни canvas (щоб не було reflow після малювання)
  //   const wrappers = document.querySelectorAll('.wrapper-canvas-item');
  //   if (wrappers[1]) wrappers[1].style.display = 'none';
  //   canvasInitial.width = imgDataNew.width;
  //   canvasInitial.height = imgDataNew.height;
  //   const ctxI = canvasInitial.getContext('2d');
  //   ctxI.clearRect(0, 0, canvasInitial.width, canvasInitial.height);
  //   ctxI.putImageData(imgDataNew, 0, 0);
  // }
  // --- Додатково: очищаємо previewMatrix і canvasFinal ---
  window.previewMatrix = null;
  if (canvasFinal) {
    const ctxF = canvasFinal.getContext('2d');
    ctxF && ctxF.clearRect(0, 0, canvasFinal.width, canvasFinal.height);
    // Приховати wrapper-canvas-item-final
    const wrapperFinal = document.getElementById('wrapper-canvas-item-final');
    if (wrapperFinal) wrapperFinal.style.display = 'none';
  }
  setSelectionEnabled(false);
  window.clearSelection();
  setSaveUndoEnabled(false);
  // --- Приховати меню опцій для обраної системи ---
  document.querySelectorAll('.wrapper-convert-item-body').forEach(div => {
    if (div.id === 'wrapper-convert-item-body-info') div.style.display = 'flex';
    else div.style.display = 'none';
  });
  // --- Скинути активну кнопку системи ---
  document.querySelectorAll('.color-space-btn').forEach(btn => btn.classList.remove('active'));
  // --- Скинути поточну систему ---
  currentColorSpace = 'RGB';
  // --- ОНОВЛЕНО: оновити заголовок на поточну систему ---
  updateTitleOperation('loaded', currentColorSpace);
  // --- Скинути всі значення input range та number ---
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

// --- Кнопки Undo/Save приховані до вибору системи ---
const convertControl = document.querySelector('.wrapper-convert-control');
const btnUndo = document.getElementById('button-convert-undo');
const btnSave = document.getElementById('button-convert-save');
btnUndo.style.display = 'none';
btnSave.style.display = 'none';

convertButtons.forEach(btn => {
  btn.addEventListener('click', function() {
    // ---
    btnUndo.style.display = 'inline-block';
    btnSave.style.display = 'inline-block';
    panelColor.style.display = 'none';
    // ---
  });
});

// --- Приховувати Undo/Save після Undo/Save ---
function hideUndoSave() {
  btnUndo.style.display = 'none';
  btnSave.style.display = 'none';
}

// Додаємо виклик у Undo та Save
document.getElementById('button-convert-save').addEventListener('click', function() {
  // ...existing code...
  hideUndoSave();
  // ...existing code...
});
document.getElementById('button-convert-undo').addEventListener('click', function() {
  // ...existing code...
  hideUndoSave();
  // ...existing code...
});

// --- Динамічне оновлення кольору треку range (Webkit, Firefox, IE/Edge) ---
function updateAllRangeTracks() {
  document.querySelectorAll('.wrapper-convert-item-body input[type="range"]').forEach(function(range) {
    var min = parseFloat(range.min);
    var max = parseFloat(range.max);
    var val = parseFloat(range.value);
    var percent = ((val - min) / (max - min)) * 100;
    // Для Webkit (Chrome/Safari/Edge)
    range.style.setProperty('--percent', percent + '%');
    // Для Firefox
    if (range.style.background !== undefined) {
      range.style.background =
        'linear-gradient(to right, var(--success-accent) 0%, var(--success-accent) ' + percent + '%, var(--gray-panel) ' + percent + '%, var(--gray-panel) 100%)';
    }
  });
}

// Викликати при input і при reset
updateAllRangeTracks();
document.querySelectorAll('.wrapper-convert-item-body input[type="range"]').forEach(function(range) {
  range.addEventListener('input', updateAllRangeTracks);
});
document.querySelectorAll('.wrapper-convert-item-body form').forEach(function(form) {
  form.addEventListener('reset', function() {
    setTimeout(function() {
      updateAllRangeTracks();
      form.dispatchEvent(new Event('submit', {cancelable:true}));
    }, 0); // після reset значення оновляться
  });
});

// --- Toggle log show/hide: приховувати/відновлювати resize-log-vertical ---
document.getElementById('toggle-log-body-down').addEventListener('click', function() {
  const resizeLog = document.getElementById('resize-log-vertical');
  if (resizeLog) resizeLog.style.display = 'none';
});
document.getElementById('toggle-log-body-up').addEventListener('click', function() {
  const resizeLog = document.getElementById('resize-log-vertical');
  if (resizeLog) resizeLog.style.display = '';
});

// --- При старті ---
updateTitleOperation('before-load');

function updateCurrentColorMatrixFromCanvas() {
  // Оновлює currentColorMatrix з canvasInitial (розмір вже актуальний)
  if (!canvasInitial) return;
  const ctx = canvasInitial.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvasInitial.width, canvasInitial.height);
  currentColorMatrix = imageDataToMatrix(imgData);
  window.currentColorMatrix = currentColorMatrix;
}

// --- Сабміт активної форми конвертації (глобально) ---
window.submitActiveConvertForm = function() {
  const activeFormDiv = Array.from(document.querySelectorAll('.wrapper-convert-item-body'))
    .find(div => getComputedStyle(div).display === 'flex');
  if (activeFormDiv) {
    const form = activeFormDiv.querySelector('form');
    if (form) form.dispatchEvent(new Event('submit', {cancelable:true}));
  }
};

// --- Перетворення selection з canvas у координати матриці ---
function getMatrixSelectionCoords(selection, canvas, matrixWidth, matrixHeight) {
  if (!selection) return null;
  // canvas.width/height — фізичний розмір canvas (відображення)
  // matrixWidth/Height — розмір матриці (оригінального зображення)
  const scaleX = matrixWidth / canvas.width;
  const scaleY = matrixHeight / canvas.height;
  let x0 = Math.round(selection.x * scaleX);
  let y0 = Math.round(selection.y * scaleY);
  let x1 = Math.round((selection.x + selection.w) * scaleX);
  let y1 = Math.round((selection.y + selection.h) * scaleY);
  // Обмеження в межах матриці
  x0 = Math.max(0, Math.min(matrixWidth, x0));
  y0 = Math.max(0, Math.min(matrixHeight, y0));
  x1 = Math.max(0, Math.min(matrixWidth, x1));
  y1 = Math.max(0, Math.min(matrixHeight, y1));
  return {x0, y0, x1, y1};
}

// // --- Clear selection ---
// function window.clearSelection() {
//   console.log('window.clearSelection');
//   const hadSelection = !!selection;
//   selection = null;
//   syncDrawSelection && syncDrawSelection();
//   if (hadSelection && typeof window.submitActiveConvertForm === 'function') {
//     // Після зняття виділення застосувати конвертацію для всього зображення
//     window.submitActiveConvertForm();
//   }
// }

