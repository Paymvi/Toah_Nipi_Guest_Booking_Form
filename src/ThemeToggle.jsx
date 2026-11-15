import { useState } from "react";
import { applyTheme, saveTheme } from "./theme";

// Same control as the booking software's ThemeToggle. Inline icons, so no icon package is needed.
const SunIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
  </svg>
);

const THEMES = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "night", label: "Night", Icon: MoonIcon },
];

export default function ThemeToggle() {
  // index.html has already applied the saved theme to the root element.
  const [theme, setTheme] = useState(document.documentElement.dataset.theme);

  const chooseTheme = (nextTheme) => {
    applyTheme(nextTheme);
    saveTheme(window.localStorage, nextTheme);
    setTheme(nextTheme);
  };

  return (
    <fieldset className="theme-toggle" aria-label="Color theme">
      {THEMES.map(({ value, label, Icon }) => (
        <label key={value} title={`${label} theme`}>
          <input
            type="radio"
            name="color-theme"
            value={value}
            checked={theme === value}
            onChange={() => chooseTheme(value)}
          />
          <Icon />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
