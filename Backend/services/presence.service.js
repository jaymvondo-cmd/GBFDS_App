// How recently someone must have made a request to count as "online".
const ONLINE_WINDOW_MINUTES = 5;

// Don't write to the database on every single request — once a minute
// per user is plenty for a "last seen" display.
const SEEN_WRITE_INTERVAL_MS = 60 * 1000;

/**
 * isOnline — has this account made a request in the last few minutes?
 *
 * Deliberately based on real activity rather than "does a session row
 * exist": session cookies here last 24 hours, so an analyst who logged
 * in yesterday and shut their laptop would otherwise still show as
 * connected all day.
 */
function isOnline(lastSeenAt) {
    if (!lastSeenAt) return false;
    const ageMs = Date.now() - new Date(lastSeenAt).getTime();
    return ageMs <= ONLINE_WINDOW_MINUTES * 60 * 1000;
}

/**
 * describeLastSeen — turns a timestamp into something readable
 * ("3 minutes ago", "Yesterday", "Never").
 */
function describeLastSeen(lastSeenAt) {
    if (!lastSeenAt) return "Never";

    const then = new Date(lastSeenAt);
    const diffMs = Date.now() - then.getTime();
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return minutes + (minutes === 1 ? " minute ago" : " minutes ago");

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");

    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return days + " days ago";

    return then.toLocaleDateString();
}

/**
 * shouldWriteLastSeen — throttle guard, so a burst of page loads
 * doesn't cause a burst of writes.
 */
function shouldWriteLastSeen(lastSeenAt) {
    if (!lastSeenAt) return true;
    return Date.now() - new Date(lastSeenAt).getTime() > SEEN_WRITE_INTERVAL_MS;
}

module.exports = {
    isOnline,
    describeLastSeen,
    shouldWriteLastSeen,
    ONLINE_WINDOW_MINUTES,
};
