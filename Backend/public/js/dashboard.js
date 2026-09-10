document.addEventListener("DOMContentLoaded", function () {
    // Chart.js draws its own canvas, so it can't read the page's CSS
    // theme tokens - pick colors that work for the current theme once,
    // here. (Switching themes reloads the page - see theme.js - so this
    // always matches what's on screen.)
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";

    var BRAND_BLUE = "#2563eb";
    var BRAND_BLUE_WASH = "rgba(37, 99, 235, 0.1)";
    var INK_SECONDARY = isDark ? "#aab6c8" : "#52514e";
    var GRIDLINE = isDark ? "rgba(255, 255, 255, 0.08)" : "#e1e0d9";

    function formatDayLabel(isoDate) {
        var d = new Date(isoDate + "T00:00:00");
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    function setStat(id, value) {
        var el = document.getElementById(id);
        el.textContent = value.toLocaleString();
        el.classList.remove("skeleton");
    }

    fetch("/api/dashboard/stats")
        .then(function (res) {
            if (!res.ok) throw new Error("Failed to load dashboard stats (" + res.status + ")");
            return res.json();
        })
        .then(function (stats) {
            var adminCount = 0;
            var analystCount = 0;
            stats.usersByRole.forEach(function (r) {
                if (r.role === "admin") adminCount = r.count;
                if (r.role === "analyst") analystCount = r.count;
            });

            setStat("stat-total-users", stats.totalUsers);
            setStat("stat-admin-count", adminCount);
            setStat("stat-analyst-count", analystCount);

            var last7 = stats.usersOverTime.slice(-7).reduce(function (sum, r) { return sum + r.count; }, 0);
            document.getElementById("chart-signups-subtitle").textContent =
                "Last 14 days · " + last7 + " new in the last 7";

            document.getElementById("chart-signups-wrap").classList.remove("skeleton");

            var signupsCtx = document.getElementById("chart-signups").getContext("2d");
            new Chart(signupsCtx, {
                type: "line",
                data: {
                    labels: stats.usersOverTime.map(function (r) { return formatDayLabel(r.date); }),
                    datasets: [{
                        data: stats.usersOverTime.map(function (r) { return r.count; }),
                        borderColor: BRAND_BLUE,
                        backgroundColor: BRAND_BLUE_WASH,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: BRAND_BLUE,
                        // Matches the card background so each point reads as
                        // a "cutout" ring rather than a white halo.
                        pointBorderColor: isDark ? "#18212f" : "#ffffff",
                        pointBorderWidth: 2,
                        fill: true,
                        tension: 0.2,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0, color: INK_SECONDARY },
                            grid: { color: GRIDLINE },
                        },
                        x: {
                            ticks: { color: INK_SECONDARY },
                            grid: { display: false },
                        },
                    },
                },
            });
        })
        .catch(function (err) {
            console.error(err);
        });
});
