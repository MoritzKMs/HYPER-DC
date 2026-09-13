// HyperDC startup loader. Build directories are immutable; settings stay outside them.
const fs = require("fs");
const path = require("path");
const root = __dirname;
const stateFile = path.join(root, "update-state.json");
function save(state) {
    const temp = stateFile + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(state));
    fs.renameSync(temp, stateFile);
}
function entry(name) {
    if (typeof name !== "string" || !/^[0-9]+\.[0-9]+\.[0-9]+-[a-f0-9]{12}$/.test(name)) throw Error("Invalid HyperDC build");
    return path.join(root, "builds", name, "patcher.js");
}
const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
if (state.pending && state.attempted && state.previous) {
    state.current = state.previous;
    state.previous = null;
    state.pending = false;
    state.rolledBack = true;
    save(state);
}
if (state.pending) { state.attempted = true; save(state); }
try {
    require(entry(state.current));
} catch (error) {
    if (!state.pending || !state.previous) throw error;
    state.current = state.previous;
    state.previous = null;
    state.pending = false;
    state.rolledBack = true;
    save(state);
    // A partially loaded patcher may already have changed Electron state.
    // Restart the process instead of loading a second patcher into that process.
    const { app } = require("electron");
    app.relaunch();
    app.exit(0);
}
