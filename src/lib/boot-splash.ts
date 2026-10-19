/**
 * Hands the first paint over from the static boot splash in index.html to React.
 *
 * The splash is plain HTML/CSS, so it is on screen immediately — even before the
 * JavaScript bundle has been downloaded and parsed. Removing it only after React
 * has committed a frame avoids a blank flash in between.
 */
export function hideBootSplash() {
  const boot = document.getElementById("tcy-boot");
  if (!boot) return;

  boot.classList.add("is-done");
  window.setTimeout(() => boot.remove(), 260);
}
