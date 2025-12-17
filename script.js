//const API_URL = "https://script.google.com/macros/s/AKfycbxjMQ_9nsk6B2e_YtFIh27BARmRygyU3NL9cxsWpC_HUh3WCdIKNdMW-bTDWO1hpCYTag/exec";
const API_URL = "https://script.google.com/macros/s/AKfycbzQaulSxPFzp_io1QxRqGyLZwSnUBbgH4qhmFRG082Fp3xAUnmmmrBaxezrOB9L4DRo/exec";

// Dynamic generation, removed fixed array
let currentUser = null;
let currentPass = null;
let allReservations = []; // Store all valid reservations fetched
let currentWeekStart = getMonday(new Date()); // Start of current week
let currentMachine = "Lavatrice1"; // Default state

function switchTab(machine, btnElement) {
  currentMachine = machine;

  // UI Update
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');

  loadReservations(); // Reload view
}

function generateTimeSlots(machine) {
  const slots = [];
  let startHour = 7;
  let startMin = 0;
  const endHour = 24; // Midnight

  // Washer: 45 min, Dryer: 60 min
  const interval = machine.includes("Asciugatrice") ? 60 : 45;

  while (startHour < endHour) {
    const hh = String(startHour).padStart(2, '0');
    const mm = String(startMin).padStart(2, '0');
    slots.push(`${hh}:${mm}`);

    startMin += interval;
    while (startMin >= 60) {
      startMin -= 60;
      startHour++;
    }
  }
  return slots;
}

function getMonday(d) {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date) {
  const options = { day: 'numeric', month: 'numeric' };
  return date.toLocaleDateString('it-IT', options);
}

let isRegisterMode = false;

function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  const title = document.getElementById("loginTitle");
  const btn = document.getElementById("loginBtn");
  const toggleText = document.getElementById("toggleText");

  if (isRegisterMode) {
    title.innerText = "Registrazione";
    btn.innerText = "Registrati";
    toggleText.innerText = "Accedi";
  } else {
    title.innerText = "Accesso Condomini";
    btn.innerText = "Accedi";
    toggleText.innerText = "Registrati";
  }
}

function handleAuth() {
  const user = document.getElementById("user").value;
  const pass = document.getElementById("pass").value;

  if (!user || !pass) return alert("Compila tutti i campi.");

  const action = isRegisterMode ? "register" : "test_login";

  callAPI({ action: action, user, pass })
    .then(res => {
      if (res.status === "success") {
        if (isRegisterMode) {
          alert(res.data.message);
          toggleAuthMode(); // Switch back to login
        } else {
          // Login success
          currentUser = user;
          currentPass = pass;
          document.getElementById("login").style.display = "none";
          document.getElementById("app").style.display = "block";
          document.getElementById("welcome").innerText = `Ciao, ${user}`;
          updateWeekLabel();
          loadReservations();
        }
      } else {
        alert("Errore: " + res.message);
      }
    });
}

function logout() {
  location.reload();
}

function changeWeek(offset) {
  currentWeekStart.setDate(currentWeekStart.getDate() + (offset * 7));
  updateWeekLabel();
  renderTable(); // Re-render with new dates
}

function updateWeekLabel() {
  const endOfWeek = new Date(currentWeekStart);
  endOfWeek.setDate(endOfWeek.getDate() + 6);

  const startStr = formatDateDisplay(currentWeekStart);
  const endStr = formatDateDisplay(endOfWeek);

  document.getElementById("currentWeekLabel").innerText = `${startStr} - ${endStr}`;

  // Update header dates
  const headers = document.querySelectorAll("#calendar thead th[data-day]");
  headers.forEach((th, index) => {
    const dayDate = new Date(currentWeekStart);
    dayDate.setDate(dayDate.getDate() + index);
    const dayName = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"][index];
    th.innerHTML = `${dayName}<br><small>${formatDateDisplay(dayDate)}</small>`;
  });
}

function loadReservations() {
  // We fetch ALL (or filtered backend side) and store them
  callAPI({ action: "get_reservations" })
    .then(res => {
      if (res.status === "success") {
        allReservations = res.data; // Array of { machine, date, time, user }
        renderTable();
      } else {
        alert("Errore caricamento: " + res.message);
      }
    });
}

function renderTable() {
  const tbody = document.querySelector("#calendar tbody");
  tbody.innerHTML = "";

  const timeSlots = generateTimeSlots(currentMachine);

  timeSlots.forEach(time => {
    const row = document.createElement("tr");
    const timeCell = document.createElement("td");
    timeCell.innerText = time;
    row.appendChild(timeCell);

    for (let i = 0; i < 7; i++) {
      const cell = document.createElement("td");
      const dayDate = new Date(currentWeekStart);
      dayDate.setDate(dayDate.getDate() + i);
      const dateStr = formatDate(dayDate); // YYYY-MM-DD

      // Find reservation
      const res = allReservations.find(r =>
        r.machine === currentMachine &&
        r.date.startsWith(dateStr) && // Simple string match, ideally strict
        r.time === time
      );

      if (res) {
        cell.innerText = res.user;
        cell.classList.add("occupied");
        if (res.user === currentUser) {
          cell.classList.add("owned");
          cell.onclick = () => tryDelete(res);
        }
      } else {
        cell.onclick = () => tryReserve(dateStr, time);
      }
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  });
}

function tryReserve(date, time) {
  if (!confirm(`Prenotare ${date} alle ${time}?`)) return;

  callAPI({
    action: "post_reservation",
    user: currentUser,
    pass: currentPass,
    machine: currentMachine,
    date: date,
    time: time
  }).then(res => {
    if (res.status === "success") {
      // Optimistic update or reload
      loadReservations();
    } else {
      alert("Errore: " + res.message);
    }
  });
}

function tryDelete(resObj) {
  if (!confirm(`Cancellare prenotazione di ${resObj.user}?`)) return;

  callAPI({
    action: "delete_reservation",
    user: currentUser,
    pass: currentPass,
    machine: resObj.machine,
    date: resObj.date, // Make sure date format matches what backend expects to find
    time: resObj.time
  }).then(res => {
    if (res.status === "success") {
      loadReservations();
    } else {
      alert("Errore: " + res.message);
    }
  });
}

function callAPI(payload) {
  return fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  }).then(r => r.json()).catch(err => {
    console.error(err);
    return { status: "error", message: "Network Error" };
  });
}
