document.addEventListener("DOMContentLoaded", function () {
    // These match the risk colors already used elsewhere in the app
    // (danger/success tokens in style.css) so a "red" transaction here
    // looks like the same red everywhere else.
    var COLORS = {
        green: "#15803d",
        yellow: "#d97706",
        red: "#dc2626",
    };

    // How each risk level reads to an analyst - "red"/"yellow"/"green"
    // stay the values the API and CSS use, only the displayed word
    // changes (matches the labels used on the Alerts pages).
    var RISK_LABELS = { red: "High", yellow: "Low", green: "OK" };

    // Chart.js draws its own canvas, so it can't read the page's CSS
    // theme tokens - pick axis colors that work for the current theme
    // once, here. (Switching themes reloads the page - see theme.js -
    // so this always matches what's on screen.)
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var AXIS_LABEL = isDark ? "#aab6c8" : "#52514e";
    var AXIS_LABEL_STRONG = isDark ? "#f1f5f9" : "#0f172a";
    var GRIDLINE = isDark ? "rgba(255, 255, 255, 0.08)" : "#e1e0d9";

    function setStat(id, value) {
        var el = document.getElementById(id);
        el.textContent = value.toLocaleString();
        el.classList.remove("skeleton");
    }

    function formatMoney(amount) {
        return Number(amount).toLocaleString() + " FCFA";
    }

    function formatDate(iso) {
        return new Date(iso).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function renderAlertsTable(alerts) {
        var body = document.getElementById("recent-alerts-body");

        if (alerts.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="data-table__empty">No pending alerts — nothing to review right now.</td></tr>';
            return;
        }

        body.innerHTML = alerts
            .map(function (alert) {
                var tx = alert.Transaction || {};
                return (
                    "<tr>" +
                    '<td class="data-table__name">' + alert.alert_id + "</td>" +
                    '<td><span class="risk-badge risk-badge--' + alert.risk_level + '">' + RISK_LABELS[alert.risk_level] + "</span></td>" +
                    "<td>" + (tx.amount !== undefined ? formatMoney(tx.amount) : "—") + "</td>" +
                    "<td>" + (alert.reason || "—") + "</td>" +
                    "<td>" + formatDate(alert.created_at) + "</td>" +
                    "</tr>"
                );
            })
            .join("");
    }

    fetch("/api/dashboard/fraud-stats")
        .then(function (res) {
            if (!res.ok) throw new Error("Failed to load fraud stats (" + res.status + ")");
            return res.json();
        })
        .then(function (stats) {
            setStat("stat-active-alerts", stats.activeAlertsCount);
            setStat("stat-total-transactions", stats.totalTransactions);
            setStat("stat-red-count", stats.transactionsByClassification.red);

            document.getElementById("chart-risk-wrap").classList.remove("skeleton");

            var ctx = document.getElementById("chart-risk-breakdown").getContext("2d");
            new Chart(ctx, {
                type: "bar",
                data: {
                    labels: ["OK", "Low", "High"],
                    datasets: [{
                        data: [
                            stats.transactionsByClassification.green,
                            stats.transactionsByClassification.yellow,
                            stats.transactionsByClassification.red,
                        ],
                        backgroundColor: [COLORS.green, COLORS.yellow, COLORS.red],
                        borderRadius: 4,
                        borderSkipped: false,
                        maxBarThickness: 48,
                    }],
                },
                options: {
                    indexAxis: "y",
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: { precision: 0, color: AXIS_LABEL },
                            grid: { color: GRIDLINE },
                        },
                        y: {
                            ticks: { color: AXIS_LABEL_STRONG, font: { weight: "600" } },
                            grid: { display: false },
                        },
                    },
                },
            });

            renderAlertsTable(stats.recentAlerts);
        })
        .catch(function (err) {
            console.error(err);
        });
});
