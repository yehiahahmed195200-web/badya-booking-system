const state = {
  token: localStorage.getItem("badya_token") || "",
  role: localStorage.getItem("badya_role") || "",
  facilities: [],
};

const $ = (id) => document.getElementById(id);

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

function setStatus(el, msg, isError = false) {
  el.textContent = msg;
  el.style.color = isError ? "#8f2214" : "#2e4f29";
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function fillFacilitySelectors() {
  const bookingSelect = $("bookingFacility");
  const statusSelect = $("statusFacility");
  bookingSelect.innerHTML = "";
  statusSelect.innerHTML = "";

  state.facilities.forEach((f) => {
    const bOpt = document.createElement("option");
    bOpt.value = f.id;
    bOpt.textContent = `${f.name} (${f.minParticipants}-${f.maxParticipants})`;
    bookingSelect.appendChild(bOpt);

    const sOpt = document.createElement("option");
    sOpt.value = f.id;
    sOpt.textContent = f.name;
    statusSelect.appendChild(sOpt);
  });
}

function renderFacilities() {
  const grid = $("facilitiesGrid");
  grid.innerHTML = "";

  state.facilities.forEach((facility) => {
    const card = document.createElement("article");
    card.className = "facility-card";
    card.innerHTML = `
      <h3>${facility.name}</h3>
      <p><strong>Category:</strong> ${facility.category}</p>
      <p><strong>Time:</strong> ${facility.openTime} - ${facility.closeTime}</p>
      <p><strong>Slot:</strong> ${facility.defaultSlotMins} mins</p>
      <p><strong>Participants:</strong> ${facility.minParticipants} - ${facility.maxParticipants}</p>
      <span class="tag ${facility.isActive ? "active" : "off"}">
        ${facility.isActive ? "ACTIVE" : "INACTIVE"}
      </span>
    `;
    grid.appendChild(card);
  });
}

function roleVisible() {
  const isAdmin = state.role === "ADMIN";
  const isCoach = state.role === "COACH";
  const isStudent = state.role === "STUDENT";

  $("bookingPanel").style.display = isStudent ? "block" : "none";
  $("adminPanel").style.display = isAdmin ? "block" : "none";
  $("reportPanel").style.display = isAdmin || isCoach ? "block" : "none";
}

async function loadFacilities() {
  state.facilities = await api("/api/facilities");
  renderFacilities();
  fillFacilitySelectors();
}

async function loadProfile() {
  if (!state.token) {
    $("profileCard").textContent = "Not logged in";
    state.role = "";
    roleVisible();
    return;
  }

  try {
    const me = await api("/api/users/me");
    state.role = me.role;
    localStorage.setItem("badya_role", me.role);
    $("profileCard").innerHTML = `
      <div><strong>${me.fullName}</strong></div>
      <div>${me.email}</div>
      <div>Role: ${me.role}</div>
      <div>Student ID: ${me.studentId}</div>
    `;
  } catch (err) {
    state.token = "";
    state.role = "";
    localStorage.removeItem("badya_token");
    localStorage.removeItem("badya_role");
    $("profileCard").textContent = "Session expired. Please login again.";
  }

  roleVisible();
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/api/users/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("email").value,
        password: $("password").value,
      }),
    });

    state.token = data.token;
    state.role = data.user.role;
    localStorage.setItem("badya_token", data.token);
    localStorage.setItem("badya_role", data.user.role);
    setStatus($("authStatus"), `Logged in as ${data.user.role}`);
    await loadProfile();
  } catch (err) {
    setStatus($("authStatus"), err.message, true);
  }
});

$("logoutBtn").addEventListener("click", () => {
  state.token = "";
  state.role = "";
  localStorage.removeItem("badya_token");
  localStorage.removeItem("badya_role");
  setStatus($("authStatus"), "Logged out.");
  loadProfile();
});

$("bookingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const payload = {
      facilityId: $("bookingFacility").value,
      startTime: new Date($("bookingStart").value).toISOString(),
      participants: Number($("bookingParticipants").value),
    };

    const durationRaw = $("bookingDuration").value;
    if (durationRaw) {
      payload.durationMins = Number(durationRaw);
    }

    const data = await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setStatus($("bookingStatus"), `Booking confirmed: ${data.booking.id}`);
  } catch (err) {
    setStatus($("bookingStatus"), err.message, true);
  }
});

$("statusForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api(`/api/facilities/${$("statusFacility").value}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        isActive: $("statusIsActive").value === "true",
        policy: $("statusPolicy").value,
        notifyUsers: true,
      }),
    });

    setStatus(
      $("statusUpdate"),
      `Applied. Impacted: ${data.impactedBookings}, Cancelled: ${data.cancelledBookings}, Notifications: ${data.notificationsCreated}`
    );
    await loadFacilities();
  } catch (err) {
    setStatus($("statusUpdate"), err.message, true);
  }
});

$("reportForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const month = $("reportMonth").value;
    const report = await api(`/api/reports/monthly?month=${month}`);
    $("reportData").textContent = JSON.stringify(report, null, 2);
    $("reportData").classList.remove("muted");
  } catch (err) {
    $("reportData").textContent = err.message;
  }
});

$("refreshFacilities").addEventListener("click", loadFacilities);

(function init() {
  const now = new Date();
  $("reportMonth").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  loadFacilities();
  loadProfile();
})();
