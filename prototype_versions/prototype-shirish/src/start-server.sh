#!/bin/sh
# Launch Sequence (Mac/Linux) - starts the server, which also serves the app.
# Then open the link it prints on every phone/laptop on the same Wi-Fi. No host screen.
cd "$(dirname "$0")/server"
[ -d node_modules ] || npm install
npm start
