#!/bin/bash
# Direct start script - use if npm scripts don't work
cd "$(dirname "$0")"
node server/server.js
