document.addEventListener("DOMContentLoaded", function () {
    var BRAND_BLUE = "#2563eb";
    var BRAND_BLUE_WASH = "rgba(37, 99, 235, 0.1)";
    var INK_SECONDARY = "#52514e";
    var GRIDLINE = "#e1e0d9";

    function roleLabel(role) {
        return role === "admin" ? "Admin" : "Analyst";
    }

    function formatDayLabel(isoDate) {
        var d = new Date(isoDate + "T00:00:00");
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    fetch("/api/dashboard/stats")
        .then(function (res) {
            if (!res.ok) throw new Error("Failed to load dashboard stats (" + res.status + ")");
            return res.json();
        })
        .then(function (stats) {
            document.getElementById("stat-total-users").textContent = stats.totalUsers.toLocaleString();

            var roleCtx = document.getElementById("chart-users-by-role").getContext("2d");
            new Chart(roleCtx, {
                type: "bar",
                data: {
                    labels: stats.usersByRole.map(function (r) { return roleLabel(r.role); }),
                    datasets: [{
                        data: stats.usersByRole.map(function (r) { return r.count; }),
                        backgroundColor: BRAND_BLUE,
                        borderRadius: 4,
                        borderSkipped: false,
                        maxBarThickness: 48,
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
                        pointBorderColor: "#ffffff",
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
