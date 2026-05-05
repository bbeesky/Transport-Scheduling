// ================= CONFIG =================
const API_URL = "https://script.google.com/macros/s/AKfycbyHvf_cMSACXF9k--tYCAsmy6qWBaZdcRrU5LnD5d0EeZJK9XTM-xmUBj-0hBci734/exec";

const LIMIT = {
  driver: 1,
  helper: 2
};

// ================= AREAS =================
let employees = [];
let assignments = {};
let areas = [];              // 🔥 เปลี่ยนจาก const → let
let selectedDate = "";
let isSaving = false;
let removeMode = false;
let isFirstLoad = true;
let selectedEmpId = null;
const DEFAULT_AREAS = [];

function getAvatar(url, name) {
  if (!url) {
    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name);
  }

  // 🔥 แปลง Drive → thumbnail (เร็วกว่า)
  if (url.includes("drive.google.com")) {
    const match = url.match(/id=([^&]+)/);
    if (match) {
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200`;
    }
  }

  return url;
}


function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')   // ลบช่องว่าง
    .replace(/[^\u0E00-\u0E7Fa-z0-9]/g, ''); // เอาเฉพาะ ไทย + eng + ตัวเลข
}

function fuzzyMatch(keyword, text) {
  keyword = normalizeText(keyword);
  text = normalizeText(text);

  // ✅ match ปกติ
  if (text.includes(keyword)) return true;

  // ✅ match แบบเรียงตัวอักษร (fuzzy)
  let i = 0;
  for (let char of text) {
    if (char === keyword[i]) i++;
    if (i === keyword.length) return true;
  }

  return false;
}
function populateEmployeeSearch() {
  const input = document.getElementById("employeeSearch");
  const list = document.getElementById("employeeList");

  function render(keyword = "") {
    const assigned = getAllAssigned();

    const filtered = employees.filter(e =>
      !assigned.has(e.id) &&
      (
        fuzzyMatch(keyword, e.th) ||
        fuzzyMatch(keyword, e.en)
      )
    );

    list.innerHTML = filtered.map(e => `
      <div onclick="selectEmployee(${e.id})"
        class="flex items-center gap-2 px-2 py-2 hover:bg-slate-100 cursor-pointer border-b">

        <img 
            src="${getAvatar(e.avatar, e.th)}"
            onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(e.th)}'"
          class="w-8 h-8 rounded-full object-cover">

        <div class="text-left">
          <div class="text-xs font-semibold">${e.th}</div>
          <div class="text-[10px] text-gray-500">${e.en}</div>
        </div>
      </div>
    `).join('');
  }

  input.addEventListener("input", e => {
    render(e.target.value);
  });

  render();
}

function selectEmployee(id) {
  selectedEmpId = id;

  const emp = getEmp(id);

  document.getElementById("employeeSearch").value = emp.th;
  document.getElementById("employeeList").innerHTML = "";
}

function addNewEmployee() {
  const name = document.getElementById("employeeSearch").value.trim();

  if (!name) {
    Swal.fire({ icon: 'warning', title: 'กรอกชื่อก่อน' });
    return;
  }

  const newEmp = {
    id: Date.now(),
    th: name,
    en: name,
    avatar: ""
  };

  employees.push(newEmp);
  selectedEmpId = newEmp.id;

showToast("เพิ่มพนักงานแล้ว");
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  initDate();
  loadData();
  setInterval(() => {
  if (!isSaving) loadData();
}, 5000);
});

// ================= DATE =================
function initDate() {
  const today = new Date();

  selectedDate = today.toISOString().split('T')[0];

  document.getElementById('dateDisplay').textContent =
    today.toLocaleDateString('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

  document.getElementById('workDate').value = selectedDate;

  // 👇 เมื่อเปลี่ยนวันที่
  document.getElementById('workDate').addEventListener('change', (e) => {
    selectedDate = e.target.value;
    loadData();
  });
}

function showLoading(msg = "กำลังโหลด...") {
  Swal.fire({
    title: msg,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });
}

function hideLoading() {
  Swal.close();
}

// ================= API =================
async function loadData() {
  const res = await fetch(API_URL + "?t=" + Date.now());
  const data = await res.json();

  employees = data.employees || [];

  const day = data.assignments[selectedDate];

  if (!day) {
    areas = [];
    assignments = {};
  } else {
    areas = day.areas || [];
    assignments = day.assignments || {};
  }

  render();
}

async function saveData() {
  try {
    const payload = {
      date: selectedDate,
      areas,
      assignments
    };

    const url =
      API_URL +
      "?action=save&data=" +
      encodeURIComponent(JSON.stringify(payload));

    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== "success") {
      throw new Error(json.message || "Save failed");
    }

  showToast("บันทึกสำเร็จ");

  } catch (err) {
  showToast("❌ บันทึกไม่สำเร็จ");
  }
}

function openAreaManager() {
  renderAreaManager();
}

function areaRowHTML(a, i) {
  return `
    <div class="area-row-item" data-index="${i}" 
         style="display:flex;gap:6px;margin-bottom:6px">

      <input class="area-code" value="${a.code}" 
        style="flex:1;padding:4px;border:1px solid #ddd;border-radius:4px">

      <input class="area-name" value="${a.name}" 
        style="flex:2;padding:4px;border:1px solid #ddd;border-radius:4px">

      <!-- 🔥 สี 2 ตัวเลือก -->
      <select class="area-color" style="padding:4px;border-radius:4px">
        <option value="#3b82f6" ${a.color === "#3b82f6" ? "selected" : ""}>🔵 น้ำเงิน</option>
        <option value="#ef4444" ${a.color === "#ef4444" ? "selected" : ""}>🔴 แดง</option>
      </select>

      <button onclick="removeAreaRow(${i})"
        style="background:#ef4444;color:white;border-radius:4px;padding:4px 6px">
        ❌
      </button>
    </div>
  `;
}

function renderAreaManager() {
  let html = `
    <div id="areaList" style="max-height:300px;overflow:auto;text-align:left">
      ${areas.map((a, i) => areaRowHTML(a, i)).join('')}
    </div>

    <button onclick="addAreaRow()" 
      style="margin-top:10px;padding:6px 10px;border-radius:6px;background:#3b82f6;color:white;font-size:12px">
      + เพิ่มพื้นที่
    </button>
  `;

  Swal.fire({
    title: "จัดการพื้นที่",
    html: html,
    confirmButtonText: "บันทึก",
    width: 500,
    didOpen: () => attachAreaEvents()
  }).then(() => {
    saveAreaFromUI();
    render();
    saveData();
  });
}

function addAreaRow() {
  const list = document.getElementById("areaList");

  const i = Date.now();

  const div = document.createElement("div");
  div.className = "area-row-item";
  div.style = "display:flex;gap:6px;margin-bottom:6px";

  div.innerHTML = `
    <input class="area-code" placeholder="CODE" 
      style="flex:1;padding:4px;border:1px solid #ddd;border-radius:4px">

    <input class="area-name" placeholder="ชื่อพื้นที่" 
      style="flex:2;padding:4px;border:1px solid #ddd;border-radius:4px">

    <select class="area-color" style="padding:4px;border-radius:4px">
      <option value="#3b82f6">🟦 น้ำเงิน</option>
      <option value="#ef4444">🟥 แดง</option>
    </select>

    <button onclick="this.parentElement.remove()"
      style="background:#ef4444;color:white;border-radius:4px;padding:4px 6px">
      ❌
    </button>
  `;

  list.appendChild(div);
}

function saveAreaFromUI() {
  const rows = document.querySelectorAll(".area-row-item");

  const newAreas = [];

  rows.forEach(row => {
    const code = row.querySelector(".area-code").value.trim();
    const name = row.querySelector(".area-name").value.trim();
    const color = row.querySelector(".area-color").value;

    if (!code || !name) return;

    newAreas.push({ code, name, color });

    // 🔥 ensure assignment
    if (!assignments[code]) {
      assignments[code] = {
        driver: [null],
        helper: Array(6).fill(null)
      };
    }
  });

  areas = newAreas;
}

function attachAreaEvents() {
  // เผื่ออนาคต (ตอนนี้ยังไม่ต้องใช้)
}

function removeAreaRow(index) {
  areas.splice(index, 1);
  renderAreaManager();
}

function addArea() {
  areas.push({
    code: "A" + Date.now(),
    name: "พื้นที่ใหม่",
    color: "#64748b"
  });
  openAreaManager();
}
function removeArea(index) {
  const code = areas[index].code;

  delete assignments[code];
  areas.splice(index, 1);

  openAreaManager();
}
// ================= UTIL =================
function getEmp(id) {
  return employees.find(e => e.id === id);
}

function getInitials(e) {
  return e.en?.substring(0, 2).toUpperCase() || "NA";
}

function getAllAssigned() {
  const s = new Set();
  Object.values(assignments).forEach(a => {
    a.driver.forEach(id => s.add(id));
    a.helper.forEach(id => s.add(id));
  });
  return s;
}

// ================= RENDER =================
function getAllAssignedSafe() {
  const set = new Set();

  Object.values(assignments).forEach(area => {
    if (!area) return;

    [...(area.driver || []), ...(area.helper || [])]
      .forEach(id => {
        if (id != null) set.add(id);
      });
  });

  return set;
}

function render() {
  const body = document.getElementById('boardBody');
  if (!body) return;

  body.innerHTML = '';

  let totalDrivers = 0;
  let totalHelpers = 0;

  // ================= NO AREAS =================
  if (!Array.isArray(areas) || !areas.length) {
    body.innerHTML = `<div class="p-4 text-center text-gray-400">ไม่มีพื้นที่</div>`;
    return;
  }

  // ================= INIT =================
  areas.forEach(area => {
    if (!assignments[area.code]) {
      assignments[area.code] = {
        driver: [null],
        helper: Array(6).fill(null)
      };
    }

    // กันเพี้ยน
    if (!Array.isArray(assignments[area.code].driver)) {
      assignments[area.code].driver = [null];
    }

    if (!Array.isArray(assignments[area.code].helper)) {
      assignments[area.code].helper = Array(6).fill(null);
    }

    // fix helper = 6 ช่อง
    assignments[area.code].helper =
      assignments[area.code].helper.slice(0, 6);

    while (assignments[area.code].helper.length < 6) {
      assignments[area.code].helper.push(null);
    }
  });

  // ================= RENDER =================
  areas.forEach(area => {
    const data = assignments[area.code];

    // ✅ FIX: นับจาก id ตรงๆ
    const d = new Set(
      data.driver.filter(id => id != null)
    ).size;

    const h = new Set(
      data.helper.filter(id => id != null)
    ).size;

    totalDrivers += d;
    totalHelpers += h;

    const row = document.createElement('div');
    row.className = 'area-row grid border-b border-slate-100';
    row.style.gridTemplateColumns = '160px repeat(7, 1fr) 70px';

    // AREA
    const areaCell = document.createElement('div');
    areaCell.className = 'area-name-cell px-2 py-2 flex items-center gap-2 border-r';

    areaCell.innerHTML = `
      <span class="w-2 h-8 rounded-full" style="background:${area.color}"></span>
      <div class="min-w-0">
        <div class="font-bold text-sm truncate">${area.code}</div>
        <div class="text-[10px] text-slate-500 truncate">${area.name}</div>
      </div>
    `;
    row.appendChild(areaCell);

    // DRIVER
    row.appendChild(createSlot(area.code, 'driver', 0));

    // HELPERS
    for (let i = 0; i < 6; i++) {
      row.appendChild(createSlot(area.code, 'helper', i));
    }

    // COUNT
    const count = document.createElement('div');
    count.className = 'flex items-center justify-center border-l text-sm';

    count.innerHTML = `
      <div class="text-center">
        <div class="font-bold">${d + h}</div>
        <div class="text-[10px] text-slate-400">
          D:${d} H:${h}
        </div>
      </div>
    `;

    row.appendChild(count);
    body.appendChild(row);
  });

  // ================= SUMMARY =================
  const sumDriversEl = document.getElementById('sumDrivers');
  const sumHelpersEl = document.getElementById('sumHelpers');
  const sumTotalEl = document.getElementById('sumTotal');
  const sumUnassignedEl = document.getElementById('sumUnassigned');

  if (sumDriversEl) sumDriversEl.textContent = totalDrivers;
  if (sumHelpersEl) sumHelpersEl.textContent = totalHelpers;
  if (sumTotalEl) sumTotalEl.textContent = totalDrivers + totalHelpers;

  if (sumUnassignedEl) {
    const assigned = getAllAssignedSafe();
    sumUnassignedEl.textContent = employees.length - assigned.size;
  }

  if (window.lucide) lucide.createIcons();
}
function createSlot(areaCode, role, index) {
  const cell = document.createElement('div');

  cell.className = `
    px-2 py-2 flex items-center justify-center
    border-r min-h-[60px]
    ${role === 'driver' ? 'bg-blue-50/30' : 'bg-green-50/30'}
  `;

  const data = assignments[areaCode] || {
    driver: [null],
    helper: Array(6).fill(null)
  };

  const empId = data[role][index];

  cell.addEventListener('dragover', e => e.preventDefault());

  cell.addEventListener('drop', e => {
    e.preventDefault();

    const empId = parseInt(e.dataTransfer.getData('text/plain'));
    if (!empId) return;

    const list = assignments[areaCode][role];

    const filled = list.filter(Boolean).length;
    if (filled >= LIMIT[role]) {
      Swal.fire({ icon: 'warning', title: 'เต็มแล้ว' });
      return;
    }

    // 🔥 remove from all
    Object.keys(assignments).forEach(a => {
      assignments[a].driver = assignments[a].driver.map(i => i === empId ? null : i);
      assignments[a].helper = assignments[a].helper.map(i => i === empId ? null : i);
    });

    const emptyIndex = list.findIndex(i => !i);
    if (emptyIndex === -1) return;

    list[emptyIndex] = empId;

    render();
    saveData();
  });

  // ================= EMPTY =================
  if (!empId) {
    cell.innerHTML = `<span class="text-xs text-gray-300">ว่าง</span>`;
    return cell;
  }

  const emp = getEmp(empId);
  if (!emp) return cell;

  // ================= CARD =================
  const card = document.createElement('div');
  card.className = "staff-card w-full";
  card.draggable = true;

const color = role === 'driver' ? '#3b82f6' : '#22c55e';
const label = role === 'driver' ? 'D' : 'H';

card.innerHTML = `
  <div class="flex items-center gap-2 bg-white shadow-md rounded-xl px-3 py-2 w-full cursor-move hover:scale-105 transition">

    <div class="relative">
      <img 
          src="${getAvatar(emp.avatar, emp.th)}"
          onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(emp.th)}'"
        class="w-10 h-10 rounded-full object-cover border"
      />

      <!-- 🔥 จุดสี -->
      <span 
        class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white font-bold"
        style="background:${color}"
      >
        ${label}
      </span>
    </div>

    <div class="flex flex-col text-left min-w-0">
      <span class="text-xs font-bold truncate">${emp.th}</span>
      <span class="text-[10px] text-gray-500 truncate">${emp.en}</span>
    </div>

  </div>
`;
  card.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', empId);
  });

  cell.appendChild(card);

  return cell;
}
// ================= DROP =================
function createDropZone(areaCode, role, ids) {
  const cell = document.createElement('div');

  cell.className = `
    px-2 py-2 flex flex-col gap-2 min-h-[60px]
  `;

  cell.addEventListener('dragover', e => e.preventDefault());

  cell.addEventListener('drop', e => {
    e.preventDefault();

    const empId = parseInt(e.dataTransfer.getData('text/plain'));
    if (!empId) return;

    const list = assignments[areaCode][role];
    const filled = list.filter(Boolean).length;

    if (filled >= LIMIT[role]) {
      Swal.fire({ icon: 'warning', title: 'เต็มแล้ว' });
      return;
    }

    Object.keys(assignments).forEach(a => {
      assignments[a].driver = assignments[a].driver.map(i => i === empId ? null : i);
      assignments[a].helper = assignments[a].helper.map(i => i === empId ? null : i);
    });

    const emptyIndex = list.findIndex(i => !i);
    if (emptyIndex === -1) return;

    list[emptyIndex] = empId;

    render();
    saveData();
  });

  return cell;
}

// ================= REMOVE =================
function toggleRemoveMode() {
  removeMode = !removeMode;
  document.getElementById('removeModeBtn')
    .classList.toggle('bg-red-600', removeMode);
}

// ================= ADD =================
function openAddModal() {
  const modal = document.getElementById('addModal');
  modal.style.display = 'flex';

  document.getElementById('modalArea').innerHTML =
    areas.map(a => `<option value="${a.code}">${a.code} - ${a.name}</option>`).join('');

  selectedEmpId = null;
  document.getElementById("employeeSearch").value = "";

  populateEmployeeSearch(); // 🔥 ตัวนี้สำคัญ
}

function populateEmployeeSelect() {
  const assigned = getAllAssigned();
  const sel = document.getElementById('modalEmployee');

  const unassigned = employees.filter(e => !assigned.has(e.id));

  if (!unassigned.length) {
    sel.innerHTML = '<option>⚠️ ทุกคนถูก assign แล้ว</option>';
  } else {
    sel.innerHTML = unassigned.map(e =>
      `<option value="${e.id}">${e.th}</option>`
    ).join('');
  }
}

function closeAddModal() {
  document.getElementById('addModal').style.display = 'none';
}

function confirmAdd() {
  const area = document.getElementById('modalArea').value;
  const empId = selectedEmpId;
  const type = document.querySelector('input[name="empType"]:checked').value;

  if (!area || !empId) {
    Swal.fire({ icon: 'warning', title: 'เลือกพนักงานก่อน' });
    return;
  }

  // ลบจากทุกพื้นที่ก่อน
  Object.keys(assignments).forEach(a => {
    assignments[a].driver = assignments[a].driver.map(i => i === empId ? null : i);
    assignments[a].helper = assignments[a].helper.map(i => i === empId ? null : i);
  });

  const list = assignments[area][type];
  const emptyIndex = list.findIndex(i => !i);

  if (emptyIndex === -1) {
    Swal.fire({ icon: 'warning', title: 'เต็มแล้ว' });
    return;
  }

  list[emptyIndex] = empId;

  render();
  saveData();
  closeAddModal();
}

// ================= TOAST =================
function showToast(msg) {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: msg,
    showConfirmButton: false,
    timer: 1500
  });
}