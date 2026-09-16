# ChatbotExtensions Privacy and Data Processing

> This document describes the data processing directly visible in the ChatbotExtensions plugin. It is technical documentation, not a legal privacy notice. The surrounding Chatbot, assistant runtime, browser, and deployment configuration can introduce additional processing that must be documented separately.

## Scope

ChatbotExtensions provides optional browser-side renderers for structured assistant output. The plugin does not implement a language model, conversation store, user directory, retrieval backend, or general-purpose logging service.

Most processing happens locally in the browser after an assistant message has already been received. The main privacy-relevant exception is the Leaflet map extension, which retrieves map tiles from public third-party tile services.

## Included capabilities

The plugin provides response extensions for:

- MathJax formulas,
- code formatting,
- callouts,
- KPI cards,
- progress indicators,
- timelines,
- accordions,
- CSV and JSON downloads,
- same-origin navigation,
- Mermaid diagrams,
- Chart.js charts,
- ModularGrid tables,
- Leaflet maps.

All included extensions are disabled by default.

## Extension enablement settings

The administration display reads the selected extension IDs from the request and delegates persistence to `ChatbotExtensionService`.

The central settings record is:

```text
chatbot-extensions/default
```

The stored structure contains technical extension IDs and boolean enabled states. It does not contain chat prompts, assistant messages, map coordinates, chart data, or downloaded file content.

The physical storage, backups, and retention of this settings record are determined by the active `ISettingsStore` backend used by the surrounding Chatbot installation.

## Model instructions

An enabled extension can contribute a system-prompt block that describes the structured output contract for that renderer.

ChatbotExtensions itself does not send those instructions to a model. The surrounding Chatbot and active assistant runtime perform the model request.

Because the model produces the structured response content, any personal or confidential data included in a chart, table, map, timeline, download, or other extension block has already passed through the normal assistant-processing path before this plugin renders it.

## Browser rendering and persistence

The browser plugins process assistant content already present in the chat UI.

ChatbotExtensions does not provide a dedicated server-side store for rendered content. Whether the original assistant message is persisted depends on the conversation-memory behavior of the surrounding Chatbot configuration.

The browser renderers do not use `localStorage` or `sessionStorage` for extension content in the supplied implementation.

## Local libraries

The following renderer libraries are loaded through local ClientStack asset paths resolved by the BASE3 asset resolver:

- MathJax,
- Mermaid,
- Chart.js,
- ModularGrid,
- Leaflet.

The plugin therefore does not require a public CDN for these JavaScript or CSS libraries.

Loading those local assets follows the normal same-origin asset behavior of the installation unless the host asset resolver deliberately maps them elsewhere.

## Structured-content safety boundary

The structured renderers use fixed schemas and browser-side validation.

Examples of enforced restrictions include:

- charts accept only supported chart types, labels, numeric datasets, and a small set of options,
- tables accept only declared scalar columns and rows and do not expose Ajax or callback configuration,
- maps accept only fixed map types and point coordinates,
- redirects must remain on the current origin,
- downloads accept only CSV or JSON content,
- descriptive Markdown fields are rendered with nested extension blocks disabled.

The model is not permitted to provide arbitrary executable JavaScript or HTML for these capabilities.

## Markdown-enabled fields

The implementation allows Markdown only in selected descriptive fields, including:

- `callout.text`,
- `kpi.items[].detail`,
- `timeline.items[].text`,
- `accordion.items[].markdown`,
- `map.points[].description`.

Other structural fields remain plain text.

The surrounding Markdown renderer is responsible for its own sanitization and link behavior. ChatbotExtensions does not independently define the complete Markdown security policy.

## Chart rendering

The chart extension renders structured data through the locally deployed Chart.js library.

The accepted payload does not expose:

- arbitrary Chart.js plugins,
- callbacks,
- custom JavaScript,
- URLs,
- HTML,
- arbitrary native `data` or `options` objects.

Chart data remains in the browser after it has arrived as part of the assistant response. The extension does not transmit chart data to Chart.js as a network service.

## Mermaid rendering

The Mermaid extension uses the locally deployed Mermaid library and initializes it with:

```text
securityLevel: strict
```

The diagram source is processed in the browser. ChatbotExtensions does not send Mermaid source to an external rendering service.

If diagram rendering fails, the browser error view can display the generated Mermaid source as technical details and allow the user to copy it.

## MathJax rendering

The MathJax extension loads the locally deployed MathJax script and typesets mathematical expressions in the browser.

The formula content is not sent to an external MathJax service by this plugin.

## ModularGrid tables

The ModularGrid extension operates on local array data contained in the assistant response.

The model-facing contract intentionally excludes:

- Ajax adapters,
- remote data sources,
- HTML render functions,
- actions,
- arbitrary plugins,
- callbacks,
- storage plugins,
- export adapters,
- arbitrary ModularGrid configuration.

Search, sorting, paging, and table rendering therefore happen locally in the browser.

## Local CSV and JSON downloads

The data-download renderer creates a `Blob` in the browser from content already included in the assistant response.

The flow is:

1. validate the format and filename,
2. serialize the CSV or JSON content,
3. create a browser object URL,
4. trigger a local file download,
5. revoke the temporary object URL.

The plugin does not upload the generated file to the server or an external file service.

The resulting file becomes subject to the user's local device security, browser download settings, endpoint protection, and local retention after download.

## Same-origin redirect extension

The redirect renderer accepts exactly a URL and a plain-text label.

Before navigation, the browser plugin:

- resolves the target against the current page,
- requires the target origin to equal the current origin,
- rejects embedded username or password credentials.

The renderer does not intentionally navigate to an external origin.

A valid redirect can still cause the browser to load another page within the same application, and that destination can perform its own normal data processing.

## Leaflet map extension

The Leaflet JavaScript and CSS are loaded locally, but the actual base-map tiles are requested directly by the browser from external public services.

The supplied implementation contains these tile endpoints:

| Map type | Tile service |
|---|---|
| Street | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |
| Satellite | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` |
| Topographic | `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png` |

When a map is rendered, the browser requests the tiles needed for the visible map extent and zoom level.

Those requests can disclose to the tile provider information normally associated with browser HTTP requests, such as:

- the user's public IP address,
- browser and network request metadata,
- request timing,
- tile coordinates and zoom levels.

The requested tile coordinates can reveal the geographic area currently being viewed. This can be relevant when map content relates to sensitive or person-specific locations.

The assistant response also contains the actual marker coordinates and labels, but the supplied Leaflet implementation does not send the complete marker list to the tile provider as a separate API payload. The provider receives tile requests corresponding to the map area rendered by the browser.

The installation must review the privacy terms, processing regions, retention, and usage policies of the selected tile services if the map extension is enabled.

If external tile requests are not acceptable, the map extension should remain disabled or the implementation should be changed at the responsible map-service boundary rather than relying on an undocumented fallback path.

## Map content handled in the browser

A valid map block can contain:

- an optional title,
- one fixed map type,
- 1 to 50 coordinate points,
- a plain-text label for each point,
- an optional Markdown description for each point.

The renderer uses those values to create local Leaflet markers, tooltips, and popups.

Map payloads can therefore contain personal or confidential location data. Such coordinates and labels should only be generated when appropriate for the underlying chatbot use case.

## Error diagnostics

Several browser renderers replace invalid content with an error panel. Depending on the extension, the panel can include:

- the validation or rendering error message,
- the original generated extension source,
- a button to copy that source.

This is useful for diagnostics, but it means confidential content in a failed structured block may remain visible in the browser UI.

The plugin does not define a separate server-side error log for these renderer failures. Browser plugins emit a `chatbot:error` event to the surrounding chat client.

## Clipboard use

Some renderer error views provide a copy button for generated source. The implementation uses the browser Clipboard API when available and otherwise falls back to a temporary hidden textarea and the browser copy command.

Clipboard contents are controlled by the user's browser and operating system after copying.

## No independent user profiling

The supplied component does not implement:

- analytics,
- behavioral profiling,
- advertising trackers,
- a user database,
- a dedicated conversation database,
- extension-specific user identifiers.

Any such processing in the final application would come from other components or the hosting environment and must be documented separately.

## Data minimization guidance

For a privacy-conscious deployment:

- enable only the extensions that are actually required,
- do not place unnecessary personal data into structured assistant blocks,
- consider whether location data is appropriate before enabling maps,
- review the public map tile providers before production use,
- treat downloaded CSV and JSON files as local exports that may contain sensitive data,
- review error-detail visibility if structured payloads can contain confidential information,
- keep the same-origin redirect extension limited to trusted application destinations.

## Installation-specific documentation required

Before production use, an installation that enables ChatbotExtensions should document at least:

- which extensions are enabled,
- whether conversation history stores extension blocks,
- whether the asset resolver keeps local libraries on the same origin,
- whether the Leaflet map extension is enabled,
- which public tile services are permitted,
- the privacy and retention terms of those tile services,
- whether exported CSV or JSON content can contain personal data,
- how technical rendering errors are exposed to users,
- any additional processing introduced by the surrounding Chatbot and assistant runtime.
