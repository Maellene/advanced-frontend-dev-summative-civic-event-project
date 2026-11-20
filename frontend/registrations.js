pageLoaders["my-registrations"] = loadMyRegistrations;

const showEventDetail = pageLoaders["event"];
pageLoaders["event"] = function (id) {
  showEventDetail(id);
  loadEventExtras(id);
};

let currentEventId = null;

function registrationEventId(r) {
  return String(r.event_id || (r.title ? r.id : ""));
}

function isActiveRegistration(r) {
  const status = String(r.status || "registered").toLowerCase();
  return status !== "cancelled" && status !== "canceled";
}

function stars(n) {
  n = Math.max(0, Math.min(5, Number(n) || 0));
  return '<span class="text-amber-700" aria-label="' + n + ' out of 5">' + "★".repeat(n) + "☆".repeat(5 - n) + "</span>";
}

function loadEventExtras(id) {
  currentEventId = id;
  $("#eventExtras").html(skeleton(1));

  // Role guard: admins see attendees and all feedback.
  // Normal users see the register button and their own feedback form.
  if (isAdmin()) loadAdminExtras(id);
  else loadUserExtras(id);
}

function loadUserExtras(id) {
  let registered = false;
  let mine = null;

  apiRequest("GET", "/event-registrations/my-registrations")
    .done(function (res) {
      registered = getList(res).some(function (r) {
        return registrationEventId(r) === String(id) && isActiveRegistration(r);
      });
    })
    .always(function () {
      apiRequest("GET", "/event-feedback/my-feedback")
        .done(function (res) {
          mine = getList(res).find(function (f) { return String(f.event_id) === String(id); }) || null;
        })
        .always(function () {
          if (String(id) === String(currentEventId)) renderUserExtras(registered, mine);
        });
    });
}

function renderUserExtras(registered, mine) {
  let html = '<section class="bg-white rounded shadow p-6 mt-4"><h2 class="text-xl font-semibold mb-2">Registration</h2>';
  if (registered) {
    html += '<p class="mb-3">You are registered for this event.</p>' +
      '<button type="button" id="cancelRegBtn" class="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800">Cancel registration</button>';
  } else {
    html += '<p class="mb-3">You are not registered for this event.</p>' +
      '<button type="button" id="registerBtn" class="bg-coffee-700 text-white px-4 py-2 rounded hover:bg-coffee-800">Register</button>';
  }
  html += "</section>";

  let options = '<option value="">Choose a rating</option>';
  for (let i = 5; i >= 1; i--) {
    options += '<option value="' + i + '"' + (mine && Number(mine.rating) === i ? " selected" : "") + ">" +
      i + (i === 1 ? " star" : " stars") + "</option>";
  }

  html += '<section class="bg-white rounded shadow p-6 mt-4"><h2 class="text-xl font-semibold mb-2">Your feedback</h2>';
  if (mine) {
    html += '<div id="myFeedback"><p>' + stars(mine.rating) + '</p>' +
      '<p class="whitespace-pre-line mb-3">' + esc(mine.comment) + '</p>' +
      '<button type="button" id="editFeedbackBtn" class="bg-stone-200 px-4 py-2 rounded hover:bg-stone-300">Edit feedback</button></div>';
  }
  html += '<p id="fbError" class="hidden text-red-800 bg-red-50 p-2 rounded mb-3" role="alert"></p>' +
    '<form id="feedbackForm" class="' + (mine ? "hidden" : "") + '" data-feedback-id="' + esc(mine ? mine.id : "") + '" novalidate>' +
    '<label for="fb-rating" class="block font-medium">Rating</label>' +
    '<select id="fb-rating" class="border rounded p-2 mb-3">' + options + "</select>" +
    '<label for="fb-comment" class="block font-medium">Comment</label>' +
    '<textarea id="fb-comment" rows="3" class="w-full border rounded p-2 mb-3">' + esc(mine ? mine.comment : "") + "</textarea>" +
    '<button type="submit" id="feedbackBtn" class="bg-coffee-700 text-white px-4 py-2 rounded hover:bg-coffee-800 disabled:opacity-60">' +
    (mine ? "Update feedback" : "Submit feedback") + "</button></form></section>";

  $("#eventExtras").html(html);
}

function loadAdminExtras(id) {
  $.when(
    apiRequest("GET", "/event-registrations/event/" + id + "/attendees"),
    apiRequest("GET", "/event-feedback/event/" + id)
  )
    .done(function (attendeeRes, feedbackRes) {
      if (String(id) !== String(currentEventId)) return;
      renderAdminExtras(getList(attendeeRes[0]).filter(isActiveRegistration), getList(feedbackRes[0]));
    })
    .fail(function (xhr) {
      $("#eventExtras").html(errorBox(getErrorMessage(xhr)));
    });
}

function renderAdminExtras(attendees, feedbacks) {
  let html = '<section class="bg-white rounded shadow p-6 mt-4"><h2 class="text-xl font-semibold mb-2">Registrants (' + attendees.length + ")</h2>";
  if (attendees.length === 0) {
    html += '<p class="text-stone-700">Nobody has registered yet.</p>';
  } else {
    html += '<ul class="divide-y">';
    attendees.forEach(function (a) {
      html += '<li class="py-2">' + esc(a.full_name || a.name || a.user_id) +
        (a.email ? ' <span class="text-sm text-stone-700">(' + esc(a.email) + ")</span>" : "") + "</li>";
    });
    html += "</ul>";
  }
  html += "</section>";

  html += '<section class="bg-white rounded shadow p-6 mt-4"><h2 class="text-xl font-semibold mb-2">Feedback</h2>';
  if (feedbacks.length === 0) {
    html += '<p class="text-stone-700">No feedback yet.</p>';
  } else {
    let total = 0;
    feedbacks.forEach(function (f) { total += Number(f.rating) || 0; });
    html += '<p class="mb-3"><strong>Average rating:</strong> ' + (total / feedbacks.length).toFixed(1) +
      " / 5 (" + feedbacks.length + (feedbacks.length === 1 ? " review" : " reviews") + ")</p>" +
      '<ul class="divide-y">';
    feedbacks.forEach(function (f) {
      html += '<li class="py-2">' + stars(f.rating) +
        (f.full_name ? " <strong>" + esc(f.full_name) + "</strong>" : "") +
        '<p class="whitespace-pre-line">' + esc(f.comment) + "</p></li>";
    });
    html += "</ul>";
  }
  html += "</section>";

  $("#eventExtras").html(html);
}

$(document).on("click", "#registerBtn", function () {
  const btn = $(this).prop("disabled", true).text("Registering...");
  apiRequest("POST", "/event-registrations/register", { event_id: currentEventId })
    .done(function () {
      showToast("You are registered for this event.");
      loadEventExtras(currentEventId);
    })
    .fail(function (xhr) {
      showToast(getErrorMessage(xhr), "error");
      btn.prop("disabled", false).text("Register");
    });
});

$(document).on("click", "#cancelRegBtn", function () {
  if (!confirm("Cancel your registration for this event?")) return;
  const btn = $(this).prop("disabled", true).text("Cancelling...");
  apiRequest("POST", "/event-registrations/cancel", { event_id: currentEventId })
    .done(function () {
      showToast("Registration cancelled.");
      loadEventExtras(currentEventId);
    })
    .fail(function (xhr) {
      showToast(getErrorMessage(xhr), "error");
      btn.prop("disabled", false).text("Cancel registration");
    });
});

$(document).on("click", "#editFeedbackBtn", function () {
  $("#myFeedback").addClass("hidden");
  $("#feedbackForm").removeClass("hidden");
});

function showFeedbackError(message) {
  $("#fbError").text(message).removeClass("hidden");
}

$(document).on("submit", "#feedbackForm", function (e) {
  e.preventDefault();
  $("#fbError").addClass("hidden");

  const rating = Number($("#fb-rating").val());
  const comment = $("#fb-comment").val().trim();
  const feedbackId = $(this).attr("data-feedback-id");
  if (!rating) return showFeedbackError("Choose a rating from 1 to 5.");

  const request = feedbackId
    ? apiRequest("PUT", "/event-feedback/" + feedbackId, { rating: rating, comment: comment })
    : apiRequest("POST", "/event-feedback", { event_id: currentEventId, rating: rating, comment: comment });

  $("#feedbackBtn").prop("disabled", true).text("Saving...");
  request
    .done(function () {
      showToast(feedbackId ? "Feedback updated." : "Thank you for your feedback.");
      loadEventExtras(currentEventId);
    })
    .fail(function (xhr) {
      showFeedbackError(getErrorMessage(xhr));
      $("#feedbackBtn").prop("disabled", false).text(feedbackId ? "Update feedback" : "Submit feedback");
    });
});

function loadMyRegistrations() {
  $("#registrationList").html(skeleton(3));
  $.when(
    apiRequest("GET", "/event-registrations/my-registrations"),
    apiRequest("GET", "/events")
  )
    .done(function (regRes, eventRes) {
      const events = getList(eventRes[0]);
      const cards = [];

      getList(regRes[0]).filter(isActiveRegistration).forEach(function (r) {
        const eventId = registrationEventId(r);
        const ev = events.find(function (e) { return String(e.id) === eventId; });
        if (ev) {
          cards.push("<div>" + eventCard(ev, true) +
            '<button type="button" data-id="' + esc(ev.id) + '" class="cancel-reg mt-2 bg-red-700 text-white px-3 py-1.5 rounded text-sm hover:bg-red-800">Cancel registration</button></div>');
        }
      });

      if (cards.length === 0) {
        $("#registrationList").html('<p class="col-span-full text-stone-700">You have not registered for any events yet. <a href="#/events" class="text-coffee-700 underline">Browse events</a>.</p>');
      } else {
        $("#registrationList").html(cards.join(""));
      }
      applyRoleVisibility();
    })
    .fail(function (xhr) {
      $("#registrationList").html(errorBox(getErrorMessage(xhr)));
    });
}

$(document).on("click", ".cancel-reg", function () {
  const id = $(this).data("id");
  if (!confirm("Cancel your registration for this event?")) return;

  apiRequest("POST", "/event-registrations/cancel", { event_id: id })
    .done(function () {
      showToast("Registration cancelled.");
      loadMyRegistrations();
    })
    .fail(function (xhr) {
      showToast(getErrorMessage(xhr), "error");
    });
});

$(document).on("click", ".card-register", function () {
  const id = String($(this).data("id"));
  $(this).prop("disabled", true).text("Registering...");
  apiRequest("POST", "/event-registrations/register", { event_id: id })
    .done(function () {
      registeredIds.push(id);
      showToast("You are registered for this event.");
    })
    .fail(function (xhr) {
      showToast(getErrorMessage(xhr), "error");
    })
    .always(showEvents);
});

$(document).on("click", ".card-cancel", function () {
  const id = String($(this).data("id"));
  if (!confirm("Cancel your registration for this event?")) return;
  $(this).prop("disabled", true).text("Cancelling...");
  apiRequest("POST", "/event-registrations/cancel", { event_id: id })
    .done(function () {
      registeredIds = registeredIds.filter(function (x) { return x !== id; });
      showToast("Registration cancelled.");
    })
    .fail(function (xhr) {
      showToast(getErrorMessage(xhr), "error");
    })
    .always(showEvents);
});