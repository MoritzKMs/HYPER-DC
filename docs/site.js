const client = document.querySelector('#client');
const colors = {
  orange: ['#fc7045', '#35241e', 'Mandarin'],
  blue: ['#78b9ed', '#202d37', 'Buz mavisi'],
  green: ['#a2b98a', '#293025', 'Adaçayı'],
  pink: ['#d89cae', '#34272c', 'Gül kurusu']
};
document.querySelectorAll('.swatch').forEach(button => {
  button.addEventListener('click', () => {
    const [accent, surface, label] = colors[button.dataset.color];
    client.style.setProperty('--preview', accent);
    client.style.setProperty('--preview-soft', surface);
    document.querySelector('#color-label').textContent = label;
    document.querySelectorAll('.swatch').forEach(swatch => swatch.setAttribute('aria-pressed', String(swatch === button)));
  });
});
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab) {
  tabs.forEach(button => {
    const active = button === tab;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectTab(tabs[next]); tabs[next].focus(); }
  });
});
const mobile = matchMedia('(max-width:720px)');
function setOrientation() { document.querySelector('[role="tablist"]').setAttribute('aria-orientation', mobile.matches ? 'horizontal' : 'vertical'); }
setOrientation();
mobile.addEventListener('change', setOrientation);
document.querySelector('#compact-toggle').addEventListener('click', event => {
  const button = event.currentTarget;
  const active = button.getAttribute('aria-checked') !== 'true';
  button.setAttribute('aria-checked', String(active));
  client.classList.toggle('compact', active);
});
const motion = matchMedia('(prefers-reduced-motion:reduce)');
let framePending = false;
function updatePerspective() {
  const top = document.querySelector('.perspective').getBoundingClientRect().top;
  const angle = motion.matches || mobile.matches ? 0 : Math.max(0, Math.min(7, (top - 50) / innerHeight * 9));
  client.style.setProperty('--tilt', angle + 'deg');
  framePending = false;
}
function queuePerspective() { if (!framePending) { framePending = true; requestAnimationFrame(updatePerspective); } }
addEventListener('scroll', queuePerspective, { passive: true });
addEventListener('resize', queuePerspective);
motion.addEventListener('change', queuePerspective);
updatePerspective();
