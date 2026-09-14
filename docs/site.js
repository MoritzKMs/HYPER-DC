"use strict";
const wave = document.querySelector(".wave");
const heights = [22,38,53,35,62,88,70,44,65,94,78,55,36,60,82,96,62,40,25,52,71,90,66,44,30,58,76,52,33,20];
heights.forEach(height => { const bar = document.createElement("i"); bar.style.setProperty("--bar", `${height}%`); wave.append(bar); });
document.querySelectorAll("[data-preset]").forEach((button, index) => button.addEventListener("click", () => {
 document.querySelectorAll("[data-preset]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
 document.querySelector("#voice-label").textContent = button.dataset.preset;
 [...wave.children].forEach((bar, i) => bar.style.setProperty("--bar", `${heights[(i + index * 7) % heights.length]}%`));
}));
const stage = document.querySelector(".stage");
const rig = document.querySelector(".rig");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let frame;
stage.addEventListener("pointermove", event => {
 if (reduced.matches || event.pointerType !== "mouse") return;
 cancelAnimationFrame(frame);
 frame = requestAnimationFrame(() => { const rect = stage.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width - .5; const y = (event.clientY - rect.top) / rect.height - .5; rig.style.transform = `rotateY(${-16 + x * 9}deg) rotateX(${8 - y * 7}deg) rotateZ(-7deg)`; });
});
stage.addEventListener("pointerleave", () => { cancelAnimationFrame(frame); rig.style.transform = ""; });
