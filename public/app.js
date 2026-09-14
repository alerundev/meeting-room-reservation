// State
let rooms = [];
let reservations = [];
let selectedDate = new Date().toISOString().split('T')[0];
let activeView = 'timeline'; // 'timeline' | 'list' | 'my'
let activeReservationForDetail = null;

// Time slots: 08:00 to 20:00 (12 hours)
const START_HOUR = 8;
const END_HOUR = 20;

// DOM Elements
const currentDateInput = document.getElementById('current-date-input');
const displayDateStr = document.getElementById('display-date-str');
const roomFilter = document.getElementById('room-filter');
const roomSummaryCards = document.getElementById('room-summary-cards');
const timetableWrapper = document.getElementById('timetable-wrapper');
const reservationsListContainer = document.getElementById('reservations-list-container');
const listCountBadge = document.getElementById('list-count-badge');
const myReservationsContainer = document.getElementById('my-reservations-container');
const myNameFilter = document.getElementById('my-name-filter');
const alertBanner = document.getElementById('alert-banner');

// Modals
const modalReserve = document.getElementById('modal-reserve');
const modalRoom = document.getElementById('modal-room');
const modalDetail = document.getElementById('modal-detail');

// Forms
const formReserve = document.getElementById('form-reserve');
const formRoom = document.getElementById('form-room');
const reserveModalError = document.getElementById('reserve-modal-error');
const reserveModalErrorText = document.getElementById('reserve-modal-error-text');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  currentDateInput.value = selectedDate;
  updateDateDisplay(selectedDate);

  // Setup Event Listeners
  setupEventListeners();

  // Initial Data Fetch
  loadAllData();
});

function setupEventListeners() {
  // Date changes
  currentDateInput.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    updateDateDisplay(selectedDate);
    loadReservations();
  });

  document.getElementById('btn-today').addEventListener('click', () => {
    selectedDate = new Date().toISOString().split('T')[0];
    currentDateInput.value = selectedDate;
    updateDateDisplay(selectedDate);
    loadReservations();
  });

  document.getElementById('btn-prev-day').addEventListener('click', () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    selectedDate = d.toISOString().split('T')[0];
    currentDateInput.value = selectedDate;
    updateDateDisplay(selectedDate);
    loadReservations();
  });

  document.getElementById('btn-next-day').addEventListener('click', () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    selectedDate = d.toISOString().split('T')[0];
    currentDateInput.value = selectedDate;
    updateDateDisplay(selectedDate);
    loadReservations();
  });

  // Room filter
  roomFilter.addEventListener('change', () => {
    renderTimetable();
    renderList();
  });

  // View switches
  const timelineBtn = document.getElementById('view-timeline-btn');
  const listBtn = document.getElementById('view-list-btn');
  const myBtn = document.getElementById('view-my-btn');

  timelineBtn.addEventListener('click', () => switchView('timeline'));
  listBtn.addEventListener('click', () => switchView('list'));
  myBtn.addEventListener('click', () => switchView('my'));

  // Search my reservations
  document.getElementById('btn-search-my').addEventListener('click', () => {
    renderMyReservations();
  });
  myNameFilter.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') renderMyReservations();
  });

  // Modal Triggers
  document.getElementById('btn-open-reserve-modal').addEventListener('click', () => {
    openReserveModal();
  });
  document.getElementById('btn-close-reserve-modal').addEventListener('click', () => {
    closeReserveModal();
  });
  document.getElementById('btn-cancel-reserve').addEventListener('click', () => {
    closeReserveModal();
  });

  document.getElementById('btn-open-room-modal').addEventListener('click', () => {
    modalRoom.classList.remove('hidden');
  });
  document.getElementById('btn-close-room-modal').addEventListener('click', () => {
    modalRoom.classList.add('hidden');
  });
  document.getElementById('btn-cancel-room').addEventListener('click', () => {
    modalRoom.classList.add('hidden');
  });

  document.getElementById('btn-close-detail-modal').addEventListener('click', () => {
    modalDetail.classList.add('hidden');
  });
  document.getElementById('btn-ok-detail').addEventListener('click', () => {
    modalDetail.classList.add('hidden');
  });

  document.getElementById('btn-delete-from-detail').addEventListener('click', () => {
    if (activeReservationForDetail) {
      deleteReservation(activeReservationForDetail.id);
      modalDetail.classList.add('hidden');
    }
  });

  // Form Submissions
  formReserve.addEventListener('submit', handleReserveSubmit);
  formRoom.addEventListener('submit', handleRoomSubmit);
}

function switchView(view) {
  activeView = view;
  const views = ['timeline', 'list', 'my'];
  views.forEach((v) => {
    const sec = document.getElementById(`section-${v}`);
    const btn = document.getElementById(`view-${v}-btn`);
    if (v === view) {
      sec.classList.remove('hidden');
      btn.className = 'px-3 py-1.5 rounded-md bg-white text-indigo-700 font-semibold shadow-xs transition';
    } else {
      sec.classList.add('hidden');
      btn.className = 'px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 transition';
    }
  });

  if (view === 'my') {
    renderMyReservations();
  }
}

function updateDateDisplay(dateStr) {
  const parts = dateStr.split('-');
  const dateObj = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[dateObj.getDay()];
  displayDateStr.textContent = `${parts[0]}년 ${parts[1]}월 ${parts[2]}일 (${dayName})`;
}

// API Calls
async function loadAllData() {
  await loadRooms();
  await loadReservations();
}

async function loadRooms() {
  try {
    const res = await fetch('/api/rooms');
    if (!res.ok) throw new Error('회의실 정보를 불러오지 못했습니다.');
    rooms = await res.json();
    populateRoomSelects();
    renderRoomCards();
  } catch (err) {
    showAlert('error', err.message);
  }
}

async function loadReservations() {
  try {
    const res = await fetch(`/api/reservations?date=${selectedDate}`);
    if (!res.ok) throw new Error('예약 목록을 불러오지 못했습니다.');
    reservations = await res.json();
    renderTimetable();
    renderList();
    if (activeView === 'my') {
      renderMyReservations();
    }
  } catch (err) {
    showAlert('error', err.message);
  }
}

function populateRoomSelects() {
  // Room filter dropdown
  const currentVal = roomFilter.value;
  roomFilter.innerHTML = '<option value="all">전체 회의실</option>';
  rooms.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.name} (${r.capacity}인)`;
    roomFilter.appendChild(opt);
  });
  if (currentVal) roomFilter.value = currentVal;

  // Reservation modal room dropdown
  const reserveRoomSelect = document.getElementById('reserve-room-id');
  reserveRoomSelect.innerHTML = '<option value="">회의실을 선택하세요</option>';
  rooms.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.name} (${r.location} / 최대 ${r.capacity}명)`;
    reserveRoomSelect.appendChild(opt);
  });
}

function renderRoomCards() {
  roomSummaryCards.innerHTML = '';
  rooms.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-300 transition flex flex-col justify-between';
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-800 truncate">${escapeHtml(r.name)}</span>
          <span class="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">${r.capacity}인</span>
        </div>
        <p class="text-[11px] text-slate-500 mt-1 truncate"><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>${escapeHtml(r.location)}</p>
      </div>
      <button onclick="quickReserveForRoom(${r.id})" class="mt-2 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold text-left flex items-center gap-1">
        <i class="fa-regular fa-calendar-plus text-xs"></i> 예약하기
      </button>
    `;
    roomSummaryCards.appendChild(card);
  });
}

function renderTimetable() {
  const filteredRooms = roomFilter.value === 'all' 
    ? rooms 
    : rooms.filter(r => r.id === parseInt(roomFilter.value, 10));

  if (filteredRooms.length === 0) {
    timetableWrapper.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <i class="fa-regular fa-calendar-xmark text-3xl mb-2"></i>
        <p class="text-sm">등록된 회의실이 없습니다.</p>
      </div>
    `;
    return;
  }

  // Build grid header
  let headerHtml = `<div class="timetable-grid rounded-t-xl border border-slate-200 overflow-hidden font-medium text-xs text-slate-500 bg-slate-50">
    <div class="p-3 font-semibold text-slate-700 bg-slate-100 flex items-center">회의실 / 시간</div>`;
  
  for (let h = START_HOUR; h < END_HOUR; h++) {
    const timeLabel = `${h.toString().padStart(2, '0')}:00`;
    headerHtml += `<div class="p-3 text-center border-l border-slate-200 font-mono">${timeLabel}</div>`;
  }
  headerHtml += `</div>`;

  // Build rows
  let rowsHtml = `<div class="border-x border-b border-slate-200 rounded-b-xl overflow-hidden divide-y divide-slate-200">`;

  filteredRooms.forEach((room) => {
    const roomReservations = reservations.filter(res => res.room_id === room.id);

    rowsHtml += `
      <div class="timetable-grid relative bg-white">
        <!-- Room Info Column -->
        <div class="p-3 bg-slate-50/50 flex flex-col justify-center border-r border-slate-200">
          <div class="font-bold text-xs text-slate-900 truncate" title="${escapeHtml(room.name)}">${escapeHtml(room.name)}</div>
          <div class="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
            <span>${escapeHtml(room.location)}</span>
            <span class="text-slate-300">•</span>
            <span>${room.capacity}명</span>
          </div>
        </div>

        <!-- 12 Hours Slot Cells -->
    `;

    for (let h = START_HOUR; h < END_HOUR; h++) {
      const slotTimeStr = `${h.toString().padStart(2, '0')}:00`;
      rowsHtml += `
        <div class="time-slot-cell border-r border-slate-100 flex items-center justify-center cursor-pointer group"
             onclick="quickSlotReserve(${room.id}, '${slotTimeStr}')"
             title="${escapeHtml(room.name)} ${slotTimeStr} 예약">
          <span class="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-500 font-medium transition">
            <i class="fa-solid fa-plus"></i>
          </span>
        </div>
      `;
    }

    // Reservation Overlay Blocks
    roomReservations.forEach((res) => {
      const start = new Date(res.start_time);
      const end = new Date(res.end_time);

      const startHours = start.getHours() + start.getMinutes() / 60;
      const endHours = end.getHours() + end.getMinutes() / 60;

      // Check bounds
      if (endHours <= START_HOUR || startHours >= END_HOUR) return;

      const effectiveStart = Math.max(startHours, START_HOUR);
      const effectiveEnd = Math.min(endHours, END_HOUR);

      const totalHours = END_HOUR - START_HOUR; // 12
      const leftPercent = ((effectiveStart - START_HOUR) / totalHours) * 100;
      const widthPercent = ((effectiveEnd - effectiveStart) / totalHours) * 100;

      // Color palette based on reservation ID
      const colors = [
        'bg-indigo-500 hover:bg-indigo-600 text-white',
        'bg-sky-600 hover:bg-sky-700 text-white',
        'bg-emerald-600 hover:bg-emerald-700 text-white',
        'bg-violet-600 hover:bg-violet-700 text-white',
        'bg-amber-600 hover:bg-amber-700 text-white',
      ];
      const colorClass = colors[res.id % colors.length];

      const startTimeStr = formatTime(res.start_time);
      const endTimeStr = formatTime(res.end_time);

      rowsHtml += `
        <div class="absolute top-1.5 bottom-1.5 rounded-lg shadow-sm px-2 py-1 flex flex-col justify-center cursor-pointer reservation-block ${colorClass} z-10 overflow-hidden"
             style="left: calc(140px + (100% - 140px) * ${leftPercent / 100}); width: calc((100% - 140px) * ${widthPercent / 100} - 2px);"
             onclick="openDetailModal(${res.id})">
          <div class="font-bold text-[11px] leading-tight truncate">${escapeHtml(res.title)}</div>
          <div class="text-[9px] opacity-90 truncate leading-tight mt-0.5">
            ${escapeHtml(res.reserver_name)} (${startTimeStr}~${endTimeStr})
          </div>
        </div>
      `;
    });

    rowsHtml += `</div>`;
  });

  rowsHtml += `</div>`;
  timetableWrapper.innerHTML = headerHtml + rowsHtml;
}

function renderList() {
  const filteredReservations = reservations.filter((r) => {
    if (roomFilter.value === 'all') return true;
    return r.room_id === parseInt(roomFilter.value, 10);
  });

  listCountBadge.textContent = `${filteredReservations.length}건`;

  if (filteredReservations.length === 0) {
    reservationsListContainer.innerHTML = `
      <div class="p-8 text-center text-slate-400">
        <i class="fa-regular fa-calendar-check text-4xl mb-2 text-slate-300"></i>
        <p class="text-sm">선택한 조건의 예약 내역이 없습니다.</p>
      </div>
    `;
    return;
  }

  reservationsListContainer.innerHTML = '';
  filteredReservations.forEach((res) => {
    const item = document.createElement('div');
    item.className = 'p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition';
    item.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center space-x-2">
          <span class="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-100">${escapeHtml(res.room_name)}</span>
          <h4 class="font-bold text-sm text-slate-900">${escapeHtml(res.title)}</h4>
        </div>
        <div class="flex flex-wrap items-center text-xs text-slate-500 gap-x-3 gap-y-1 pt-0.5">
          <span><i class="fa-regular fa-clock text-slate-400 mr-1"></i>${formatTime(res.start_time)} ~ ${formatTime(res.end_time)}</span>
          <span><i class="fa-regular fa-user text-slate-400 mr-1"></i>${escapeHtml(res.reserver_name)}</span>
          <span><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>${escapeHtml(res.room_location)}</span>
          ${res.memo ? `<span class="italic text-slate-400">"${escapeHtml(res.memo)}"</span>` : ''}
        </div>
      </div>
      <div class="flex items-center space-x-2 self-end sm:self-center">
        <button onclick="openDetailModal(${res.id})" class="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">상세</button>
        <button onclick="deleteReservation(${res.id})" class="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition border border-red-200">취소</button>
      </div>
    `;
    reservationsListContainer.appendChild(item);
  });
}

function renderMyReservations() {
  const queryName = (myNameFilter.value || '').trim().toLowerCase();

  let list = reservations;
  if (queryName) {
    list = reservations.filter(r => r.reserver_name.toLowerCase().includes(queryName));
  }

  if (list.length === 0) {
    myReservationsContainer.innerHTML = `
      <div class="p-8 text-center text-slate-400">
        <i class="fa-solid fa-magnifying-glass text-3xl mb-2 text-slate-300"></i>
        <p class="text-sm">일치하는 예약 내역이 없습니다.</p>
        <p class="text-xs text-slate-400 mt-1">예약자명을 확인하거나 다른 날짜를 선택해보세요.</p>
      </div>
    `;
    return;
  }

  myReservationsContainer.innerHTML = '';
  list.forEach((res) => {
    const item = document.createElement('div');
    item.className = 'p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition';
    item.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center space-x-2">
          <span class="px-2 py-0.5 text-xs font-bold rounded bg-indigo-100 text-indigo-800">${escapeHtml(res.room_name)}</span>
          <h4 class="font-bold text-sm text-slate-900">${escapeHtml(res.title)}</h4>
        </div>
        <div class="flex flex-wrap items-center text-xs text-slate-500 gap-x-3 gap-y-1 pt-0.5">
          <span><i class="fa-regular fa-clock text-slate-400 mr-1"></i>${formatTime(res.start_time)} ~ ${formatTime(res.end_time)}</span>
          <span><i class="fa-regular fa-user text-slate-400 mr-1"></i>${escapeHtml(res.reserver_name)}</span>
          ${res.memo ? `<span class="italic text-slate-400">"${escapeHtml(res.memo)}"</span>` : ''}
        </div>
      </div>
      <button onclick="deleteReservation(${res.id})" class="self-end sm:self-center px-3.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition border border-red-200">
        <i class="fa-regular fa-trash-can mr-1"></i> 예약 취소
      </button>
    `;
    myReservationsContainer.appendChild(item);
  });
}

// Modal actions
function openReserveModal(prefill = {}) {
  reserveModalError.classList.add('hidden');
  formReserve.reset();

  document.getElementById('reserve-date').value = prefill.date || selectedDate;
  if (prefill.roomId) {
    document.getElementById('reserve-room-id').value = prefill.roomId;
  }
  if (prefill.startTime) {
    document.getElementById('reserve-start-time').value = prefill.startTime;
    // default 1 hour later
    const [h, m] = prefill.startTime.split(':').map(Number);
    const endH = Math.min(h + 1, 23).toString().padStart(2, '0');
    document.getElementById('reserve-end-time').value = `${endH}:${m.toString().padStart(2, '0')}`;
  } else {
    document.getElementById('reserve-start-time').value = '10:00';
    document.getElementById('reserve-end-time').value = '11:00';
  }

  modalReserve.classList.remove('hidden');
}

function closeReserveModal() {
  modalReserve.classList.add('hidden');
}

function quickReserveForRoom(roomId) {
  openReserveModal({ roomId });
}

function quickSlotReserve(roomId, timeStr) {
  openReserveModal({ roomId, startTime: timeStr, date: selectedDate });
}

function openDetailModal(reservationId) {
  const res = reservations.find(r => r.id === reservationId);
  if (!res) return;

  activeReservationForDetail = res;
  const detailBody = document.getElementById('detail-modal-body');
  detailBody.innerHTML = `
    <h3 class="font-bold text-base text-slate-900">${escapeHtml(res.title)}</h3>
    <div class="space-y-2 text-xs text-slate-600">
      <div class="flex justify-between border-b border-slate-100 py-1.5">
        <span class="text-slate-400">회의실</span>
        <span class="font-semibold text-slate-800">${escapeHtml(res.room_name)} (${escapeHtml(res.room_location)})</span>
      </div>
      <div class="flex justify-between border-b border-slate-100 py-1.5">
        <span class="text-slate-400">예약 일자</span>
        <span class="font-semibold text-slate-800">${formatDate(res.start_time)}</span>
      </div>
      <div class="flex justify-between border-b border-slate-100 py-1.5">
        <span class="text-slate-400">예약 시간</span>
        <span class="font-semibold text-indigo-600">${formatTime(res.start_time)} ~ ${formatTime(res.end_time)}</span>
      </div>
      <div class="flex justify-between border-b border-slate-100 py-1.5">
        <span class="text-slate-400">예약자</span>
        <span class="font-semibold text-slate-800">${escapeHtml(res.reserver_name)}</span>
      </div>
      ${res.memo ? `
      <div class="py-1.5">
        <span class="text-slate-400 block mb-1">메모</span>
        <p class="p-2.5 bg-slate-50 rounded-lg text-slate-700 leading-relaxed">${escapeHtml(res.memo)}</p>
      </div>` : ''}
    </div>
  `;

  modalDetail.classList.remove('hidden');
}

// Handlers
async function handleReserveSubmit(e) {
  e.preventDefault();
  reserveModalError.classList.add('hidden');

  const roomId = parseInt(document.getElementById('reserve-room-id').value, 10);
  const title = document.getElementById('reserve-title').value.trim();
  const reserverName = document.getElementById('reserve-name').value.trim();
  const dateStr = document.getElementById('reserve-date').value;
  const startTime = document.getElementById('reserve-start-time').value;
  const endTime = document.getElementById('reserve-end-time').value;
  const memo = document.getElementById('reserve-memo').value.trim();

  if (!startTime || !endTime) {
    showReserveError('시작 시간과 종료 시간을 모두 입력해주세요.');
    return;
  }

  const startIso = new Date(`${dateStr}T${startTime}:00`).toISOString();
  const endIso = new Date(`${dateStr}T${endTime}:00`).toISOString();

  if (new Date(endIso) <= new Date(startIso)) {
    showReserveError('종료 시간은 시작 시간보다 이후여야 합니다.');
    return;
  }

  const payload = {
    room_id: roomId,
    title,
    reserver_name: reserverName,
    start_time: startIso,
    end_time: endIso,
    memo,
  };

  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      showReserveError(data.error || '예약 생성 중 오류가 발생했습니다.');
      return;
    }

    closeReserveModal();
    showAlert('success', '회의실 예약이 완료되었습니다!');
    
    // Switch to the date of newly created reservation if different
    if (selectedDate !== dateStr) {
      selectedDate = dateStr;
      currentDateInput.value = selectedDate;
      updateDateDisplay(selectedDate);
    }
    await loadReservations();
  } catch (err) {
    showReserveError(err.message || '네트워크 오류가 발생했습니다.');
  }
}

function showReserveError(msg) {
  reserveModalErrorText.textContent = msg;
  reserveModalError.classList.remove('hidden');
}

async function handleRoomSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('room-name').value.trim();
  const capacity = parseInt(document.getElementById('room-capacity').value, 10);
  const location = document.getElementById('room-location').value.trim();
  const description = document.getElementById('room-desc').value.trim();

  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, capacity, location, description }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '회의실 생성 실패');
      return;
    }

    modalRoom.classList.add('hidden');
    formRoom.reset();
    showAlert('success', `새 회의실 '${name}'이 등록되었습니다.`);
    await loadRooms();
    renderTimetable();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteReservation(id) {
  if (!confirm('정말로 이 예약을 취소하시겠습니까?')) return;

  try {
    const res = await fetch(`/api/reservations/${id}`, {
      method: 'DELETE',
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert('error', data.error || '예약 취소 실패');
      return;
    }

    showAlert('success', '예약이 성공적으로 취소되었습니다.');
    await loadReservations();
  } catch (err) {
    showAlert('error', err.message);
  }
}

// Helpers
function showAlert(type, message) {
  const isSuccess = type === 'success';
  alertBanner.className = `p-4 rounded-xl flex items-center space-x-3 text-sm font-medium ${
    isSuccess ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
  }`;
  alertBanner.innerHTML = `
    <i class="fa-solid ${isSuccess ? 'fa-circle-check text-emerald-500' : 'fa-circle-exclamation text-red-500'}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  alertBanner.classList.remove('hidden');

  setTimeout(() => {
    alertBanner.classList.add('hidden');
  }, 4000);
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
