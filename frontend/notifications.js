pageLoaders["notifications"] = loadNotificationsPage;
pageLoaders["notification"] = loadNotification;

let notifCache = [];

function readKey() {
  const user = getUser();
  return "readNotifs_" + (user ? user.id : "none");
}

function getReadIds() {
  try {
    return JSON.parse(localStorage.getItem(readKey())) || [];
  } catch (e) {
    return [];
  }
}

function markRead(id) {
  const ids = getReadIds();
  if (ids.indexOf(String(id)) === -1) {
    ids.push(String(id));
    localStorage.setItem(readKey(), JSON.stringify(ids));
  }
}

function isRead(n) {
  return getReadIds().indexOf(String(n.id)) !== -1;
}

function unreadCount() {
  return notifCache.filter(function (n) { return !isRead(n); }).length;
}

function updateBell() {
  const count = unreadCount();
  $("#bellCount").text(count > 99 ? "99+" : count).toggleClass("hidden", count === 0);
  $("#bellBtn").attr("aria-label", "Notifications, " + count + " unread");
}

function loadBell(done) {
  apiRequest("GET", "/notifications").done(function (res) {
    notifCache = getList(res);
    updateBell();
    if (done) done();
  });
}

function renderBellPanel() {
  let html = "";
  if (notifCache.length === 0) {
    html += '<p class="px-4 py-3 text-sm text-gray-700">No notifications yet.</p>';
  }
  notifCache.slice(0, 5).forEach(function (n) {
    html += '<a href="#/notification/' + esc(n.id) + '" class="block px-4 py-2 border-b hover:bg-gray-100' + (isRead(n) ? "" : " font-semibold") + '">' +
      '<span class="block truncate">' + esc(n.title) + "</span>" +
      '<span class="block text-xs text-gray-600">' + esc(formatDate(n.created_at)) + "</span></a>";
  });
  html += '<a href="#/notifications" class="block px-4 py-2 text-center text-blue-700 underline">View all notifications</a>';
  $("#bellPanel").html(html);
}

function closeBell() {
  $("#bellPanel").addClass("hidden");
  $("#bellBtn").attr("aria-expanded", "false");
}

$("#bellBtn").on("click", function () {
  if (!$("#bellPanel").hasClass("hidden")) return closeBell();
  renderBellPanel();
  $("#bellPanel").removeClass("hidden");
  $(this).attr("aria-expanded", "true");
  loadBell(renderBellPanel);
});

document.addEventListener("click", function (e) {
  if (!e.target.closest("#bellBtn") && !e.target.closest("#bellPanel")) closeBell();
}, true);

$(document).on("keydown", function (e) {
  if (e.key === "Escape") closeBell();
});

$(window).on("hashchange", function () {
  closeBell();
  if (location.hash === "#/login") {
    notifCache = [];
    updateBell();
    return;
  }
  if (getToken()) loadBell();
});

$(function () {
  if (getToken()) loadBell();
});

function notificationRow(n) {
  const unread = !isRead(n);
  return '<article class="bg-white rounded shadow p-4 flex flex-wrap items-start justify-between gap-2">' +
    '<a href="#/notification/' + esc(n.id) + '" class="flex-1 min-w-0">' +
    '<h2 class="' + (unread ? "font-bold" : "font-medium") + '">' +
    (unread ? '<span class="inline-block w-2 h-2 bg-blue-700 rounded-full mr-2" aria-hidden="true"></span><span class="sr-only">Unread: </span>' : "") +
    esc(n.title) + "</h2>" +
    '<p class="text-sm text-gray-700">' + esc(shortText(n.message, 120)) + "</p>" +
    '<p class="text-xs text-gray-600 mt-1">' + esc(n.type) + " &middot; " + esc(formatDate(n.created_at)) + "</p></a>" +
    '<button type="button" data-id="' + esc(n.id) + '" class="delete-notification admin-only bg-red-700 text-white px-3 py-1.5 rounded text-sm hover:bg-red-800">Delete</button>' +
    "</article>";
}

function showNotificationList() {
  if (notifCache.length === 0) {
    $("#notificationList").html('<p class="text-gray-700">You have no notifications.</p>');
    return;
  }
  $("#notificationList").html(notifCache.map(notificationRow).join(""));
  applyRoleVisibility();
}

function loadNotificationsPage() {
  $("#notificationList").html(skeleton(2));
  apiRequest("GET", "/notifications")
    .done(function (res) {
      notifCache = getList(res);
      updateBell();
      showNotificationList();
    })
    .fail(function (xhr) {
      $("#notificationList").html(errorBox(getErrorMessage(xhr)));
    });
}

$("#markAllRead").on("click", function () {
  notifCache.forEach(function (n) { markRead(n.id); });
  updateBell();
  showNotificationList();
  showToast("All notifications marked as read.");
});

function relatedLink(n) {
  let meta = n.metadata;
  if (typeof meta === "string") {
    try { meta = JSON.parse(meta); } catch (e) { meta = null; }
  }
  meta = meta || {};
  if (meta.event_id) return { href: "#/event/" + meta.event_id, label: "View the event" };
  if (meta.promo_id) return { href: "#/promo/" + meta.promo_id, label: "View the promo" };
  if (meta.announcement_id) return { href: "#/announcement/" + meta.announcement_id, label: "View the announcement" };
  return null;
}

function loadNotification(id) {
  $("#notificationDetail").html(skeleton(1));
  apiRequest("GET", "/notifications/" + id)
    .done(function (res) {
      const n = getItem(res);
      markRead(n.id);
      updateBell();
      renderNotification(n);
    })
    .fail(function (xhr) {
      $("#notificationDetail").html(errorBox(getErrorMessage(xhr)));
    });
}

function renderNotification(n) {
  const link = relatedLink(n);
  $("#notificationDetail").html(
    '<article class="bg-white rounded shadow p-6">' +
    '<h1 class="text-2xl font-bold mb-1">' + esc(n.title) + "</h1>" +
    '<p class="text-sm text-gray-700 mb-4">' + esc(n.type) + " &middot; " + esc(formatDate(n.created_at)) + "</p>" +
    '<p class="whitespace-pre-line mb-4">' + esc(n.message) + "</p>" +
    '<div class="flex flex-wrap gap-2">' +
    (link ? '<a href="' + esc(link.href) + '" class="bg-blue-700 text-white px-3 py-1.5 rounded hover:bg-blue-800">' + esc(link.label) + "</a>" : "") +
    '<button type="button" data-id="' + esc(n.id) + '" class="delete-notification admin-only bg-red-700 text-white px-3 py-1.5 rounded hover:bg-red-800">Delete</button>' +
    "</div></article>"
  );
  applyRoleVisibility();
}

$(document).on("click", ".delete-notification", function () {
  const id = $(this).data("id");
  if (!confirm("Delete this notification? This cannot be undone.")) return;

  apiRequest("DELETE", "/notifications/" + id)
    .done(function () {
      showToast("Notification deleted.");
      if (location.hash === "#/notifications") loadNotificationsPage();
      else goTo("notifications");
    })
    .fail(function (xhr) {
      showToast(getErrorMessage(xhr), "error");
    });
});