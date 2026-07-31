<?php
	$e = static fn(mixed $value): string => htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
	$extensions = is_array($this->_['extensions'] ?? null) ? $this->_['extensions'] : [];
	$messages = is_array($this->_['messages'] ?? null) ? $this->_['messages'] : [];
	$formId = (string)($this->_['formId'] ?? 'base3_chatbot_extensions_config');
	$saveUrl = (string)($this->_['saveUrl'] ?? '');
	$requestError = (string)($this->_['requestError'] ?? 'Extension settings could not be saved.');
	$copyPromptLabel = (string)($this->_['copyPromptLabel'] ?? 'Copy prompt');
	$copiedPromptLabel = (string)($this->_['copiedPromptLabel'] ?? 'Copied');
?>
<style>
	.base3-chatbot-extensions { max-width: 960px; }
	.base3-chatbot-extensions-intro { margin-bottom: 1.5rem; }
	.base3-chatbot-extension-messages { margin-bottom: 1rem; }
	.base3-chatbot-extension-list { display: grid; gap: 1rem; margin: 1.5rem 0; }
	.base3-chatbot-extension { display: grid; grid-template-columns: auto 1fr; gap: 0.85rem; padding: 1rem; border: 1px solid #d8d8d8; border-radius: 4px; background: #fff; }
	.base3-chatbot-extension-toggle { margin-top: 0.3rem; }
	.base3-chatbot-extension h3 { margin: 0 0 0.35rem; font-size: 1.1rem; }
	.base3-chatbot-extension p { margin: 0.25rem 0; }
	.base3-chatbot-extension-code { color: #666; font-family: monospace; font-size: 0.9rem; }
	.base3-chatbot-extension-requirements { color: #555; font-size: 0.9rem; }
	.base3-chatbot-extension-examples { margin-top: 0.9rem; }
	.base3-chatbot-extension-examples strong { display: block; margin-bottom: 0.4rem; }
	.base3-chatbot-extension-example { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 0.5rem; margin-top: 0.5rem; }
	.base3-chatbot-extension-example code { display: block; min-width: 0; padding: 0.55rem 0.65rem; border-radius: 3px; background: #f5f5f5; white-space: pre-wrap; overflow-wrap: anywhere; }
	.base3-chatbot-extension-copy { white-space: nowrap; }
	.base3-chatbot-extension-actions { margin-top: 1rem; }
	.base3-chatbot-extension-submit[disabled] { cursor: wait; opacity: 0.65; }
	@media (max-width: 640px) {
		.base3-chatbot-extension-example { grid-template-columns: 1fr; }
		.base3-chatbot-extension-copy { justify-self: start; }
	}
</style>

<section class="base3-chatbot-extensions">
	<h2><?php echo $e($this->_['title'] ?? 'Chatbot Extensions'); ?></h2>
	<p class="base3-chatbot-extensions-intro"><?php echo $e($this->_['description'] ?? ''); ?></p>

	<form
		id="<?php echo $e($formId); ?>"
		method="post"
		action="<?php echo $e($saveUrl); ?>"
		data-save-url="<?php echo $e($saveUrl); ?>"
	>
		<input type="hidden" name="chatbot_extensions_action" value="save" />

		<div class="base3-chatbot-extension-messages" data-base3-chatbot-extension-messages>
			<?php foreach ($messages as $message) { ?>
				<div class="alert alert-<?php echo $e($message['type'] ?? 'info'); ?>" role="status">
					<?php echo $e($message['text'] ?? ''); ?>
				</div>
			<?php } ?>
		</div>

		<?php if ($extensions === []) { ?>
			<p><?php echo $e($this->_['noExtensionsLabel'] ?? 'No extensions are installed.'); ?></p>
		<?php } else { ?>
			<div class="base3-chatbot-extension-list">
				<?php foreach ($extensions as $extension) {
					$id = (string)($extension['id'] ?? '');
					$fieldId = $formId . '_' . preg_replace('/[^a-z0-9_-]+/i', '_', $id);
					$requirements = is_array($extension['requirements'] ?? null) ? $extension['requirements'] : [];
					$examples = is_array($extension['example_prompts'] ?? null) ? $extension['example_prompts'] : [];
				?>
					<div class="base3-chatbot-extension">
						<input
							id="<?php echo $e($fieldId); ?>"
							class="base3-chatbot-extension-toggle"
							type="checkbox"
							name="enabled_extensions[]"
							value="<?php echo $e($id); ?>"
							data-extension-id="<?php echo $e($id); ?>"
							<?php echo !empty($extension['enabled']) ? ' checked="checked"' : ''; ?>
						/>
						<div>
							<h3><label for="<?php echo $e($fieldId); ?>"><?php echo $e($extension['label'] ?? $id); ?></label></h3>
							<p><?php echo $e($extension['description'] ?? ''); ?></p>
							<p class="base3-chatbot-extension-code"><?php echo $e($id); ?></p>
							<?php if ($requirements !== []) { ?>
								<p class="base3-chatbot-extension-requirements">
									<strong><?php echo $e($this->_['requirementsLabel'] ?? 'Requirements'); ?>:</strong>
									<?php echo $e(implode(', ', array_map('strval', $requirements))); ?>
								</p>
							<?php } ?>
							<?php if ($examples !== []) { ?>
								<div class="base3-chatbot-extension-examples">
									<strong><?php echo $e($this->_['examplesLabel'] ?? 'Example prompts'); ?></strong>
									<?php foreach ($examples as $example) { ?>
										<div class="base3-chatbot-extension-example">
											<code data-base3-chatbot-extension-example-text><?php echo $e($example); ?></code>
											<button
												type="button"
												class="btn btn-default btn-sm base3-chatbot-extension-copy"
												data-base3-chatbot-extension-copy
											>
												<?php echo $e($copyPromptLabel); ?>
											</button>
										</div>
									<?php } ?>
								</div>
							<?php } ?>
						</div>
					</div>
				<?php } ?>
			</div>
		<?php } ?>

		<div class="base3-chatbot-extension-actions">
			<button
				type="submit"
				class="btn btn-primary base3-chatbot-extension-submit"
				data-base3-chatbot-extension-save
			>
				<?php echo $e($this->_['saveLabel'] ?? 'Save'); ?>
			</button>
		</div>
	</form>
</section>

<script>
(function() {
	var root = document.getElementById(<?php echo json_encode($formId, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>);

	if (!root || root.getAttribute('data-base3-chatbot-extension-ready') === '1') {
		return;
	}

	root.setAttribute('data-base3-chatbot-extension-ready', '1');

	var button = root.querySelector('[data-base3-chatbot-extension-save]');
	var messages = root.querySelector('[data-base3-chatbot-extension-messages]');
	var saveUrl = root.getAttribute('data-save-url') || <?php echo json_encode($saveUrl, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
	var requestError = <?php echo json_encode($requestError, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
	var copyPromptLabel = <?php echo json_encode($copyPromptLabel, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
	var copiedPromptLabel = <?php echo json_encode($copiedPromptLabel, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;

	function escapeHtml(value) {
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	function renderMessages(items) {
		if (!messages) {
			return;
		}

		if (!Array.isArray(items) || items.length === 0) {
			messages.innerHTML = '';
			return;
		}

		messages.innerHTML = items.map(function(item) {
			var type = String(item.type || 'info').replace(/[^a-z]/g, '') || 'info';
			var text = item.text || '';

			return '<div class="alert alert-' + escapeHtml(type) + '" role="status">' + escapeHtml(text) + '</div>';
		}).join('');
	}

	function updateExtensions(items) {
		if (!Array.isArray(items)) {
			return;
		}

		var fields = root.querySelectorAll('[data-extension-id]');

		items.forEach(function(item) {
			var id = String(item.id || '');

			fields.forEach(function(field) {
				if (field.getAttribute('data-extension-id') === id) {
					field.checked = !!item.enabled;
				}
			});
		});
	}

	function save(event) {
		event.preventDefault();
		if (!button || !saveUrl) {
			return;
		}
		button.disabled = true;

		fetch(saveUrl, {
			method: 'POST',
			body: new FormData(root),
			credentials: 'same-origin',
			headers: {
				'X-Requested-With': 'XMLHttpRequest'
			}
		})
			.then(function(response) {
				return response.json();
			})
			.then(function(json) {
				renderMessages(json.messages || []);
				updateExtensions(json.extensions || null);
			})
			.catch(function(error) {
				renderMessages([
					{
						type: 'danger',
						text: requestError + ' ' + error.message
					}
				]);
			})
			.finally(function() {
				button.disabled = false;
			});
	}

	function copyPrompt(buttonElement) {
		var example = buttonElement.parentElement.querySelector('[data-base3-chatbot-extension-example-text]');
		if (!example) {
			return;
		}

		var text = example.textContent || '';
		var copy = navigator.clipboard && navigator.clipboard.writeText
			? navigator.clipboard.writeText(text)
			: Promise.reject(new Error('Clipboard API unavailable.'));

		copy.then(function() {
			buttonElement.textContent = copiedPromptLabel;
			window.setTimeout(function() {
				buttonElement.textContent = copyPromptLabel;
			}, 1500);
		}).catch(function() {
			var field = document.createElement('textarea');
			field.value = text;
			field.setAttribute('readonly', 'readonly');
			field.style.position = 'fixed';
			field.style.opacity = '0';
			document.body.appendChild(field);
			field.select();
			document.execCommand('copy');
			field.remove();
			buttonElement.textContent = copiedPromptLabel;
			window.setTimeout(function() {
				buttonElement.textContent = copyPromptLabel;
			}, 1500);
		});
	}

	root.addEventListener('submit', save);
	root.addEventListener('click', function(event) {
		var copyButton = event.target.closest('[data-base3-chatbot-extension-copy]');
		if (copyButton && root.contains(copyButton)) {
			copyPrompt(copyButton);
		}
	});
})();
</script>
