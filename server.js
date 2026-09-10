// The real server lives in Backend/server.js. Running `node server.js` from
// the repo root used to die with:
//   Error: Cannot find module '...\GBFDS_App\server.js'
// This shim forwards to the real entry point so the command works from the
// repo root as well as from inside Backend/.
//
// Backend/server.js and Backend/config/config.js both call
// require("dotenv").config() with no path, which loads .env relative to the
// current working directory. So we switch into Backend/ first — otherwise the
// database credentials and SESSION_SECRET come up undefined and the app fails
// to connect.
const path = require("path");

process.chdir(path.join(__dirname, "Backend"));
require("./Backend/server.js");
