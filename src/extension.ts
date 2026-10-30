import * as vscode from 'vscode';
import { explain, type Explanation } from './matcher';

let panel: vscode.WebviewPanel | undefined;

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripAnsi(s: string): string {
	return s.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '');
}

function showExplanation(results: Explanation[]) {
	if (!panel) {
		panel = vscode.window.createWebviewPanel(
			'errorExplainer',
			'Объяснение ошибки',
			{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
			{}
		);
		panel.onDidDispose(() => {
			panel = undefined;
		});
	} else {
		panel.reveal(vscode.ViewColumn.Beside, true);
	}

	const cards = results
		.map(
			(r) => `
		<section class="card">
			<h2>🟡 ${escapeHtml(r.title)}</h2>
			<code class="orig">${escapeHtml(r.matched)}</code>
			<h3>Что случилось</h3>
			<p>${escapeHtml(r.what)}</p>
			<h3>Почему так бывает</h3>
			<p>${escapeHtml(r.why)}</p>
			<h3>Как исправить</h3>
			<ul>${r.fix.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
		</section>`
		)
		.join('');

	panel.webview.html = `<!DOCTYPE html>
<html lang="ru">
<head>
	<meta charset="UTF-8">
	<style>
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			padding: 12px 20px;
			line-height: 1.5;
		}
		.card {
			border: 1px solid var(--vscode-panel-border);
			border-radius: 8px;
			padding: 4px 18px 12px;
			margin-bottom: 16px;
		}
		h2 { font-size: 1.2em; }
		h3 { font-size: 1em; margin-bottom: 4px; opacity: 0.8; }
		p { margin-top: 0; }
		.orig {
			display: block;
			padding: 6px 10px;
			border-radius: 4px;
			white-space: pre-wrap;
			background: var(--vscode-textCodeBlock-background);
		}
	</style>
</head>
<body>${cards}</body>
</html>`;
}

async function explainCommand() {
	let text = '';

	const editor = vscode.window.activeTextEditor;
	if (editor && !editor.selection.isEmpty) {
		text = editor.document.getText(editor.selection);
	}
    if (!text) {
		text =
			(await vscode.window.showInputBox({
				prompt: 'Вставь текст ошибки',
				placeHolder: "TypeError: 'NoneType' object is not subscriptable",
			})) ?? '';
	}

	if (!text) {
		return;
	}

	const results = explain(text);
	if (results.length === 0) {
		vscode.window.showInformationMessage('Пока не знаю эту ошибку 🤔 Добавь её в errors.json.');
		return;
	}

	showExplanation(results);
}

function watchTerminal(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.window.onDidStartTerminalShellExecution(async (event) => {
			let output = '';

			try {
				for await (const chunk of event.execution.read()) {
					output += chunk;
					if (output.length > 100000) {
						output = output.slice(-100000);
					}
				}
			} catch {
				return;
			}

			const results = explain(stripAnsi(output));
			if (results.length === 0) {
				return;
			}

			const choice = await vscode.window.showWarningMessage(
				`🟡 ${results[0].title}`,
				'Объяснить'
			);
			if (choice) {
				showExplanation(results);
			}
		})
	);
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('my-first-extension.explainError', explainCommand)
	);
	watchTerminal(context);
}

export function deactivate() {}