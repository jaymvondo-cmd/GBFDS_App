/*
 * Applies the saved theme before the page paints anything.
 *
 * Loaded as a plain, render-blocking <script src> in <head> (see
 * partials/head.ejs) - NOT deferred or async, and NOT inline. It has to
 * run before the stylesheet takes effect or a returning dark-mode user
 * would see a flash of the light page first; it has to be an external
 * file rather than an inline <script> because the app's Content-Security-
 * Policy (see Backend/server.js) only allows scripts from "self", not
 * inline ones.
 */
(function () {
    try {
        if (localStorage.getItem("sentinel-theme") === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
        }
    } catch (e) {
        // localStorage can be blocked (private browsing, locked-down
        // browser settings) - just fall back to the light theme.
    }
})();
