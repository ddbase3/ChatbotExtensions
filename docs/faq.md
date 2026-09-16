# ChatbotExtensions FAQ

## What is ChatbotExtensions?

ChatbotExtensions is an optional BASE3 plugin that adds structured assistant-response renderers to the modular Chatbot.

Each capability is exposed as a separately discoverable `IAssistantResponseExtension`. All included capabilities are disabled by default and can be enabled independently.

## Which response extensions are included?

The plugin contains extensions for:

- MathJax formulas,
- code formatting,
- callouts,
- KPI cards,
- progress indicators,
- timelines,
- accordions,
- local CSV and JSON downloads,
- same-origin navigation,
- Mermaid diagrams,
- Chart.js charts,
- ModularGrid tables,
- Leaflet point maps.

## Does ChatbotExtensions execute AI models?

No. The plugin does not call a language model itself.

When an extension is enabled, it can contribute instructions that the Chatbot adds to its normal system prompt. The actual model request remains the responsibility of the Chatbot and the selected assistant runtime.

## Are extensions enabled automatically?

No. Every included extension returns `false` from `isEnabledByDefault()`.

The enabled set is managed through the central Chatbot extension settings record.

## Where is the enabled extension configuration stored?

The configuration UI delegates to `ChatbotExtensionService`, which stores the enabled state in the settings record:

```text
chatbot-extensions/default
```

The persisted data is a map of technical extension IDs to boolean enabled states.

## Do the renderers execute model-generated JavaScript or HTML?

No. The structured renderers accept restricted payloads and use fixed browser-side code to create output.

The model is instructed not to emit executable JavaScript, callbacks, arbitrary HTML, CSS, plugin configuration, or undocumented properties for these renderers.

## How are structured responses represented?

Most renderers use dedicated fenced code blocks such as:

```text
base3-chart
base3-table
base3-map
base3-download
base3-callout
```

The browser plugin parses and validates the expected JSON structure before rendering it.

Mermaid is an exception because it uses Mermaid syntax directly inside a `mermaid` code block.

## How is Markdown handled inside extension payloads?

Only selected descriptive fields allow Markdown. Those fields are rendered through the shared Markdown fragment command with nested extension blocks disabled.

Compact labels, titles, metrics, statuses, table cells, filenames, URLs, and other structural values remain plain text.

## Are Chart.js, Mermaid, MathJax, Leaflet, and ModularGrid loaded from external CDNs?

No. The extension definitions resolve those JavaScript and CSS resources through logical ClientStack asset paths.

The browser plugins load the locally deployed assets produced by the active BASE3 asset resolver.

## Does the map extension use external network services?

Yes. Leaflet itself is loaded locally, but the included base maps fetch map tiles directly in the browser from public tile services.

The available base maps are:

- OpenStreetMap Standard,
- Esri World Imagery,
- OpenTopoMap.

Internet access to the selected tile provider is therefore required when the map extension is enabled and used.

## What can the map payload contain?

A map can contain an optional title, one of the fixed map types, and between 1 and 50 points.

Each point contains numeric latitude and longitude, a plain-text label, and an optional short Markdown description. The renderer does not accept custom tile URLs, arbitrary icons, routes, polygons, callbacks, or custom Leaflet configuration.

## Does the table extension make Ajax requests?

No. The ModularGrid extension intentionally works only with local array data already present in the assistant response.

It does not expose Ajax adapters, HTML renderers, actions, exports, storage plugins, callbacks, or arbitrary ModularGrid configuration to model output.

## How do CSV and JSON downloads work?

The data-download renderer creates a browser `Blob` from content already present in the assistant response. It then creates a temporary object URL, triggers a browser download, and revokes the object URL.

The extension does not upload the generated file to a server or external service.

## Can the redirect extension navigate to an external website?

No. The browser plugin resolves the target against the current page and rejects any target whose origin differs from the current origin.

It also rejects URLs containing embedded username or password credentials. Navigation uses fixed extension code rather than model-generated JavaScript.

## When does the redirect extension navigate automatically?

A newly completed assistant message can trigger one navigation when the user explicitly requested navigation and the model emitted a valid redirect block.

A restored conversation message renders the same destination as a normal clickable link without navigating again.

## Is Mermaid rendered in a restricted mode?

Yes. The browser plugin initializes Mermaid with `securityLevel: 'strict'`.

The extension also instructs the model to keep diagram syntax simple and avoid Markdown or nested code fences inside diagram labels.

## Does ChatbotExtensions store conversation content?

No dedicated conversation storage is implemented by this plugin.

Rendered assistant content remains part of the normal Chatbot message flow and can be persisted only if the surrounding Chatbot conversation-memory configuration stores that message.

## Can extension errors expose generated source to the user?

Several renderers provide technical error details that can include the generated extension block and a copy button. This is intended for diagnostics and means the structured source can remain visible in the browser when rendering fails.

## What dependencies are required?

The plugin checks for AssistantFoundation, Chatbot, and ClientStack at runtime. The administration integration described in the current README is provided through the surrounding project setup.

The map extension additionally requires internet access to the selected public tile service.

## Where can I find privacy and data-processing information?

See [PRIVACY.md](../PRIVACY.md).
