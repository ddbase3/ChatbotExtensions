<?php declare(strict_types=1);

/***********************************************************************
 * This file is part of ChatbotExtensions for BASE3 Framework.
 *
 * ChatbotExtensions provides optional assistant response renderers for
 * the modular Chatbot client.
 *
 * Developed by Daniel Dahme
 * Licensed under GPL-3.0
 * https://www.gnu.org/licenses/gpl-3.0.en.html
 **********************************************************************/

namespace ChatbotExtensions\Extension;

use AssistantFoundation\Dto\AssistantResponseClientPlugin;

final class MathJaxExtension extends AbstractChatbotExtension {

	public static function getName(): string {
		return 'mathjaxextension';
	}

	public function id(): string {
		return 'mathjax';
	}

	public function getLabel(): string {
		return 'Mathematical formulas (MathJax)';
	}

	public function getDescription(): string {
		return 'Lets the assistant emit MathJax TeX and typesets completed or restored assistant messages.';
	}

	public function getPriority(): int {
		return 100;
	}

	public function getRequirements(): array {
		return ['ClientStack MathJax library'];
	}

	public function getExamplePrompts(): array {
		return [
			'Explain the quadratic formula and show the derivation with properly rendered formulas.',
			'Create a short linear algebra example with a matrix, a column vector, and their product.'
		];
	}

	public function getSystemPrompt(array $context): string {
		$rendererInstruction = !empty($context['use_markdown'])
			? 'The Markdown renderer is followed by a MathJax-aware extension. Write ordinary TeX and do not double delimiter backslashes for Markdown.'
			: 'The response is rendered without Markdown. Write ordinary MathJax TeX.';

		return $rendererInstruction . "\n\n" . <<<'PROMPT'
MathJax output contract:
- Write every mathematical expression as valid TeX inside MathJax delimiters, including expressions in headings, table cells, option lists, captions, hints, and final summaries.
- Use \( ... \) for inline formulas and \[ ... \] for display formulas.
- Plain parentheses such as ( ... ) are punctuation, not MathJax delimiters. Never write TeX commands inside plain parentheses.
- Never emit commands such as \mathbf, \mathcal, \det, \lambda, \frac, \sqrt, \begin, or \end outside MathJax delimiters.
- Do not substitute Unicode mathematical alphabets, superscript characters, subscript characters, or invisible multiplication signs for TeX. Write variables, powers, indices, vectors, matrices, and operators as TeX inside delimiters.
- Before finishing the answer, verify that every mathematical expression and every backslash-led TeX command is enclosed by MathJax delimiters.

For short expressions in prose or Markdown tables, use inline formulas. Example:
\(\mathcal{O}(1/n)\)

Do not write:
(\mathcal{O}(1/n))

Use display formulas for derivations, equation chains, matrices, fractions, roots, vectors, and any expression that could exceed the text width.
Write every derivation as a multi-line aligned environment with one transformation per row.
Use this structure:
\[
\begin{aligned}
a &= b \\
  &= c
\end{aligned}
\]

Always write column vectors and matrices as display formulas with a matrix environment. Use & between columns and \\ between rows. Never imitate a vector or matrix with spaces, tabs, Unicode glyphs, or plain text lines.
Use these structures:
\[
\mathbf{a} =
\begin{bmatrix}
2 \\
-1
\end{bmatrix}
\]

\[
A =
\begin{bmatrix}
1 & 2 & 3 \\
0 & 1 & 4 \\
5 & 6 & 0
\end{bmatrix}
\]

In multiple-choice options, delimit every mathematical part. Examples:
A) The scalar product is \(\mathbf{a} \cdot \mathbf{b} = 1\).
B) The angle is \(\theta = 90^\circ\).
C) The circumference is \(10\pi\).
D) The matrix has eigenvalue \(\lambda = 0\).

Never put a derivation or a long chain of equalities on one line.
Do not wrap formulas in Markdown code spans or fenced code blocks.
Do not use dollar-sign delimiters for mathematics.
PROMPT;
	}

	public function getClientPlugin(array $context): ?AssistantResponseClientPlugin {
		return new AssistantResponseClientPlugin(
			'mathjax',
			$this->resolveVersionedAsset('plugin/ChatbotExtensions/assets/chatbot/MathJaxPlugin.js'),
			'MathJaxPlugin',
			[
				'scriptUrl' => $this->assetResolver->resolve(
					'plugin/ClientStack/assets/mathjax/tex-mml-chtml.js'
				),
				'protectMarkdown' => !empty($context['use_markdown'])
			]
		);
	}
}
