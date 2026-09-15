const form = document.querySelector('#bookingForm');
const list = document.querySelector('#reservationList');
const notice = document.querySelector('#notice');
const dateFilter = document.querySelector('#dateFilter');
const roomSelect = document.querySelector('#roomId');

function localDateString(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
dateFilter.value = localDateString();

function showNotice(message, type = 'success') {
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;
  window.setTimeout(() => { notice.hidden = true; }, 4500);
}
function formatTime(value) { return new Date(value).toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit', hour12:false }); }
function formatDate(value) { return new Date(value).toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' }); }

async function loadRooms() {
  const rooms = await (await fetch('/api/rooms')).json();
  roomSelect.insertAdjacentHTML('beforeend', rooms.map((room) => `<option value="${room.id}">${room.name} · 최대 ${room.capacity}명</option>`).join(''));
}
async function loadReservations() {
  list.innerHTML = '<div class="empty">예약을 불러오는 중입니다...</div>';
  const response = await fetch(`/api/reservations?date=${encodeURIComponent(dateFilter.value)}`);
  const reservations = await response.json();
  if (!reservations.length) { list.innerHTML = '<div class="empty">선택한 날짜에 예약이 없습니다.<br />새 예약을 만들어 보세요.</div>'; return; }
  list.innerHTML = reservations.map((item) => `<article class="reservation"><div class="time">${formatDate(item.startAt)}<br /><strong>${formatTime(item.startAt)} – ${formatTime(item.endAt)}</strong></div><div class="reservation-info"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.reserverName)} · ${escapeHtml(item.email)}</p></div><div><span class="room-tag">${escapeHtml(item.roomName)}</span><br /><button class="cancel" data-id="${item.id}">예약 취소</button></div></article>`).join('');
  document.querySelectorAll('.cancel').forEach((button) => button.addEventListener('click', cancelReservation));
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
async function cancelReservation(event) {
  if (!window.confirm('이 예약을 취소할까요?')) return;
  const response = await fetch(`/api/reservations/${event.currentTarget.dataset.id}`, { method:'DELETE' });
  if (!response.ok) { showNotice('예약 취소에 실패했습니다.', 'error'); return; }
  showNotice('예약이 취소되었습니다.');
  loadReservations();
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const response = await fetch('/api/reservations', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) { showNotice(result.error || '예약 생성에 실패했습니다.', 'error'); return; }
  showNotice('예약이 등록되었습니다.');
  form.reset();
  dateFilter.value = localDateString(new Date(result.startAt));
  loadReservations();
});
dateFilter.addEventListener('change', loadReservations);
Promise.all([loadRooms(), loadReservations()]).catch(() => showNotice('서버와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error'));