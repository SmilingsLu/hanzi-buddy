/**
 * Mobile UI — bottom bar, bottom sheet (grade picker), swipe gestures.
 * Only active on viewports ≤768px.
 */
const MobileUI = (() => {
  const GRADE_NAMES = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'];
  const GRADE_ICONS = ['', '📘', '📗', '📙', '📕', '📒', '📘', '📖', '📖', '📖'];
  const SEM_NAMES = ['', '上册', '下册'];

  let _isMobile = false;
  let _sheetOpen = false;
  let _swipeStartX = 0;
  let _swipeStartY = 0;
  let _swiping = false;

  function isMobile() {
    return window.innerWidth <= 768;
  }

  /** Initialize mobile UI — call after AppController.init() */
  function init() {
    _isMobile = isMobile();
    if (!_isMobile) return;

    _bindBottomBar();
    _bindGradePicker();
    _bindSwipe();
    _updateGradeLabel();

    // Re-check on resize
    window.addEventListener('resize', () => {
      const wasMobile = _isMobile;
      _isMobile = isMobile();
      if (_isMobile && !wasMobile) {
        _updateGradeLabel();
      }
    });
  }

  /** Bind mobile bottom bar buttons to existing controllers */
  function _bindBottomBar() {
    const bar = document.getElementById('mobileBottomBar');
    if (!bar) return;

    document.getElementById('mbtnPrev').addEventListener('click', () => {
      const btnPrev = document.getElementById('btnPrev');
      if (btnPrev) btnPrev.click();
    });
    document.getElementById('mbtnNext').addEventListener('click', () => {
      const btnNext = document.getElementById('btnNext');
      if (btnNext) btnNext.click();
    });
    document.getElementById('mbtnFlip').addEventListener('click', () => {
      const btnFlip = document.getElementById('btnFlip');
      if (btnFlip) btnFlip.click();
    });
    document.getElementById('mbtnSpeak').addEventListener('click', () => {
      const btnSpeak = document.getElementById('btnSpeak');
      if (btnSpeak) btnSpeak.click();
    });
    document.getElementById('mbtnFav').addEventListener('click', () => {
      const favBtn = document.getElementById('favBtn');
      if (favBtn) favBtn.click();
    });
  }

  /** Bind grade picker button → opens bottom sheet */
  function _bindGradePicker() {
    const picker = document.getElementById('mobileGradePicker');
    const overlay = document.getElementById('mobileSheetOverlay');
    if (!picker || !overlay) return;

    picker.addEventListener('click', (e) => {
      e.stopPropagation();
      _openSheet();
    });

    // Close on overlay tap
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) _closeSheet();
    });
  }

  /** Open the bottom sheet with grade/semester options */
  function _openSheet() {
    const overlay = document.getElementById('mobileSheetOverlay');
    const content = document.getElementById('mobileSheetContent');
    if (!overlay || !content) return;

    const currentGrade = State.get('selectedGrade');
    const currentSem = State.get('selectedSemester');

    // Build sheet items
    let html = '';

    // Review section
    const favCount = FavoriteService.getAll().length;
    const errCount = ErrorBookService.getAll().length;
    html += `<div class="mobile-sheet-item" data-action="fav">
      <span class="mobile-sheet-item-icon">❤️</span>
      <span class="mobile-sheet-item-label">生词本</span>
      <span class="mobile-sheet-item-count">${favCount}</span>
    </div>`;
    html += `<div class="mobile-sheet-item" data-action="err">
      <span class="mobile-sheet-item-icon">📖</span>
      <span class="mobile-sheet-item-label">错题本</span>
      <span class="mobile-sheet-item-count">${errCount}</span>
    </div>`;
    html += `<div class="mobile-sheet-item" data-action="srs">
      <span class="mobile-sheet-item-icon">📈</span>
      <span class="mobile-sheet-item-label">智能复习</span>
      <span class="mobile-sheet-item-count">${typeof SpacedRepService !== 'undefined' ? SpacedRepService.getDueChars().length : 0}</span>
    </div>`;
    html += `<div class="mobile-sheet-item" data-action="badges">
      <span class="mobile-sheet-item-icon">🏆</span>
      <span class="mobile-sheet-item-label">成就墙</span>
    </div>`;
    html += '<div class="mobile-sheet-divider"></div>';

    // Grade/semester list
    for (let g = 1; g <= 9; g++) {
      for (let s = 1; s <= 2; s++) {
        const isActive = String(g) === String(currentGrade) && String(s) === String(currentSem);
        const activeClass = isActive ? ' active' : '';
        // Get character count for this grade/semester
        const allChars = State.get('allChars') || [];
        const count = allChars.filter(c => c.grade === g && c.semester === s).length;
        if (count === 0) continue; // Skip empty grades
        html += `<div class="mobile-sheet-item${activeClass}" data-grade="${g}" data-sem="${s}">
          <span class="mobile-sheet-item-icon">${GRADE_ICONS[g]}</span>
          <span class="mobile-sheet-item-label">${GRADE_NAMES[g]}${SEM_NAMES[s]}</span>
          <span class="mobile-sheet-item-count">${count}字</span>
        </div>`;
      }
    }

    content.innerHTML = html;

    // Bind click events on items
    content.querySelectorAll('.mobile-sheet-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (action === 'fav') {
          document.getElementById('btnFavorites').click();
          _closeSheet();
          return;
        }
        if (action === 'err') {
          document.getElementById('btnErrorBook').click();
          _closeSheet();
          return;
        }
        if (action === 'srs') {
          // Trigger SRS sidebar item click
          const srsItem = document.querySelector('.sidebar-item[data-grade="srs"]');
          if (srsItem) srsItem.click();
          _closeSheet();
          return;
        }
        if (action === 'badges') {
          document.getElementById('btnBadges').click();
          _closeSheet();
          return;
        }

        const grade = item.dataset.grade;
        const sem = item.dataset.sem;
        if (grade && sem) {
          // Simulate sidebar click
          const sidebarItem = document.querySelector(`.sidebar-item[data-grade="${grade}"][data-sem="${sem}"]`);
          if (sidebarItem) {
            sidebarItem.click();
          } else {
            // Fallback: directly set state and refresh
            State.set('selectedGrade', grade);
            State.set('selectedSemester', sem);
            DataService.applyFilter('all');
            if (typeof LearnController !== 'undefined') LearnController.show();
          }
          _updateGradeLabel();
          _closeSheet();
        }
      });
    });

    overlay.classList.remove('hidden');
    _sheetOpen = true;
  }

  /** Close bottom sheet */
  function _closeSheet() {
    const overlay = document.getElementById('mobileSheetOverlay');
    if (overlay) overlay.classList.add('hidden');
    _sheetOpen = false;
  }

  /** Update the grade label in the header */
  function _updateGradeLabel() {
    const label = document.getElementById('mobileGradeLabel');
    if (!label) return;
    const g = parseInt(State.get('selectedGrade')) || 1;
    const s = parseInt(State.get('selectedSemester')) || 1;
    label.textContent = `${GRADE_ICONS[g]} ${GRADE_NAMES[g]}${SEM_NAMES[s]}`;
  }

  /** Bind swipe gestures on the card */
  function _bindSwipe() {
    const card = document.getElementById('cardContainer');
    if (!card) return;

    card.addEventListener('touchstart', (e) => {
      if (!_isMobile) return;
      const touch = e.touches[0];
      _swipeStartX = touch.clientX;
      _swipeStartY = touch.clientY;
      _swiping = true;
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
      if (!_isMobile || !_swiping) return;
      _swiping = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - _swipeStartX;
      const dy = touch.clientY - _swipeStartY;

      // Only trigger if horizontal swipe > 50px and more horizontal than vertical
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) {
          // Swipe right → previous
          const btnPrev = document.getElementById('btnPrev');
          if (btnPrev) btnPrev.click();
        } else {
          // Swipe left → next
          const btnNext = document.getElementById('btnNext');
          if (btnNext) btnNext.click();
        }
      }
    }, { passive: true });
  }

  /** Call this whenever grade/semester changes (from sidebar too) */
  function onGradeChange() {
    if (_isMobile) _updateGradeLabel();
  }

  return { init, onGradeChange, isMobile };
})();
