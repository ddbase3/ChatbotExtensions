# ChatbotExtensions

Optional response renderers for the modular BASE3 Chatbot.

Every capability is a separately discoverable `AssistantFoundation\Api\IAssistantResponseExtension` and can be enabled in the Base3IliasLab administration under **Chatbot → Extensions**. All capabilities are disabled by default.

Included capabilities:

- MathJax formulas
- callouts and notices
- KPI cards
- progress indicators
- timelines
- accordions and detail sections
- local CSV and JSON downloads
- Mermaid diagrams
- Chart.js charts
- ModularGrid data tables
- Leaflet point maps

The administration display includes localized example prompts for every capability in all twelve supported administration languages.

## Architecture

ClientStack owns only the generic Chatbot plugin lifecycle, neutral message-content hooks, and reusable browser libraries. All capability-specific integration code is contained in this plugin:

- model output contract
- browser adapter
- asset URLs
- configuration metadata
- examples
- tests

MathJax-specific Markdown protection is implemented by `assets/chatbot/MathJaxPlugin.js` through the generic `prepareMessageContent` and `finalizeMessageContent` hooks. ClientStack contains no MathJax parser or connector logic.

Structured renderers use dedicated fenced blocks and validate their payloads before creating browser output. They do not execute model-generated JavaScript or HTML.

Extensions are discovered through `AssistantFoundation\Api\IAssistantResponseExtension` and activated through the central `chatbot-extensions/default` settings record.

## Library-backed extensions

The following extensions use libraries already deployed by ClientStack:

- `MermaidExtension` renders `mermaid` code blocks with Mermaid.
- `ChartExtension` renders restricted `base3-chart` JSON blocks with Chart.js.
- `ModularGridExtension` renders restricted `base3-table` JSON blocks with ModularGrid.
- `LeafletMapExtension` renders restricted `base3-map` JSON blocks with Leaflet.

The ModularGrid extension intentionally uses only local array data, plain scalar cells, sorting, optional search, and optional paging. It does not expose Ajax adapters, HTML renderers, actions, export, storage plugins, callbacks, or arbitrary ModularGrid configuration to assistant output.

The Leaflet extension accepts only a title, one of three fixed base-map types, and a list of coordinate points with plain-text labels and descriptions. The available base maps are OpenStreetMap Standard, Esri World Imagery, and OpenTopoMap. The renderer automatically fits the map to all points and does not expose tile URLs, center, zoom, bounds, custom icons, overlays, routes, or arbitrary Leaflet configuration to assistant output.

## Dependencies

- AssistantFoundation
- Chatbot
- ClientStack
- Base3IliasLab for the administration subtab
- Internet access to the configured public tile services when Leaflet maps are enabled

The plugin is optional. If it is not installed, no response extension is discovered and the Chatbot continues without extension model instructions or browser code.
