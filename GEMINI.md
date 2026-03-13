# Obsidian Plugin Development Rules

Follow these rules strictly to ensure the plugin meets the requirements for the Obsidian Community Plugins repository.

## 1. Naming & Metadata
- **Plugin ID:** Must NOT contain the word "obsidian".
- **Description:** Must NOT contain the word "Obsidian".
- **Consistency:** The description in `manifest.json` must exactly match the GitHub release and PR description.
- **Root Files:** `manifest.json` and `LICENSE` must be at the root.

## 2. Obsidian API & Architecture
- **Network Requests:** Use Obsidian's `requestUrl` instead of the standard `fetch` API.
- **DOM Manipulation:**
  - DO NOT use `innerHTML` or `outerHTML`. Use `createEl`, `createDiv`, `createSpan`, etc.
  - DO NOT use `querySelector`. Save references to elements created via `createEl` or use `firstElementChild` / `lastElementChild`.
  - Use `setIcon(element, 'icon-id')` for icons instead of raw SVGs or `innerHTML`.
- **UI Elements:** Use the Obsidian `Setting` API for UI elements (headings, inputs, toggles) whenever possible.
- **Workspace Management:** DO NOT detach leaves in `onunload`. This preserves user layout preferences.
- **Utility Functions:** Use `setCssProps` for dynamic style changes instead of direct `element.style` manipulation.

## 3. Code Quality & TypeScript
- **Type Safety:** 
  - Avoid using the `any` type. Define specific interfaces or use `unknown` with type guards.
  - When parsing JSON or handling external data, always cast to a specific interface (e.g., `JSON.parse(content) as MyInterface`).
- **Asynchronous Patterns:** 
  - Do NOT mark methods as `async` if they do not contain an `await` expression.
  - Ensure all Promises are properly awaited or handled with `.catch()` / `void` operator for floating promises.
  - Verify if an API method is a Promise before `await`ing it (e.g., `result.response` is often a property, not a Promise).
- **Scoping:** Use arrow functions for callbacks to ensure `this` correctly refers to the class instance.
- **Console Usage:** DO NOT use `console.log`. Only `console.warn`, `console.error`, and `console.debug` are permitted.

## 4. UI/UX & Styling
- **Text Case:** Use **Sentence case** for all UI text (e.g., "Open Gemini chat", not "Open Gemini Chat").
  - Brand names (e.g., "Gemini", "Google", "AI") should preserve their official casing.
- **Styling:** Prefer CSS classes defined in `styles.css` over inline styles.
- **Native Dialogs:** DO NOT use native `confirm()`, `alert()`, or `prompt()`. Use Obsidian's `Notice` or `Modal`.

## 6. Linting & Maintenance
- **ESLint:** Use `eslint-plugin-obsidianmd` for official Obsidian rules.
- **Long-term Maintenance:** 
  - Keep `eslint.config.mjs` updated with necessary brands in the `sentence-case` rule.
  - Run `pnpm lint` before every commit to catch issues early.
  - Always fix lint errors rather than disabling them (unless in specific test scenarios).

## 5. Security
- Treat all external input (especially from AI) as untrusted.
- Use `MarkdownRenderer.render` for rendering AI-generated content to ensure it is safely sanitized.
