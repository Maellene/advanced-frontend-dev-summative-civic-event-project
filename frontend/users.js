pageLoaders["profile"] = loadProfile;
pageLoaders["dashboard"] = loadDashboard;
pageLoaders["users"] = loadUsers;
pageLoaders["user"] = loadUser;

// Guard 2: the dashboard and user management are admin-only screens.
ADMIN_PAGES.push("dashboard", "users", "user");

let allUsers = [];

function statLabel(name) {
  const text = name.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function collectStats(data, prefix, out) {
  Object.keys(data || {}).forEach(function (key) {
    const value = data[key];
    const repeated = prefix && key.toLowerCase().indexOf(prefix.replace(/s$/, "").toLowerCase()) !== -1;
    const name = prefix && !repeated ? prefix + " " + key : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      collectStats(value, name, out);
    } else if (!Array.isArray(value) && value !== null && value !== "" && !isNaN(Number(value))) {
      out.push([name, Number(value)]);
    }
  });
  return out;
}

function loadDashboard() {
  $("#dashboardContent").html('<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">' + skeleton(3) + "</div>");
  apiRequest("GET", "/dashboard/admin")
    .done(function (res) {
      renderDashboard(getItem(res));
    })
    .fail(function (xhr) {
      $("#dashboardContent").html(errorBox(getErrorMessage(xhr)));
    });
}

function renderDashboard(data) {
  const stats = collectStats(data, "", []);
  if (!stats.some(function (s) { return /unread/i.test(s[0]); })) {
    stats.push(["unread notifications (you)", unreadCount()]);
  }

  const max = Math.max.apply(null, stats.map(function (s) { return s[1]; }).concat(1));

  let html = '<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">';
  stats.forEach(function (s) {
    html += '<div class="bg-white rounded shadow p-5 border-l-4 border-coffee-600"><p class="text-sm text-stone-700">' + esc(statLabel(s[0])) +
      '</p><p class="text-3xl font-bold text-coffee-900">' + esc(s[1]) + "</p></div>";
  });
  html += "</div>";

  html += '<section class="bg-white rounded shadow p-5" aria-labelledby="chartTitle"><h2 id="chartTitle" class="text-xl font-semibold mb-3">Overview chart</h2><ul class="space-y-3">';
  stats.forEach(function (s) {
    const width = s[1] > 0 ? Math.max(2, Math.round((s[1] / max) * 100)) : 0;
    html += '<li><div class="flex justify-between text-sm mb-1"><span>' + esc(statLabel(s[0])) +
      '</span><span class="font-semibold">' + esc(s[1]) + '</span></div>' +
      '<div class="h-3 bg-stone-200 rounded"><div class="h-3 bg-coffee-700 rounded" style="width:' + width + '%"></div></div></li>';
  });
  html += "</ul></section>";

  $("#dashboardContent").html(html);
}

$("#refreshDashboard").on("click", loadDashboard);

function loadUsers() {
  $("#userList").html('<div class="grid gap-4">' + skeleton(1) + "</div>");
  apiRequest("GET", "/users?page=1&limit=200")
    .done(function (res) {
      allUsers = getList(res);
      showUsers();
    })
    .fail(function (xhr) {
      $("#userList").html(errorBox(getErrorMessage(xhr)));
    });
}

function userToggleButton(u) {
  const active = u.is_active !== false;
  return '<button type="button" data-id="' + esc(u.id) + '" data-action="' + (active ? "disable" : "enable") +
    '" class="user-toggle ' + (active ? "bg-red-700 hover:bg-red-800" : "bg-green-800 hover:bg-green-900") +
    ' text-white px-3 py-1 rounded text-sm">' + (active ? "Disable" : "Enable") + "</button>";
}

function userRow(u) {
  const me = getUser();
  const isMe = me && String(me.id) === String(u.id);
  return '<tr class="border-t border-stone-200">' +
    '<td class="p-3">' + esc(u.full_name) + "</td>" +
    '<td class="p-3">' + esc(u.email) + "</td>" +
    '<td class="p-3">' + esc(u.role) + "</td>" +
    '<td class="p-3">' + (u.is_active === false ? "Disabled" : "Active") + "</td>" +
    '<td class="p-3"><div class="flex flex-wrap gap-2">' +
    '<a href="#/user/' + esc(u.id) + '" class="bg-stone-200 px-3 py-1 rounded text-sm hover:bg-stone-300">View</a>' +
    (isMe ? "" : userToggleButton(u)) + "</div></td></tr>";
}

function showUsers() {
  const search = $("#user-search").val().trim().toLowerCase();
  const list = allUsers.filter(function (u) {
    return !search || (String(u.full_name || "") + " " + String(u.email || "")).toLowerCase().indexOf(search) !== -1;
  });

  if (list.length === 0) {
    $("#userList").html('<p class="text-stone-700">No users found.</p>');
    return;
  }

  $("#userList").html(
    '<div class="overflow-x-auto bg-white rounded shadow"><table class="w-full text-left">' +
    '<thead class="bg-coffee-100"><tr><th scope="col" class="p-3">Name</th><th scope="col" class="p-3">Email</th>' +
    '<th scope="col" class="p-3">Role</th><th scope="col" class="p-3">Status</th><th scope="col" class="p-3">Actions</th></tr></thead>' +
    "<tbody>" + list.map(userRow).join("") + "</tbody></table></div>"
  );
}

$("#user-search").on("input", showUsers);

$(document).on("click", ".user-toggle", function () {
  const id = $(this).data("id");
  const action = $(this).data("action");
  if (action === "disable" && !confirm("Disable this user?")) return;

  apiRequest("PATCH", "/users/" + id + "/" + action)
    .done(function () {
      showToast(action === "enable" ? "User enabled." : "User disabled.");
      if (location.hash === "#/users") loadUsers();
      else loadUser(id);
    })
    .fail(function (xhr) {
      showToast(getErrorMessage(xhr), "error");
    });
});

function loadUser(id) {
  $("#userDetail").html(skeleton(1));
  apiRequest("GET", "/users/" + id)
    .done(function (res) {
      renderUser(getItem(res));
    })
    .fail(function (xhr) {
      $("#userDetail").html(errorBox(getErrorMessage(xhr)));
    });
}

function renderUser(u) {
  const me = getUser();
  const isMe = me && String(me.id) === String(u.id);
  $("#userDetail").html(
    '<article class="bg-white rounded shadow p-6">' +
    '<h1 class="text-2xl font-bold mb-3">' + esc(u.full_name) + "</h1>" +
    "<p><strong>Email:</strong> " + esc(u.email) + "</p>" +
    "<p><strong>Role:</strong> " + esc(u.role) + "</p>" +
    "<p><strong>Status:</strong> " + (u.is_active === false ? "Disabled" : "Active") + "</p>" +
    "<p><strong>Joined:</strong> " + esc(formatDate(u.created_at)) + "</p>" +
    '<p class="text-sm text-stone-700 mt-3 mb-3">A user\'s role cannot be changed from this screen.</p>' +
    (isMe ? "" : userToggleButton(u)) + "</article>"
  );
}

function loadProfile() {
  $("#profileInfo").html(skeleton(1));
  $("#profileError").addClass("hidden");
  apiRequest("GET", "/users/profile/me")
    .done(function (res) {
      const u = getItem(res);
      $("#profileInfo").html(
        '<dl class="grid gap-3 sm:grid-cols-2">' +
        '<div><dt class="text-sm text-stone-700">Full name</dt><dd class="font-semibold">' + esc(u.full_name) + "</dd></div>" +
        '<div><dt class="text-sm text-stone-700">Email</dt><dd class="font-semibold">' + esc(u.email) + "</dd></div>" +
        '<div><dt class="text-sm text-stone-700">Role</dt><dd class="font-semibold">' + esc(u.role) + "</dd></div>" +
        '<div><dt class="text-sm text-stone-700">Status</dt><dd class="font-semibold">' + (u.is_active === false ? "Disabled" : "Active") + "</dd></div>" +
        "</dl>"
      );
      $("#pr-name").val(u.full_name);
      $("#pr-email").val(u.email);
    })
    .fail(function (xhr) {
      $("#profileInfo").html(errorBox(getErrorMessage(xhr)));
    });
}

function showProfileError(message) {
  $("#profileError").text(message).removeClass("hidden");
}

$("#profileForm").on("submit", function (e) {
  e.preventDefault();
  $("#profileError").addClass("hidden");

  const full_name = $("#pr-name").val().trim();
  const email = $("#pr-email").val().trim();
  if (!full_name) return showProfileError("Full name is required.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return showProfileError("Enter a valid email.");

  $("#profileSaveBtn").prop("disabled", true).text("Saving...");

  apiRequest("PATCH", "/users/profile/me", { full_name: full_name, email: email })
    .done(function (res) {
      const updated = getItem(res);
      const user = getUser();
      user.full_name = updated.full_name || full_name;
      user.email = updated.email || email;
      const store = localStorage.getItem("token") ? localStorage : sessionStorage;
      store.setItem("user", JSON.stringify(user));
      $("#profileName").text(user.full_name);
      showToast("Profile updated.");
      loadProfile();
    })
    .fail(function (xhr) {
      if (xhr.status === 409) {
        showProfileError("That email is already used by another account. Please choose a different one.");
      } else {
        showProfileError(getErrorMessage(xhr));
      }
    })
    .always(function () {
      $("#profileSaveBtn").prop("disabled", false).text("Save changes");
    });
});