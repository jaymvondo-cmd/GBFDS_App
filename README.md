# Sentinel (GBFDS)

Fraud detection tool for CCA Bank. A **System Admin** manages accounts and
detection rules; a **Fraud Analyst** reviews the alerts those rules raise and
traces money through the transaction graph.

Node.js + Express + MySQL, server-rendered with EJS. There is also a JSON API
(JWT) for a future React Native app.

---

## Every time you want to run it

**1. Start MySQL** — open the XAMPP Control Panel, press **Start** next to MySQL.

**2. Start the app** — double-click **`start-app.bat`**, or:

```bash
cd Backend
npm.cmd start
```

Leave that window open. It prints:

```
Server is running on port 3000
  On this computer:  http://localhost:3000
  On your Wi-Fi:     http://192.168.1.200:3000
```

**3. Open it** at <http://localhost:3000>

That is all you need for working on your own computer.

---

## Opening it on a phone

**Phone on the same Wi-Fi** — use the `On your Wi-Fi` address that
`start-app.bat` prints, for example `http://192.168.1.200:3000`.

Type `http://` yourself. Safari assumes `https://` and then fails with
"couldn't establish a secure connection", because this address is plain HTTP.
The IP can change when your router restarts; `start-app.bat` always prints the
current one.

**Phone on mobile data, another network, or someone else's phone** — leave
`start-app.bat` running and also double-click **`share-phone.bat`**.

It prints a public address like `https://something-random.trycloudflare.com`.
That works from anywhere and is real HTTPS, so Safari accepts it. Open the link
on the phone, or message it to yourself.

Notes:
- The address is **different every time** you start it.
- It is **public** — anyone with the link reaches the login page. Close the
  window when you are done.
- Your computer must stay awake, with MySQL, `start-app.bat` and
  `share-phone.bat` all still running.

One-time install for that feature:

```bash
winget install --id Cloudflare.cloudflared
```

---

## Roles

| | Admin | Analyst |
|---|---|---|
| Dashboard, alerts, transactions, money flow map | view | view |
| Confirm / dismiss / escalate an alert | no | **yes** |
| Create and manage user accounts | **yes** | no |
| Detection rules and alert threshold | **yes** | no |
| System health and audit logs | **yes** | no |

An admin can see everything but cannot decide on an alert. The person who
configures the rules should not also be the one clearing the alerts those rules
raise — that is what keeps a second pair of eyes on every decision.

Accounts are created by an admin under **Manage users**. There is no public
sign-up.

---

## Useful commands

Run these from the `Backend` folder.

| Command | What it does |
|---|---|
| `npm.cmd start` | Start the app |
| `npm.cmd run db:sync` | Create/update the database tables |
| `npm.cmd run seed` | Create the first admin account from `.env` |
| `npm.cmd run seed:rules` | Add the four starter detection rules |
| `npm.cmd run seed:transactions` | Add sample transactions so the screens have data |

---

## When something goes wrong

**"Port 3000 is already being used"** — the app is already running somewhere.
Check your other terminal windows. To find and stop it:

```bash
netstat -ano | findstr :3000
taskkill /F /PID <the number at the end of that line>
```

Use the specific PID. `taskkill /F /IM node.exe` kills *every* Node process,
including VS Code's own, which is rarely what you want.

**The terminal closes instantly** — usually the port clash above. The app now
prints the reason before exiting, so read the last lines before the window goes.

**"Safari cannot establish a secure connection"** — Safari forced `https://` on
a plain-HTTP address. Type the address with `http://` in a private tab, or use
`share-phone.bat` for a real HTTPS link.

**Pages load but there is no data** — MySQL is not running, or the database is
empty. Start MySQL in XAMPP, then run the seed commands above.

---

## Setup on a new computer

```bash
cd Backend
npm.cmd install
```

Copy `.env.example` to `.env` and fill in your MySQL details, then:

```bash
npm.cmd run db:sync
npm.cmd run seed
npm.cmd run seed:rules
```

`.env` holds passwords and is deliberately never committed.
