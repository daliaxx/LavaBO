const SHEET_NAMES = ["Lavatrice1", "Lavatrice2", "Asciugatrice"];
const USERS_SHEET = "Utenti";

function doGet(e) {
  return ContentService.createTextOutput("Backend LavaBO operativo. Usa il client locale per accedere.");
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === "test_login") {
      return handleLogin(data);
    } else if (action === "register") {
      return handleRegister(data);
    } else if (action === "get_reservations") {
      return handleGetReservations(data);
    } else if (action === "post_reservation") {
      return handlePostReservation(data);
    } else if (action === "delete_reservation") {
      return handleDeleteReservation(data);
    } 

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Azione sconosciuta" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateUsersSheet() {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(USERS_SHEET);
    sheet.appendRow(["Username", "Password"]); // Header
  }
  return sheet;
}

function handleRegister(data) {
  const user = data.user.trim();
  const pass = data.pass.trim();
  
  if (!user || !pass) return error("Dati mancanti");
  if (user.length < 3) return error("Username troppo corto");
  
  const sheet = getOrCreateUsersSheet();
  const rows = sheet.getDataRange().getValues();
  
  // Check if user exists
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === user) {
      return error("Utente già esistente");
    }
  }
  
  sheet.appendRow([user, pass]);
  return success({ message: "Registrazione avvenuta! Ora accedi." });
}

function handleLogin(data) {
  const user = data.user.trim();
  const pass = data.pass.trim();
  
  const sheet = getOrCreateUsersSheet();
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === user && rows[i][1] === pass) {
      return success({ message: "Login OK" });
    }
  }
  return error("Credenziali errate");
}

function authenticate(user, pass) {
  const sheet = getOrCreateUsersSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === user && rows[i][1] === pass) {
      return true;
    }
  }
  return false;
}

function handleGetReservations(data) {
  const allReservations = [];
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone(); 

  SHEET_NAMES.forEach(sheetName => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return;
    const rows = sheet.getDataRange().getValues();
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        let dateVal = row[0];
        
        if (Object.prototype.toString.call(dateVal) === '[object Date]') {
             dateVal = Utilities.formatDate(dateVal, tz, "yyyy-MM-dd");
        }
        
        allReservations.push({
            machine: sheetName,
            date: dateVal,
            time: row[1],
            user: row[2]
        });
    }
  });

  return success(allReservations);
}

function handlePostReservation(data) {
  if (!authenticate(data.user, data.pass)) return error("Non autorizzato");

  const machine = data.machine; 
  if (!SHEET_NAMES.includes(machine)) return error("Macchina non valida");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(machine);
  
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    let storedDate = rows[i][0];
    if (Object.prototype.toString.call(storedDate) === '[object Date]') {
       storedDate = Utilities.formatDate(storedDate, tz, "yyyy-MM-dd");
    }
    
    if (storedDate == data.date && rows[i][1] == data.time) {
      return error("Orario già occupato!");
    }
  }

  sheet.appendRow(["'" + data.date, data.time, data.user]);
  return success({ message: "Prenotato con successo" });
}

function handleDeleteReservation(data) {
  if (!authenticate(data.user, data.pass)) return error("Non autorizzato");
  
  const machine = data.machine;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(machine);
  const rows = sheet.getDataRange().getValues();
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();

  for (let i = 1; i < rows.length; i++) {
    let storedDate = rows[i][0];
    if (Object.prototype.toString.call(storedDate) === '[object Date]') {
       storedDate = Utilities.formatDate(storedDate, tz, "yyyy-MM-dd");
    }
    
    // Check ownership
    // Compare date strings.
    if (storedDate == data.date && rows[i][1] == data.time && rows[i][2] == data.user) {
      sheet.deleteRow(i + 1);
      return success({ message: "Cancellato" });
    }
  }
  return error("Prenotazione non trovata o non tua");
}

function success(payload) {
  return ContentService.createTextOutput(JSON.stringify({ status: "success", data: payload }))
      .setMimeType(ContentService.MimeType.JSON);
}

function error(msg) {
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: msg }))
      .setMimeType(ContentService.MimeType.JSON);
}