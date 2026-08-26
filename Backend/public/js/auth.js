document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".password-toggle").forEach(function (toggle) {
        var input = document.getElementById(toggle.dataset.toggleFor);
        if (!input) return;

        toggle.addEventListener("click", function () {
            var isHidden = input.type === "password";
            input.type = isHidden ? "text" : "password";
            toggle.setAttribute("aria-pressed", String(isHidden));
            toggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
        });
    });

    document.querySelectorAll("form").forEach(function (form) {
        var submitBtn = form.querySelector(".btn-primary[data-loading-label]");
        if (!submitBtn) return;

        form.addEventListener("submit", function () {
            submitBtn.disabled = true;
            submitBtn.textContent = submitBtn.dataset.loadingLabel;
        });
    });
});
