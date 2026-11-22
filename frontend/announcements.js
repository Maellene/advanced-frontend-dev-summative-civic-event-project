pageLoaders["announcements"] = loadAnnouncements;
pageLoaders["announcement"] = loadAnnouncement;
pageLoaders["announcement-form"] = setupAnnouncementForm;

// Guard 2: the announcement form is an admin-only screen.
ADMIN_PAGES.push("announcement-form");

let allAnnouncements = [];
let editingAnnouncementId = null;

function mediaUrl(url) {
  if (!url) return "";
  if (url.indexOf("http") === 0) return url;
  return BASE_URL + (url.charAt(0) === "/" ? "" : "/") + url;
}

function formatDuration(seconds) {
  const total = Math.round(Number(seconds) || 0);
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function loadAnnouncements() {
  $("#announcementList").html(skeleton(3));
  apiRequest("GET", "/announcements")
    .done(function (res) {
      allAnnouncements = getList(res);
      showAnnouncements();
    })
    .fail(function (xhr) {
      $("#announcementList").html(errorBox(getErrorMessage(xhr)));
    });
}

function announcementCard(a) {
  const length = a.duration_seconds ? formatDuration(a.duration_seconds) : "...";
  const unpublished = a.published === false;
  const draft = unpublished ? ' <span class="text-xs bg-yellow-200 px-2 py-0.5 rounded">Unpublished</span>' : "";
  const action = unpublished ? "publish" : "unpublish";

  return '<article class="bg-white rounded shadow p-4 flex flex-col">' +
    '<h2 class="text-lg font-semibold">' + esc(a.title) + draft + "</h2>" +
    '<p class="text-sm text-stone-700">' + esc(formatDate(a.created_at)) + "</p>" +
    '<p class="text-sm text-stone-700 mb-3">Length: <span class="audio-length" data-src="' + esc(mediaUrl(a.audio_url)) + '">' + length + "</span></p>" +
    '<div class="mt-auto flex flex-wrap gap-2">' +
    '<a href="#/announcement/' + esc(a.id) + '" class="bg-coffee-700 text-white px-3 py-1.5 rounded text-sm hover:bg-coffee-800">Play</a>' +
    '<a href="#/announcement-form/' + esc(a.id) + '" class="admin-only bg-stone-200 px-3 py-1.5 rounded text-sm hover:bg-stone-300">Edit</a>' +
    '<button type="button" data-id="' + esc(a.id) + '" data-action="' + action + '" class="announcement-publish admin-only bg-stone-200 px-3 py-1.5 rounded text-sm hover:bg-stone-300">' +
    (unpublished ? "Publish" : "Unpublish") + "</button>" +
    '<button type="button" data-id="' + esc(a.id) + '" class="delete-announcement admin-only bg-red-700 text-white px-3 py-1.5 rounded text-sm hover:bg-red-800">Delete</button>' +
    "</div></article>";
}

function showAnnouncements() {
  const list = allAnnouncements.filter(function (a) {
    return isAdmin() || a.published !== false;
  });

  if (list.length === 0) {
    $("#announcementList").html('<p class="col-span-full text-stone-700">No announcements yet.</p>');
    return;
  }
  $("#announcementList").html(list.map(announcementCard).join(""));
  fillAudioLengths();
  applyRoleVisibility();
}

function fillAudioLengths() {
  $(".audio-length").each(function () {
    const span = $(this);
    if (span.text() !== "...") return;
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = function () { span.text(formatDuration(audio.duration)); };
    audio.onerror = function () { span.text("unknown"); };
    audio.src = span.attr("data-src");
  });
}

$(document).on("click", ".announcement-publish", function () {
  const id = $(this).data("id");
  const action = $(this).data("action");

  apiRequest("PATCH", "/announcements/" + id + "/" + action)
    .done(function () {
      showToast(action === "publish" ? "Announcement published." : "Announcement unpublished.");
      loadAnnouncements();
    })
    .fail(function (xhr) {
      showToast(getErrorMessage(xhr), "error");
    });
});

$(document).on("click", ".delete-announcement", function () {
  const id = $(this).data("id");
  if (!confirm("Delete this announcement? This cannot be undone.")) return;

  apiRequest("DELETE", "/announcements/" + id)
    .done(function () {
      showToast("Announcement deleted.");
      if (location.hash === "#/announcements") loadAnnouncements();
      else goTo("announcements");
    })
    .fail(function (xhr) {
      showToast(getErrorMessage(xhr), "error");
    });
});

function loadAnnouncement(id) {
  $("#announcementDetail").html(skeleton(1));
  apiRequest("GET", "/announcements/" + id)
    .done(function (res) {
      renderAnnouncement(getItem(res));
    })
    .fail(function (xhr) {
      $("#announcementDetail").html(errorBox(getErrorMessage(xhr)));
    });
}

function renderAnnouncement(a) {
  const url = mediaUrl(a.audio_url);

  $("#announcementDetail").html(
    '<article class="bg-white rounded shadow p-6">' +
    '<h1 class="text-2xl font-bold mb-1">' + esc(a.title) + "</h1>" +
    '<p class="text-sm text-stone-700 mb-4">' + esc(formatDate(a.created_at)) + "</p>" +
    '<audio id="player" controls preload="metadata" class="w-full mb-2" aria-label="Audio for ' + esc(a.title) + '">' +
    '<source src="' + esc(url) + '" />' +
    'Your browser cannot play this audio. <a href="' + esc(url) + '">Download the audio file</a>.</audio>' +
    '<p class="text-sm mb-4">Length: <span id="audioLength">' + (a.duration_seconds ? formatDuration(a.duration_seconds) : "...") + "</span></p>" +
    '<div class="flex gap-2">' +
    '<a href="#/announcement-form/' + esc(a.id) + '" class="admin-only bg-stone-200 px-3 py-1.5 rounded hover:bg-stone-300">Edit</a>' +
    '<button type="button" data-id="' + esc(a.id) + '" class="delete-announcement admin-only bg-red-700 text-white px-3 py-1.5 rounded hover:bg-red-800">Delete</button>' +
    "</div></article>"
  );

  $("#player")[0].addEventListener("loadedmetadata", function () {
    $("#audioLength").text(formatDuration(this.duration));
  });
  applyRoleVisibility();
}

function showAnnouncementFormError(message) {
  $("#announcementFormError").text(message).removeClass("hidden");
}

function setupAnnouncementForm(id) {
  editingAnnouncementId = id || null;
  $("#announcementForm")[0].reset();
  $("#announcementFormError").addClass("hidden");
  $("#announcementUploadBox").addClass("hidden");
  $("#af-preview").addClass("hidden").removeAttr("src");
  $("#announcementFormTitle").text(id ? "Edit announcement" : "Create announcement");
  if (!id) return;

  apiRequest("GET", "/announcements/" + id)
    .done(function (res) {
      const a = getItem(res);
      $("#af-title").val(a.title);
      $("#af-published").prop("checked", a.published !== false);
      if (a.audio_url) $("#af-preview").attr("src", mediaUrl(a.audio_url)).removeClass("hidden");
    })
    .fail(function (xhr) {
      showAnnouncementFormError(getErrorMessage(xhr));
    });
}

$("#af-audio").on("change", function () {
  const file = this.files[0];
  const problem = checkFile(file, ["mp3", "wav", "m4a", "ogg"], 5);
  if (problem) {
    showAnnouncementFormError(problem);
    $(this).val("");
    return;
  }
  $("#announcementFormError").addClass("hidden");
  if (file) $("#af-preview").attr("src", URL.createObjectURL(file)).removeClass("hidden");
});

$("#announcementForm").on("submit", function (e) {
  e.preventDefault();
  $("#announcementFormError").addClass("hidden");

  const title = $("#af-title").val().trim();
  const file = $("#af-audio")[0].files[0];

  if (!title) return showAnnouncementFormError("Title is required.");
  if (!editingAnnouncementId && !file) return showAnnouncementFormError("Please choose an audio file.");
  const problem = checkFile(file, ["mp3", "wav", "m4a", "ogg"], 5);
  if (problem) return showAnnouncementFormError(problem);

  const form = new FormData();
  form.append("title", title);
  form.append("published", $("#af-published").is(":checked"));
  if (file) form.append("audio", file);

  const method = editingAnnouncementId ? "PUT" : "POST";
  const path = editingAnnouncementId ? "/announcements/" + editingAnnouncementId : "/announcements";

  $("#announcementBtn").prop("disabled", true).text("Saving...");
  $("#announcementUploadBox").toggleClass("hidden", !file);
  showUploadProgress(0);

  apiRequest(method, path, form, true, showUploadProgress)
    .done(function () {
      showToast(editingAnnouncementId ? "Announcement updated." : "Announcement created.");
      goTo("announcements");
    })
    .fail(function (xhr) {
      showAnnouncementFormError(getErrorMessage(xhr));
    })
    .always(function () {
      $("#announcementBtn").prop("disabled", false).text("Save announcement");
    });
});