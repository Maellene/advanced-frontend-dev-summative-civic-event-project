const BASE_URL = "http://localhost:4000";
const API_URL = BASE_URL + "/api";

// Remember me ticked: localStorage (kept after closing the browser).
// Not ticked: sessionStorage (cleared when the tab closes).
function saveSession(token, user, remember) {
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  store.setItem("token", token);
  store.setItem("user", JSON.stringify(user));
}

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

function getUser() {
  const data = localStorage.getItem("user") || sessionStorage.getItem("user");
  return data ? JSON.parse(data) : null;
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
}

function isAdmin() {
  const user = getUser();
  return !!user && user.role === "admin";
}

function logout(message, type) {
  clearSession();
  goTo("login");
  if (message) showToast(message, type);
}

function showToast(message, type) {
  let box = $("#toastBox");
  if (!box.length) {
    box = $('<div id="toastBox" role="status" aria-live="polite" class="fixed top-4 right-4 z-50 max-w-sm"></div>').appendTo("body");
  }
  const color = type === "error" ? "bg-red-700" : "bg-green-700";
  const toast = $('<div class="px-4 py-3 text-white rounded shadow mb-2"></div>').addClass(color).text(message);
  box.append(toast);
  setTimeout(function () {
    toast.fadeOut(300, function () { toast.remove(); });
  }, 4000);
}

function apiRequest(method, path, data, isFile) {
  const options = { url: API_URL + path, method: method, headers: {} };

  const token = getToken();
  if (token) {
    options.headers["Authorization"] = "Bearer " + token;
  }

  if (data) {
    if (isFile) {
      options.data = data;
      options.processData = false;
      options.contentType = false;
    } else {
      options.data = JSON.stringify(data);
      options.contentType = "application/json";
    }
  }

  return $.ajax(options).fail(function (xhr) {
    if (xhr.status === 401 && token) {
      logout("Your session expired. Please log in again.", "error");
    } else if (xhr.status === 403) {
      showToast("You do not have permission to do this. Please contact an admin.", "error");
    }
  });
}

function getErrorMessage(xhr) {
  if (xhr.status === 0) return "Network error. Check your connection and try again.";
  const body = xhr.responseJSON;
  if (body && body.message) return body.message;
  if (body && Array.isArray(body.errors) && body.errors.length) {
    return body.errors.map(function (e) { return e.msg || e.message; }).join(". ");
  }
  return "Something went wrong (error " + xhr.status + ").";
}

// ROLE-BASED ACCESS GUARDS: these only improve the user experience.
// The backend does the real security.
const PUBLIC_PAGES = ["login", "signup"];
const ADMIN_PAGES = [];

// Guard 3: removes admin-only buttons for normal users and user-only buttons for admins.
function applyRoleVisibility() {
  if (!isAdmin()) $(".admin-only").remove();
  if (isAdmin()) $(".user-only").remove();
}

function goTo(page) {
  location.hash = "#/" + page;
}

function route() {
  const page = location.hash.replace("#/", "") || (getToken() ? "events" : "login");
  const isPublic = PUBLIC_PAGES.indexOf(page) !== -1;

  // Guard 1: every screen except login and signup needs a logged-in user.
  if (!isPublic && !getToken()) return goTo("login");
  if (isPublic && getToken()) return goTo("events");

  // Guard 2: admin screens send a normal user back to events.
  if (ADMIN_PAGES.indexOf(page) !== -1 && !isAdmin()) {
    showToast("Access denied: admins only.", "error");
    return goTo("events");
  }

  if (!$("#page-" + page).length) return;

  $(".page").removeClass("active");
  $("#page-" + page).addClass("active");
  applyRoleVisibility();

  if (page === "events") {
    const user = getUser();
    $("#welcome").text("Logged in as " + user.full_name + " (" + user.role + ")");
  }
}

$("#logoutBtn").on("click", function () {
  logout("You have been logged out.");
});

$(window).on("hashchange", route);
$(route);