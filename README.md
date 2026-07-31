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

The administration display includes localized example prompts for every capability in all twelve supported administration languages.

## Architecture

ClientStack owns only the generic Chatbot plugin lifecycle and neutral message-content hooks. All capability-specific code is contained in this plugin:

- model output contract
- browser adapter
- asset URLs
- configuration metadata
- examples
- tests

MathJax-specific Markdown protection is implemented by `assets/chatbot/MathJaxPlugin.js` through the generic `prepareMessageContent` and `finalizeMessageContent` hooks. ClientStack contains no MathJax parser or connector logic.

The structured renderers use fenced JSON blocks and create DOM nodes with `textContent`. They do not execute model-generated JavaScript or HTML.

Extensions are discovered through `AssistantFoundation\Api\IAssistantResponseExtension` and activated through the central `chatbot-extensions/default` settings record.

## Dependencies

- AssistantFoundation
- Chatbot
- ClientStack
- Base3IliasLab for the administration subtab

MathJax uses the library already deployed by ClientStack. The other included capabilities require no external JavaScript library.

The plugin is optional. If it is not installed, no response extension is discovered and the Chatbot continues without extension model instructions or browser code.
