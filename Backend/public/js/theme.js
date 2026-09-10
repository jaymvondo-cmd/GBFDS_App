/*
 * Light/dark mode toggle.
 *
 * The choice is remembered in localStorage and applied as
 * <html data-theme="dark">; the CSS variables that respond to it live in
 * style.css. A tiny inline script in head.ejs sets the attribute before
 * the page paints, so a returning dark-mode user never sees a flash of
 * the light page first.
 *
 * Chart.js (the dashboard charts) and the money-flow graph pick their
 * colors in JavaScript at draw time, not from CSS, so they can't just
 * re-theme themselves live - the simplest correct fix is to reload the
 * page after switching, so every script re-reads the new theme from
 * scratch.
 */
document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) return;

    function isDark() {
        return document.documentElement.getAttribute("data-theme") === "dark";
    }

    function updateLabel() {
        var label = "Switch to " + (isDark() ? "light" : "dark") + " mode";
        toggle.setAttribute("aria-label", label);
        toggle.setAttribute("title", label);
    }

    updateLabel();

    toggle.addEventListener("click", function () {
        var next = isDark() ? "light" : "dark";
        try {
            localStorage.setItem("sentinel-theme", next);
        } catch (e) {
            // Storage might be blocked (private browsing) - the choice just
            // won't be remembered on the next visit.
        }
        window.location.reload();
    });
});
