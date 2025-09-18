# Copilot Instructions for propeller (Raycast GitHub Docs Extension)

## Project Overview
- This is a Raycast extension for searching GitHub Docs using Copilot and the GitHub Docs AI search API.
- Main commands: `search` (quick search via selected text/clipboard) and `searchWithForm` (form-based search UI).
- TypeScript and React (with hooks) are used throughout. Raycast APIs are the primary integration point.

## Architecture & Data Flow
- All source code is in `src/`.
- `search.ts`: Implements the quick search command. Gets query from selected text or clipboard, calls the GitHub Docs AI search API, and copies the answer to clipboard.
- `searchWithForm.tsx`: Implements a form-based search UI. Submits queries to the same API, displays results and sources in a Raycast Detail view.
- Both commands use the same endpoint: `https://docs.github.com/api/ai-search/v1` (POST, NDJSON response).
- Preferences (e.g., docs version) are read via Raycast's `getPreferenceValues`.

## Developer Workflow
- Install dependencies: `npm install`
- Start development: `npm run dev` (runs Raycast extension locally)
- Build: `npm run build`
- Lint: `npm run lint` or `npm run fix-lint`
- Publish: `npm run publish` (to Raycast Store)
- Do NOT publish to npm; see the `prepublishOnly` script for details.

## Project-Specific Conventions
- Use Raycast's UI primitives (`Form`, `Detail`, `ActionPanel`, etc.) for all user-facing components.
- API requests must use the provided headers (see `src/search.ts` and `src/searchWithForm.tsx`) to avoid API errors.
- Handle NDJSON responses by splitting lines and parsing each as JSON; extract `MESSAGE_CHUNK` and `SOURCES`.
- Always show user feedback via Raycast toasts for errors, loading, and success.
- Prefer clipboard and selected text as query sources for quick search.
- Form-based search should provide clear error and loading states in the UI.
- Use the helper `getTitleFromUrl` to format source links for display.

## Integration Points
- Raycast APIs: UI, navigation, preferences, clipboard, toast notifications.
- External: GitHub Docs AI search API (`node-fetch` for requests).
- No persistent storage or backend; all state is ephemeral and local.

## Patterns & Examples
- Functional React components with hooks (see `SearchForm` and `SearchResults` in `src/searchWithForm.tsx`).
- TypeScript interfaces for props, state, and API payloads.
- Error handling: always catch and display errors via Raycast toasts or UI.
- NDJSON parsing: iterate lines, parse JSON, extract answer and sources.
- UI actions: copy to clipboard, open source links, new search navigation.

## Key Files
- `src/search.ts`: Quick search command logic
- `src/searchWithForm.tsx`: Form-based search UI and results
- `package.json`: Commands, preferences, scripts, dependencies
- `README.md`: Setup and usage instructions

## Example: API Request Pattern
```ts
const response = await fetch("https://docs.github.com/api/ai-search/v1", { ... });
const lines = (await response.text()).trim().split("\n");
for (const line of lines) {
  const data = JSON.parse(line);
  // Extract answer and sources
}
```

## Additional Notes
- Follow Raycast and ReactJS best practices (see `.github/instructions/reactjs.instructions.md`).
- Keep UI responsive and provide clear feedback for all user actions.
- Do not add backend or persistent state; keep all logic local and ephemeral.
