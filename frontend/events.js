const EVENTS_PER_PAGE = 6;
let allEvents = [];
let eventPage = 1;
let editingEventId = null;
let registeredIds = [];

pageLoaders["events"] = loadEvents;
pageLoaders["event"] = loadEventDetail;
pageLoaders["event-form"] = setupEventForm;

// Guard 2: the event form is an admin-only screen.
ADMIN_PAGES.push("event-form");

function eventImage(ev) {
  let meta = ev.metadata;
  if (typeof meta === "string") {
    try { meta = JSON.parse(meta); } catch (e) { meta = null; }
  }
  const url = meta && meta.image_url;
  if (!url) return "";
  if (url.indexOf("http") === 0) return url;
  return BASE_URL + (url.charAt(0) === "/" ? "" : "/") + url;
}

function loadEvents() {
  $("#eventList").html(skeleton(3));
  $("#eventPager").empty();
  apiRequest("GET", "/events")
    .done(function (res) {
      allEvents = getList(res);
      loadMyRegisteredIds();
    })
    .fail(function (xhr) {
      $("#eventList").html(errorBox(getErrorMessage(xhr)));
    });
}

function loadMyRegisteredIds() {
  registeredIds = [];
  if (isAdmin()) return showEvents();
  apiRequest("GET", "/event-registrations/my-registrations")
    .done(function (res) {
      registeredIds = getList(res).filter(isActiveRegistration).map(registrationEventId);
    })
    .always(showEvents);
}

function registerButton(ev) {
  if (registeredIds.indexOf(String(ev.id)) !== -1) {
    return '<button type="button" data-id="' + esc(ev.id) + '" class="card-cancel user-only bg-red-700 text-white px-3 py-1.5 rounded text-sm hover:bg-red-800">Cancel registration</button>';
  }
  return '<button type="button" data-id="' + esc(ev.id) + '" class="card-register user-only bg-green-800 text-white px-3 py-1.5 rounded text-sm hover:bg-green-900">Register</button>';
}

function eventBadge(ev) {
  const now = new Date();
  const start = new Date(ev.starts_at);
  const end = new Date(ev.ends_at);
  if (now > end) return "Ended";
  if (now >= start) return "Happening now";
  const days = Math.ceil((start - now) / 86400000);
  return days <= 1 ? "Starts soon" : "In " + days + " days";
}

function eventCard(ev, hideRegister) {
  const img = eventImage(ev);
  return '<article class="relative overflow-hidden rounded-2xl shadow bg-coffee-800 text-white aspect-[3/4] flex flex-col justify-end cursor-pointer">' +
    (img ? '<img src="' + esc(img) + '" alt="' + esc(ev.title) + '" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />' : "") +
    '<div class="absolute inset-0 bg-gradient-to-t from-coffee-900 via-coffee-900/70 to-transparent"></div>' +
    '<span class="absolute top-3 left-3 bg-coffee-900/85 text-white text-sm font-semibold px-3 py-1 rounded-lg">' + esc(eventBadge(ev)) + "</span>" +
    '<div class="relative p-4">' +
    '<p class="text-sm text-coffee-100 mb-1"><span aria-hidden="true">&#128205;</span> ' + esc(ev.location) + "</p>" +
    '<h2 class="text-xl font-bold text-white mb-1" style="font-family: \'Playfair Display\', Georgia, serif;">' + esc(ev.title) + "</h2>" +
    '<p class="text-sm text-coffee-100 mb-1">' + esc(formatDate(ev.starts_at)) + "</p>" +
    '<p class="text-sm text-coffee-50 mb-3 line-clamp-2">' + esc(ev.description) + "</p>" +
    '<div class="flex flex-wrap gap-2">' +
    '<a href="#/event/' + esc(ev.id) + '" class="bg-white text-coffee-900 px-3 py-1.5 rounded text-sm font-medium hover:bg-coffee-100">View</a>' +
    (hideRegister ? "" : registerButton(ev)) +
    '<a href="#/event-form/' + esc(ev.id) + '" class="admin-only bg-stone-200 text-stone-900 px-3 py-1.5 rounded text-sm hover:bg-stone-300">Edit</a>' +
    '<button type="button" data-id="' + esc(ev.id) + '" class="delete-event admin-only bg-red-700 text-white px-3 py-1.5 rounded text-sm hover:bg-red-800">Delete</button>' +
    "</div></div></article>";
}

// Clicking anywhere on a card opens it, unless a button, link or player was clicked.
$(document).on("click", ".grid article", function (e) {
  if ($(e.target).closest("a, button, audio, video, input, select, textarea").length) return;
  const link = $(this).find('a[href^="#/"]').first();
  if (link.length) location.hash = link.attr("href");
});

function showEvents() {
  const search = $("#filter-search").val().trim().toLowerCase();
  const place = $("#filter-location").val().trim().toLowerCase();
  const date = $("#filter-date").val();

  const list = allEvents.filter(function (ev) {
    if (!isAdmin() && ev.published === false) return false;
    if (search && (ev.title + " " + (ev.description || "")).toLowerCase().indexOf(search) === -1) return false;
    if (place && String(ev.location || "").toLowerCase().indexOf(place) === -1) return false;
    if (date && new Date(ev.starts_at) < new Date(date + "T00:00:00")) return false;
    return true;
  });

  const pages = Math.max(1, Math.ceil(list.length / EVENTS_PER_PAGE));
  if (eventPage > pages) eventPage = pages;
  const start = (eventPage - 1) * EVENTS_PER_PAGE;

  if (list.length === 0) {
    $("#eventList").html('<p class="col-span-full text-stone-700">No events found.</p>');
  } else {
    $("#eventList").html(list.slice(start, start + EVENTS_PER_PAGE).map(function (ev) { return eventCard(ev); }).join(""));
  }
  showPager(pages);
  applyRoleVisibility();
}

function showPager(pages) {
  const nav = $("#eventPager").empty();
  if (pages <= 1) return;

  function pageButton(label, target, disabled, current) {
    return '<button type="button" data-page="' + target + '"' + (disabled ? " disabled" : "") +
      (current ? ' aria-current="page"' : "") +
      ' class="px-3 py-1.5 rounded border ' + (current ? "bg-coffee-700 text-white" : "bg-white hover:bg-stone-100") +
      (disabled ? " opacity-50" : "") + '">' + label + "</button>";
  }

  let html = pageButton("Previous", eventPage - 1, eventPage === 1, false);
  for (let p = 1; p <= pages; p++) {
    html += pageButton(p, p, false, p === eventPage);
  }
  html += pageButton("Next", eventPage + 1, eventPage === pages, false);
  nav.html(html);
}

$("#eventPager").on("click", "button", function () {
  eventPage = Number($(this).data("page"));
  showEvents();
  window.scrollTo(0, 0);
});

$("#filterForm").on("input", function () {
  eventPage = 1;
  showEvents();
});

$("#filterForm").on("submit", function (e) {
  e.preventDefault();
});

$("#clearFilters").on("click", function () {
  $("#filterForm")[0].reset();
  $("#global-search").val("");
  eventPage = 1;
  showEvents();
});

$("#searchForm").on("submit", function (e) {
  e.preventDefault();
  $("#filter-search").val($("#global-search").val());
  eventPage = 1;
  if (location.hash === "#/events") showEvents();
  else goTo("events");
});

$(window).on("hashchange", function () {
  if (location.hash === "#/login") {
    $("#filterForm")[0].reset();
    $("#global-search").val("");
    eventPage = 1;
  }
});

$(document).on("click", ".delete-event", function () {
  const id = $(this).data("id");
  if (!confirm("Delete this event? This cannot be undone.")) return;

  apiRequest("DELETE", "/events/" + id)
    .done(function () {
      showToast("Event deleted.");
      if (location.hash === "#/events") loadEvents();
      else goTo("events");
    })
    .fail(function (xhr) {
      showToast(getErrorMessage(xhr), "error");
    });
});

function loadEventDetail(id) {
  $("#eventDetail").html(skeleton(1));
  apiRequest("GET", "/events/" + id)
    .done(function (res) {
      renderEventDetail(getItem(res));
    })
    .fail(function (xhr) {
      $("#eventDetail").html(errorBox(getErrorMessage(xhr)));
    });
}

function renderEventDetail(ev) {
  const img = eventImage(ev);
  const mapUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(ev.location || "");

  $("#eventDetail").html(
    '<article class="bg-white rounded shadow overflow-hidden">' +
    (img ? '<img src="' + esc(img) + '" alt="' + esc(ev.title) + '" class="w-full max-h-96 object-cover" />' : "") +
    '<div class="p-6">' +
    '<h1 class="text-3xl font-bold mb-3">' + esc(ev.title) + "</h1>" +
    "<p><strong>Starts:</strong> " + esc(formatDate(ev.starts_at)) + "</p>" +
    "<p><strong>Ends:</strong> " + esc(formatDate(ev.ends_at)) + "</p>" +
    '<p class="mb-4"><strong>Location:</strong> ' + esc(ev.location) +
    ' (<a href="' + esc(mapUrl) + '" target="_blank" rel="noopener" class="text-coffee-700 underline">View on map</a>)</p>' +
    '<p class="whitespace-pre-line mb-4">' + esc(ev.description) + "</p>" +
    '<div class="flex gap-2">' +
    '<a href="#/event-form/' + esc(ev.id) + '" class="admin-only bg-stone-200 px-3 py-1.5 rounded hover:bg-stone-300">Edit</a>' +
    '<button type="button" data-id="' + esc(ev.id) + '" class="delete-event admin-only bg-red-700 text-white px-3 py-1.5 rounded hover:bg-red-800">Delete</button>' +
    "</div></div></article>"
  );
  applyRoleVisibility();
}

function showEventFormError(message) {
  $("#eventFormError").text(message).removeClass("hidden");
}

function setupEventForm(id) {
  editingEventId = id || null;
  $("#eventForm")[0].reset();
  $("#eventFormError").addClass("hidden");
  $("#uploadBox").addClass("hidden");
  $("#ef-preview").addClass("hidden").attr("src", "");
  $("#eventFormTitle").text(id ? "Edit event" : "Create event");
  if (!id) return;

  apiRequest("GET", "/events/" + id)
    .done(function (res) {
      const ev = getItem(res);
      $("#ef-title").val(ev.title);
      $("#ef-description").val(ev.description);
      $("#ef-location").val(ev.location);
      $("#ef-starts").val(toLocalInput(ev.starts_at));
      $("#ef-ends").val(toLocalInput(ev.ends_at));
      const img = eventImage(ev);
      if (img) $("#ef-preview").attr("src", img).removeClass("hidden");
    })
    .fail(function (xhr) {
      showEventFormError(getErrorMessage(xhr));
    });
}

$("#ef-image").on("change", function () {
  const file = this.files[0];
  const problem = checkFile(file, ["jpg", "jpeg", "png", "gif"], 2);
  if (problem) {
    showEventFormError(problem);
    $(this).val("");
    $("#ef-preview").addClass("hidden").attr("src", "");
    return;
  }
  $("#eventFormError").addClass("hidden");
  if (file) $("#ef-preview").attr("src", URL.createObjectURL(file)).removeClass("hidden");
});

$("#eventForm").on("submit", function (e) {
  e.preventDefault();
  $("#eventFormError").addClass("hidden");

  const title = $("#ef-title").val().trim();
  const place = $("#ef-location").val().trim();
  const starts = $("#ef-starts").val();
  const ends = $("#ef-ends").val();
  const file = $("#ef-image")[0].files[0];

  if (!title) return showEventFormError("Title is required.");
  if (!place) return showEventFormError("Location is required.");
  if (!starts || !ends) return showEventFormError("Start and end date and time are required.");
  if (new Date(ends) <= new Date(starts)) return showEventFormError("The end must be after the start.");
  const problem = checkFile(file, ["jpg", "jpeg", "png", "gif"], 2);
  if (problem) return showEventFormError(problem);

  const form = new FormData();
  form.append("title", title);
  form.append("description", $("#ef-description").val().trim());
  form.append("location", place);
  form.append("starts_at", new Date(starts).toISOString());
  form.append("ends_at", new Date(ends).toISOString());
  if (file) form.append("image", file);

  const method = editingEventId ? "PUT" : "POST";
  const path = editingEventId ? "/events/" + editingEventId : "/events";

  $("#eventBtn").prop("disabled", true).text("Saving...");
  $("#uploadBox").toggleClass("hidden", !file);
  showUploadProgress(0);

  apiRequest(method, path, form, true, showUploadProgress)
    .done(function () {
      showToast(editingEventId ? "Event updated." : "Event created.");
      goTo("events");
    })
    .fail(function (xhr) {
      showEventFormError(getErrorMessage(xhr));
    })
    .always(function () {
      $("#eventBtn").prop("disabled", false).text("Save event");
    });
});