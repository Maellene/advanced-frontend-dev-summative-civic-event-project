pageLoaders["promos"] = loadPromos;
pageLoaders["promo"] = loadPromo;
pageLoaders["promo-form"] = setupPromoForm;

// Guard 2: the promo form is an admin-only screen.
ADMIN_PAGES.push("promo-form");

let promosCache = null;
let editingPromoId = null;

$(window).on("hashchange", function () {
  if (location.hash === "#/login") promosCache = null;
});

function loadPromos() {
  if (promosCache) return showPromos();

  $("#promoList").html(skeleton(3));
  apiRequest("GET", "/promos")
    .done(function (res) {
      promosCache = getList(res);
      showPromos();
    })
    .fail(function (xhr) {
      $("#promoList").html(errorBox(getErrorMessage(xhr)));
    });
}

function promoCard(p) {
  const unpublished = p.published === false;
  const draft = unpublished ? ' <span class="text-xs bg-yellow-200 px-2 py-0.5 rounded">Unpublished</span>' : "";
  const action = unpublished ? "publish" : "unpublish";

  return '<article class="bg-white rounded shadow overflow-hidden flex flex-col">' +
    '<video src="' + esc(mediaUrl(p.video_url)) + '#t=0.5" preload="metadata" muted tabindex="-1" aria-hidden="true" class="h-40 w-full object-cover bg-black"></video>' +
    '<div class="p-4 flex flex-col flex-1">' +
    '<h2 class="text-lg font-semibold">' + esc(p.title) + draft + "</h2>" +
    '<p class="text-sm mb-3">' + esc(shortText(p.description, 100)) + "</p>" +
    '<div class="mt-auto flex flex-wrap gap-2">' +
    '<a href="#/promo/' + esc(p.id) + '" class="bg-blue-700 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-800">&#9654; Play</a>' +
    '<a href="#/promo-form/' + esc(p.id) + '" class="admin-only bg-gray-200 px-3 py-1.5 rounded text-sm hover:bg-gray-300">Edit</a>' +
    '<button type="button" data-id="' + esc(p.id) + '" data-action="' + action + '" class="promo-publish admin-only bg-gray-200 px-3 py-1.5 rounded text-sm hover:bg-gray-300">' +
    (unpublished ? "Publish" : "Unpublish") + "</button>" +
    '<button type="button" data-id="' + esc(p.id) + '" class="delete-promo admin-only bg-red-700 text-white px-3 py-1.5 rounded text-sm hover:bg-red-800">Delete</button>' +
    "</div></div></article>";
}

function showPromos() {
  const list = promosCache.filter(function (p) {
    return isAdmin() || p.published !== false;
  });

  if (list.length === 0) {
    $("#promoList").html('<p class="col-span-full text-gray-700">No promos yet.</p>');
    return;
  }
  $("#promoList").html(list.map(promoCard).join(""));
  applyRoleVisibility();
}

$(document).on("click", ".promo-publish", function () {
  const id = $(this).data("id");
  const action = $(this).data("action");

  apiRequest("PATCH", "/promos/" + id + "/" + action)
    .done(function () {
      promosCache = null;
      showToast(action === "publish" ? "Promo published." : "Promo unpublished.");
      loadPromos();
    })
    .fail(function (xhr) {
      showToast(getErrorMessage(xhr), "error");
    });
});

$(document).on("click", ".delete-promo", function () {
  const id = $(this).data("id");
  if (!confirm("Delete this promo? This cannot be undone.")) return;

  apiRequest("DELETE", "/promos/" + id)
    .done(function () {
      promosCache = null;
      showToast("Promo deleted.");
      if (location.hash === "#/promos") loadPromos();
      else goTo("promos");
    })
    .fail(function (xhr) {
      showToast(getErrorMessage(xhr), "error");
    });
});

function captionTrackUrl(text) {
  const clean = text.replace(/-->/g, "->").replace(/\n{2,}/g, "\n");
  const vtt = "WEBVTT\n\n00:00:00.000 --> 10:00:00.000\n" + clean;
  return URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
}

function loadPromo(id) {
  $("#promoDetail").html(skeleton(1));
  apiRequest("GET", "/promos/" + id)
    .done(function (res) {
      renderPromo(getItem(res));
    })
    .fail(function (xhr) {
      $("#promoDetail").html(errorBox(getErrorMessage(xhr)));
    });
}

function renderPromo(p) {
  const url = mediaUrl(p.video_url);
  const track = p.caption_text
    ? '<track kind="captions" srclang="en" label="English" src="' + captionTrackUrl(p.caption_text) + '" default />'
    : "";

  $("#promoDetail").html(
    '<article class="bg-white rounded shadow p-6">' +
    '<h1 class="text-2xl font-bold mb-3">' + esc(p.title) + "</h1>" +
    '<video id="promoVideo" controls preload="metadata" class="w-full max-h-[70vh] rounded bg-black mb-3">' +
    '<source src="' + esc(url) + '" />' + track +
    'Your browser cannot play this video. <a href="' + esc(url) + '">Download the video file</a>.</video>' +
    '<p class="whitespace-pre-line mb-4">' + esc(p.description) + "</p>" +
    (p.caption_text ? '<h2 class="text-lg font-semibold mb-1">Transcript</h2><p class="whitespace-pre-line mb-4">' + esc(p.caption_text) + "</p>" : "") +
    '<div class="flex gap-2">' +
    '<a href="#/promo-form/' + esc(p.id) + '" class="admin-only bg-gray-200 px-3 py-1.5 rounded hover:bg-gray-300">Edit</a>' +
    '<button type="button" data-id="' + esc(p.id) + '" class="delete-promo admin-only bg-red-700 text-white px-3 py-1.5 rounded hover:bg-red-800">Delete</button>' +
    "</div></article>"
  );

  const video = $("#promoVideo")[0];
  if (video.textTracks.length) video.textTracks[0].mode = "showing";
  applyRoleVisibility();
}

function showPromoFormError(message) {
  $("#promoFormError").text(message).removeClass("hidden");
}

function setupPromoForm(id) {
  editingPromoId = id || null;
  $("#promoForm")[0].reset();
  $("#promoFormError").addClass("hidden");
  $("#promoUploadBox").addClass("hidden");
  $("#pf-preview").addClass("hidden").removeAttr("src");
  $("#promoFormTitle").text(id ? "Edit promo" : "Create promo");
  if (!id) return;

  apiRequest("GET", "/promos/" + id)
    .done(function (res) {
      const p = getItem(res);
      $("#pf-title").val(p.title);
      $("#pf-description").val(p.description);
      $("#pf-caption").val(p.caption_text);
      if (p.video_url) $("#pf-preview").attr("src", mediaUrl(p.video_url)).removeClass("hidden");
    })
    .fail(function (xhr) {
      showPromoFormError(getErrorMessage(xhr));
    });
}

$("#pf-video").on("change", function () {
  const file = this.files[0];
  const problem = checkFile(file, ["mp4", "mov", "avi", "mkv"], 8);
  if (problem) {
    showPromoFormError(problem);
    $(this).val("");
    return;
  }
  $("#promoFormError").addClass("hidden");
  if (file) $("#pf-preview").attr("src", URL.createObjectURL(file)).removeClass("hidden");
});

$("#promoForm").on("submit", function (e) {
  e.preventDefault();
  $("#promoFormError").addClass("hidden");

  const title = $("#pf-title").val().trim();
  const description = $("#pf-description").val().trim();
  const caption = $("#pf-caption").val().trim();
  const file = $("#pf-video")[0].files[0];

  if (!title) return showPromoFormError("Title is required.");
  if (!description) return showPromoFormError("Description is required.");
  if (!caption) return showPromoFormError("Caption text is required.");
  if (!editingPromoId && !file) return showPromoFormError("Please choose a video file.");
  const problem = checkFile(file, ["mp4", "mov", "avi", "mkv"], 8);
  if (problem) return showPromoFormError(problem);

  const form = new FormData();
  form.append("title", title);
  form.append("description", description);
  form.append("caption_text", caption);
  if (file) form.append("video", file);

  const method = editingPromoId ? "PUT" : "POST";
  const path = editingPromoId ? "/promos/" + editingPromoId : "/promos";

  $("#promoBtn").prop("disabled", true).text("Saving...");
  $("#promoUploadBox").toggleClass("hidden", !file);
  showUploadProgress(0);

  apiRequest(method, path, form, true, showUploadProgress)
    .done(function () {
      promosCache = null;
      showToast(editingPromoId ? "Promo updated." : "Promo created.");
      goTo("promos");
    })
    .fail(function (xhr) {
      showPromoFormError(getErrorMessage(xhr));
    })
    .always(function () {
      $("#promoBtn").prop("disabled", false).text("Save promo");
    });
});