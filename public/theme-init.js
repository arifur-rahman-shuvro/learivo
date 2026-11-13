// Apply the saved theme before first paint to avoid a flash.
try {
  const theme = localStorage.getItem("learivo.theme");
  const mode = localStorage.getItem("learivo.mode");
  if (theme) document.documentElement.setAttribute("data-theme", theme);
  if (mode) document.documentElement.setAttribute("data-mode", mode);
} catch {
  // Storage can be blocked (private windows); the default theme is fine then.
}
