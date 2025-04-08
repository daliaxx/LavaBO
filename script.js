// URL del tuo Google Apps Script (Web App)
const API_URL = "https://script.google.com/macros/s/AKfycbxPLsQP3PV3odeDgu9UQX-d4j14-0rWwUgCZ3Pi8UxQ/dev";


const timeSlots = ["8:00", "9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
const days = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
let currentUser = null;
let reservations = {};

function login() {
  const user = document.getElementById("user").value.trim();
  if (!user) return alert("Inserisci un nome valido.");
  currentUser = user;
  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("welcome").innerText = `Benvenuto, ${user}`;
  loadReservations();
}

function loadReservations() {
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      reservations = {};
      data.forEach(entry => {
        const key = `${entry.giorno}-${entry.orario}`;
        reservations[key] = entry.utente;
      });
      renderTable();
    })
    .catch(err => {
      console.error("Errore nel caricamento dati:", err);
      alert("Impossibile caricare le prenotazioni.");
    });
}

function renderTable() {
  const tbody = document.querySelector("#calendar tbody");
  tbody.innerHTML = "";

  timeSlots.forEach(time => {
    const row = document.createElement("tr");
    const timeCell = document.createElement("td");
    timeCell.innerText = time;
    row.appendChild(timeCell);

    days.forEach(day => {
      const cell = document.createElement("td");
      const key = `${day}-${time}`;
      if (reservations[key]) {
        cell.innerText = reservations[key];
        if (reservations[key] === currentUser) {
          cell.classList.add("owned");
        }
      } else {
        cell.onclick = () => {
          if (confirm(`Vuoi prenotare ${day} alle ${time}?`)) {
            postReservation(day, time, currentUser);
          }
        };
      }
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });
}

function postReservation(giorno, orario, utente) {
  const body = { giorno, orario, utente };
  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  })
    .then(res => {
      if (res.ok) {
        loadReservations();
      } else {
        throw new Error("Errore nella prenotazione");
      }
    })
    .catch(err => {
      console.error("Errore:", err);
      alert("Errore durante la prenotazione.");
    });
}
