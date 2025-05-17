// console.log('Script loaded');

// --- Drag resize for wrapper-log-item (horizontal) ---
const logBody = document.getElementById('wrapper-log-body');

const toggleLogBodyDown = document.getElementById('toggle-log-body-down');
const toggleLogBodyUp = document.getElementById('toggle-log-body-up');

function hideLogBody() {
  logBody.style.display = 'none';
  toggleLogBodyDown.style.display = 'none';
  toggleLogBodyUp.style.display = 'inline-block';
}
function showLogBody() {
  logBody.style.display = 'flex';
  toggleLogBodyDown.style.display = 'inline-block';
  toggleLogBodyUp.style.display = 'none';
}

toggleLogBodyDown.addEventListener('click', hideLogBody);
toggleLogBodyUp.addEventListener('click', showLogBody);

showLogBody();


const wrapperControl = document.getElementById('wrapper-control');
const resizeControlBar = document.getElementById('resize-control-bar');
let isResizingControl = false;

resizeControlBar.addEventListener('mousedown', function(e) {
  isResizingControl = true;
  document.body.style.cursor = 'ew-resize';
});
let resizeRaf = null;
function scheduleFitAndDraw() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;
    if (typeof fitAndDrawCanvases === 'function') fitAndDrawCanvases();
  });
}
window.addEventListener('mousemove', function(e) {
  if (!isResizingControl) return;
  let newWidth = window.innerWidth - e.clientX;
  newWidth = Math.max(320, Math.min(600, newWidth));
  wrapperControl.style.width = newWidth + 'px';

  // ОНОВЛЕНО: wrapper-main і wrapper-canvas займають залишок простору
  const wrapperMain = document.querySelector('.wrapper-main');
  const wrapperCanvas = document.getElementById('wrapper-canvas');
  wrapperMain.style.flex = '1 1 0%';
  wrapperMain.style.width = 'auto';
  wrapperCanvas.style.flex = '1 1 0%';
  wrapperCanvas.style.width = 'auto';

  // ОНОВЛЕНО: завжди ставимо right згідно з реальною шириною wrapperControl
  const actualWidth = parseFloat(getComputedStyle(wrapperControl).width);
  resizeControlBar.style.right = actualWidth + 'px';

  scheduleFitAndDraw();
});
window.addEventListener('mouseup', function() {
  isResizingControl = false;
  document.body.style.cursor = '';
});


const logItem1 = document.getElementById('log-item-1');
const logItem2 = document.getElementById('log-item-2');
const resizeLogBar = document.getElementById('resize-log-bar');
let isLogResizing = false;

if (resizeLogBar && logBody && logItem1 && logItem2) {
  resizeLogBar.addEventListener('mousedown', function(e) {
    isLogResizing = true;
    document.body.style.cursor = 'ew-resize';
  });
  window.addEventListener('mousemove', function(e) {
    if (!isLogResizing) return;
    const rect = logBody.getBoundingClientRect();
    let percent = ((e.clientX - rect.left) / rect.width) * 100;
    percent = Math.max(15, Math.min(85, percent));
    logItem1.style.width = percent + '%';
    logItem2.style.width = (100 - percent) + '%';
  });
  window.addEventListener('mouseup', function() {
    isLogResizing = false;
    document.body.style.cursor = '';
  });
}


const resizeLogVertical = document.getElementById('resize-log-vertical');
let isLogVResizing = false;
let startY = 0;
let startHeight = 0;

resizeLogVertical.addEventListener('mousedown', function(e) {
  isLogVResizing = true;
  document.body.style.cursor = 'ns-resize';
  startY = e.clientY;
  startHeight = logBody.offsetHeight;
});

window.addEventListener('mousemove', function(e) {
  if (!isLogVResizing) return;
  let delta = e.clientY - startY;
  let newHeight = startHeight - delta;
  newHeight = Math.max(100, Math.min(600, newHeight));
  logBody.style.height = newHeight + 'px';

  // ОНОВЛЕНО: wrapper-main і wrapper-canvas займають залишок простору по висоті
  const wrapperMain = document.querySelector('.wrapper-main');
  const wrapperCanvas = document.getElementById('wrapper-canvas');
  wrapperMain.style.flex = '1 1 0%';
  wrapperMain.style.height = 'auto';
  wrapperCanvas.style.flex = '1 1 0%';
  wrapperCanvas.style.height = 'auto';

  scheduleFitAndDraw();
});

window.addEventListener('mouseup', function() {
  isLogVResizing = false;
  document.body.style.cursor = '';
});

