// Copies the web app into www/ (the folder Capacitor packages into the APK).
import fs from "fs";
fs.rmSync("www", { recursive: true, force: true });
fs.cpSync("web", "www", { recursive: true, filter: p => !/testdata|\.mjs$/.test(p) || /engine\.js$/.test(p) });
console.log("www/ ready:", fs.readdirSync("www").join(", "));
