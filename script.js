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

function switchAuthTab(mode) {
  isRegisterMode = (mode === 'register');

  const btn = document.getElementById("loginBtn");
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");

  if (isRegisterMode) {
    btn.innerText = "Registrati";
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
  } else {
    btn.innerText = "Accedi";
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
  }

  // Toggle helper text
  const helpText = document.getElementById("passHelp");
  if (helpText) {
    helpText.style.display = isRegisterMode ? "block" : "none";
  }

  // Clear errors when switching tabs
  const errorBox = document.getElementById("authError");
  if (errorBox) {
    errorBox.style.display = "none";
    errorBox.innerText = "";
  }
}

// REMOVED toggleAuthMode entirely

function handleAuth() {
  const user = document.getElementById("user").value;
  const pass = document.getElementById("pass").value;
  const errorBox = document.getElementById("authError");

  // Clear previous errors
  if (errorBox) {
    errorBox.style.display = "none";
    errorBox.innerText = "";
  }

  if (!user || !pass) {
    return showAuthError("Compila tutti i campi.");
  }

  if (isRegisterMode) {
    // Validate password: at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);

    if (!hasLetter || !hasNumber) {
      return showAuthError("La password deve contenere almeno una lettera e un numero.");
    }
  }

  const action = isRegisterMode ? "register" : "test_login";

  callAPI({ action: action, user, pass })
    .then(res => {
      if (res.status === "success") {
        if (isRegisterMode) {
          alert(res.data.message);
          switchAuthTab('login'); // Switch back to login
        } else {
          // Login success
          currentUser = user;
          currentPass = pass;
          document.getElementById("login").style.display = "none";
          // Defensive fallback for cached HTML
          const mainView = document.getElementById("mainAppView") || document.getElementById("app");
          if (mainView) mainView.style.display = "block";

          document.getElementById("welcome").innerText = `⭐️ Ciao, ${user}`;
          updateWeekLabel();
          loadReservations();
        }
      } else {
        showAuthError("Errore: " + res.message);
      }
    });
}

function showAuthError(msg) {
  const errorBox = document.getElementById("authError");
  if (errorBox) {
    errorBox.innerText = msg;
    errorBox.style.display = "block";
  } else {
    alert(msg); // Fallback
  }
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

function toggleLoading(show) {
  const overlay = document.getElementById("loadingOverlay");
  if (show) {
    overlay.style.display = "flex";
  } else {
    overlay.style.display = "none";
  }
}

function callAPI(payload) {
  toggleLoading(true); // Show loader

  return fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  }).then(r => r.json())
    .catch(err => {
      console.error(err);
      return { status: "error", message: "Network Error" };
    })
    .finally(() => {
      toggleLoading(false); // Hide loader regardless of success/error
    });
}

function showProfile() {
  const mainView = document.getElementById("mainAppView") || document.getElementById("app");
  if (mainView) mainView.style.display = "none";

  document.getElementById("profileView").style.display = "block";
  document.getElementById("profileName").innerText = currentUser;
  renderProfile();
}

function showMain() {
  document.getElementById("profileView").style.display = "none";
  const mainView = document.getElementById("mainAppView") || document.getElementById("app");
  if (mainView) mainView.style.display = "block";
}

function renderProfile() {
  const futureContainer = document.getElementById("futureList");
  const pastContainer = document.getElementById("pastList");

  futureContainer.innerHTML = "";
  pastContainer.innerHTML = "";

  const myRes = allReservations.filter(r => r.user === currentUser);

  // Sort: Future first, then past
  myRes.sort((a, b) => new Date(a.date + "T" + a.time) - new Date(b.date + "T" + b.time));

  const now = new Date();
  const todayStr = formatDate(now);
  const nowTime = now.getHours() + ":" + now.getMinutes();

  if (myRes.length === 0) {
    futureContainer.innerHTML = "<p>Nessuna prenotazione futura.</p>";
    pastContainer.innerHTML = "<p>Nessuno storico.</p>";
    return;
  }

  myRes.forEach(r => {
    // Simple comparison string based
    if (r.date > todayStr || (r.date === todayStr && r.time >= nowTime)) {
      futureContainer.appendChild(createResCard(r, true));
    } else {
      // Prepend to show most recent at top of list logic if strict reverse needed
      // but here we are sorted asc. Let's prepend for past to have desc order visually
      pastContainer.prepend(createResCard(r, false));
    }
  });

  // Feedback empty states
  if (futureContainer.children.length === 0) futureContainer.innerHTML = "<p>Nessuna prenotazione futura.</p>";
  if (pastContainer.children.length === 0) pastContainer.innerHTML = "<p>Nessuno storico.</p>";
}

function createResCard(res, isFuture) {
  const div = document.createElement("div");
  div.className = `res-card ${isFuture ? "res-future" : "res-past"}`;

  const datePretty = formatDateDisplay(new Date(res.date));

  const info = document.createElement("div");
  info.className = "res-info";
  info.innerHTML = `<strong>${res.machine}</strong> ${datePretty} alle ${res.time}`;

  div.appendChild(info);

  if (isFuture) {
    const btn = document.createElement("button");
    btn.className = "delete-btn-mini";
    btn.innerText = "🗑️";
    btn.onclick = () => {
      if (confirm("Eliminare questa prenotazione?")) {
        tryDelete({ ...res, user: currentUser });
        // We stay on profile, just refresh
        setTimeout(renderProfile, 500); // Small delay to allow delete to propagate locally or optimistically remove
      }
    };
    div.appendChild(btn);
  }

  return div;
}
