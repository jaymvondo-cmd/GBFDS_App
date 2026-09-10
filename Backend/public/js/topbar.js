/*
 * Profile menu in the top bar.
 *
 * Opens on click, closes on a click elsewhere or Escape, and returns
 * focus to the trigger so keyboard users don't get stranded.
 */
document.addEventListener("DOMContentLoaded", function () {
    var wrapper = document.querySelector("[data-profile-menu]");
    if (!wrapper) return;

    var trigger = wrapper.querySelector("[data-profile-trigger]");
    var panel = wrapper.querySelector("[data-profile-panel]");
    if (!trigger || !panel) return;

    function open() {
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
    }

    function close(returnFocus) {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        if (returnFocus) trigger.focus();
    }

    trigger.addEventListener("click", function (event) {
        event.stopPropagation();
        if (panel.hidden) {
            open();
        } else {
            close(false);
        }
    });

    // A click inside the panel shouldn't close it (except on a link,
    // which navigates anyway).
    panel.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    document.addEventListener("click", function () {
        if (!panel.hidden) close(false);
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !panel.hidden) close(true);
    });
});
