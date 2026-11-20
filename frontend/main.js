const BASE_URL = "http://localhost:4000";
const API_URL = BASE_URL + "/api";

const pageLoaders = {};

// ROLE-BASED ACCESS GUARDS: these only improve the user experience.
// The backend does the real security.
const PUBLIC_PAGES = ["login", "signup"];
const ADMIN_PAGES = [];

const SIDEBAR_ITEMS = [
  ["dashboard", "Dashboard", ["dashboard"]],
  ["users", "Users", ["users", "user"]],
  ["events", "Events", ["events", "event", "event-form"]],
  ["announcements", "Announcements", ["announcements", "announcement", "announcement-form"]],
  ["promos", "Promos", ["promos", "promo", "promo-form"]],
  ["notifications", "Notifications", ["notifications", "notification"]],
];

// Remember me ticked: localStorage (kept after closing the browser).
// Not ticked: sessionStorage (cleared when the tab closes).
// Security trade-off: localStorage can be read by any script on the page (XSS risk).
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

function homePage() {
  return isAdmin() ? "dashboard" : "events";
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
  const color = type === "error" ? "bg-red-700" : "bg-green-800";
  const toast = $('<div class="px-4 py-3 text-white rounded shadow mb-2"></div>').addClass(color).text(message);
  box.append(toast);
  setTimeout(function () {
    toast.fadeOut(300, function () { toast.remove(); });
  }, 4000);
}

function apiRequest(method, path, data, isFile, onProgress) {
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

  if (onProgress) {
    options.xhr = function () {
      const xhr = $.ajaxSettings.xhr();
      xhr.upload.addEventListener("progress", function (e) {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
      return xhr;
    };
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

function esc(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortText(text, max) {
  text = String(text || "");
  return text.length > max ? text.slice(0, max).trim() + "..." : text;
}

function formatDate(value) {
  const d = new Date(value);
  return isNaN(d) ? "" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function toLocalInput(value) {
  const d = new Date(value);
  if (isNaN(d)) return "";
  function pad(n) { return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function getList(res) {
  if (Array.isArray(res)) return res;
  if (!res) return [];
  const inner = res.data !== undefined ? res.data : res;
  if (Array.isArray(inner)) return inner;
  if (inner && typeof inner === "object") {
    const keys = Object.keys(inner);
    for (let i = 0; i < keys.length; i++) {
      if (Array.isArray(inner[keys[i]])) return inner[keys[i]];
    }
  }
  return [];
}

function getItem(res) {
  return (res && res.data) || res;
}

function skeleton(count) {
  let html = "";
  for (let i = 0; i < count; i++) {
    html += '<div class="bg-white rounded shadow p-4 animate-pulse">' +
      '<div class="h-32 bg-stone-200 rounded mb-3"></div>' +
      '<div class="h-4 bg-stone-200 rounded w-3/4 mb-2"></div>' +
      '<div class="h-4 bg-stone-200 rounded w-1/2"></div></div>';
  }
  return html;
}

function errorBox(message) {
  return '<div class="col-span-full bg-red-50 text-red-800 p-4 rounded" role="alert">' +
    "<p>" + esc(message) + "</p>" +
    '<button type="button" class="retry mt-2 bg-coffee-700 text-white px-3 py-1.5 rounded hover:bg-coffee-800">Retry</button></div>';
}

function checkFile(file, extensions, maxMB) {
  if (!file) return "";
  const ext = file.name.split(".").pop().toLowerCase();
  if (extensions.indexOf(ext) === -1) return "Allowed file types: " + extensions.join(", ") + ".";
  if (file.size > maxMB * 1024 * 1024) return "The file is too big. The maximum size is " + maxMB + " MB.";
  return "";
}

function showUploadProgress(percent) {
  $(".page.active .upload-bar").css("width", percent + "%");
  $(".page.active .upload-text").text("Uploading " + percent + "%");
}

// Guard 3: hides admin-only buttons from normal users and user-only buttons from admins.
function applyRoleVisibility() {
  $(".admin-only").toggleClass("hidden", !isAdmin());
  $(".user-only").toggleClass("hidden", isAdmin());
}

// Guard 3 (menu): the admin menu is only built for admins and never on login or signup.
function showAdminSidebar(page, isPublic) {
  if (isPublic || !isAdmin()) {
    $("#adminSidebar").addClass("hidden").empty();
    return;
  }

  let html = '<nav aria-label="Admin menu" class="bg-white rounded shadow p-3 md:sticky md:top-20">' +
    '<h2 class="font-bold mb-2 px-2">Admin menu</h2><ul class="space-y-1">';
  SIDEBAR_ITEMS.forEach(function (item) {
    const current = item[2].indexOf(page) !== -1;
    html += '<li><a href="#/' + item[0] + '" class="block px-3 py-2 rounded hover:bg-stone-100' +
      (current ? " bg-coffee-100 font-semibold text-coffee-900" : "") + '"' +
      (current ? ' aria-current="page"' : "") + ">" + item[1] + "</a></li>";
  });
  html += "</ul></nav>";

  $("#adminSidebar").html(html).removeClass("hidden");
}

function goTo(page) {
  location.hash = "#/" + page;
}

function route() {
  const parts = location.hash.replace("#/", "").split("/");
  const page = parts[0] || (getToken() ? homePage() : "login");
  const id = parts[1];
  const isPublic = PUBLIC_PAGES.indexOf(page) !== -1;

  // Guard 1: every screen except login and signup needs a logged-in user.
  if (!isPublic && !getToken()) return goTo("login");
  if (isPublic && getToken()) return goTo(homePage());

  // Guard 2: admin screens send a normal user back to events.
  if (ADMIN_PAGES.indexOf(page) !== -1 && !isAdmin()) {
    showToast("Access denied: admins only.", "error");
    return goTo("events");
  }

  if (!$("#page-" + page).length) return;

  $(".page").removeClass("active");
  $("#page-" + page).addClass("active");
  $("#navbar, #footer").toggleClass("hidden", isPublic);
  $("#profileName").text(isPublic ? "" : getUser().full_name);
  showAdminSidebar(page, isPublic);
  applyRoleVisibility();
  window.scrollTo(0, 0);

  if (pageLoaders[page]) pageLoaders[page](id);
}

// The backend login does not block disabled accounts, so the frontend checks the
// profile after login and on page load and signs disabled users out.
function checkAccountActive() {
  apiRequest("GET", "/users/profile/me").done(function (res) {
    const profile = getItem(res);
    if (profile && profile.is_active === false) {
      logout("Your account has been disabled. Please contact an admin.", "error");
    }
  });
}

$("#logoutBtn").on("click", function () {
  $("#profileMenu").addClass("hidden");
  logout("You have been logged out.");
});

$("#profileBtn").on("click", function (e) {
  e.stopPropagation();
  const closed = $("#profileMenu").toggleClass("hidden").hasClass("hidden");
  $(this).attr("aria-expanded", !closed);
});

$(document).on("click", function () {
  $("#profileMenu").addClass("hidden");
  $("#profileBtn").attr("aria-expanded", "false");
});

$(document).on("keydown", function (e) {
  if (e.key === "Escape") $("#profileMenu").addClass("hidden");
});

$(document).on("click", ".retry", route);

function passwordScore(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

function showSignupError(message) {
  $("#signupError").text(message).removeClass("hidden");
}

$("#signup-password").on("input", function () {
  const score = passwordScore($(this).val());
  const levels = [
    { text: "", color: "bg-stone-200" },
    { text: "Very weak", color: "bg-red-600" },
    { text: "Weak", color: "bg-orange-600" },
    { text: "Fair", color: "bg-yellow-600" },
    { text: "Good", color: "bg-coffee-600" },
    { text: "Strong", color: "bg-green-700" },
  ];
  $("#strengthBar")
    .attr("class", "h-2 rounded " + levels[score].color)
    .css("width", (score / 5) * 100 + "%");
  $("#strengthText").text(levels[score].text);
});

$("#signupForm").on("submit", function (e) {
  e.preventDefault();
  $("#signupError").addClass("hidden");

  const full_name = $("#signup-name").val().trim();
  const email = $("#signup-email").val().trim();
  const password = $("#signup-password").val();
  const confirm = $("#signup-confirm").val();

  if (!full_name) return showSignupError("Full name is required.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return showSignupError("Enter a valid email.");
  if (passwordScore(password) < 5) return showSignupError("Password is too weak. Follow the rules under the meter.");
  if (password !== confirm) return showSignupError("Passwords do not match.");

  $("#signupBtn").prop("disabled", true).text("Creating account...");

  apiRequest("POST", "/auth/signup", { full_name: full_name, email: email, password: password })
    .done(function () {
      $("#signupForm")[0].reset();
      $("#strengthBar").css("width", "0");
      $("#strengthText").text("");
      goTo("login");
      showToast("Account created! Please log in.");
    })
    .fail(function (xhr) {
      showSignupError(getErrorMessage(xhr));
    })
    .always(function () {
      $("#signupBtn").prop("disabled", false).text("Sign up");
    });
});

function showLoginError(message) {
  $("#loginError").text(message).removeClass("hidden");
}

$("#loginForm").on("submit", function (e) {
  e.preventDefault();
  $("#loginError").addClass("hidden");

  const email = $("#login-email").val().trim();
  const password = $("#login-password").val();
  if (!email || !password) return showLoginError("Email and password are required.");

  $("#loginBtn").prop("disabled", true).text("Logging in...");

  apiRequest("POST", "/auth/login", { email: email, password: password })
    .done(function (res) {
      const data = res.data || res;
      if (!data.token || !data.user) {
        return showLoginError("Login worked but the response has no token or user.");
      }
      saveSession(data.token, data.user, $("#remember").is(":checked"));

      apiRequest("GET", "/users/profile/me")
        .done(function (profileRes) {
          const profile = getItem(profileRes);
          if (profile && profile.is_active === false) {
            clearSession();
            return showLoginError("Your account has been disabled. Please contact an admin.");
          }
          $("#loginForm")[0].reset();
          goTo(homePage());
        })
        .fail(function (xhr) {
          clearSession();
          showLoginError(getErrorMessage(xhr));
        });
    })
    .fail(function (xhr) {
      showLoginError(getErrorMessage(xhr));
    })
    .always(function () {
      $("#loginBtn").prop("disabled", false).text("Log in");
    });
});

$(window).on("hashchange", route);
$(route);
$(function () {
  if (getToken()) checkAccountActive();
});