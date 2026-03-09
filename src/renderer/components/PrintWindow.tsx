import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	type PrintWindowPayload,
	readPrintWindowPayload,
} from "../lib/print-window";
import { Button } from "./ui/button";

export default function PrintWindow() {
	const { t } = useTranslation("print");
	const [payload, setPayload] = useState<PrintWindowPayload | null>(null);
	const [status, setStatus] = useState<string>(t("printPreparing"));

	useEffect(() => {
		const nextPayload = readPrintWindowPayload();
		if (!nextPayload) {
			setStatus(t("printPrepareFailed"));
			return;
		}
		setPayload(nextPayload);
		setStatus(t("printWaitingForFonts"));
	}, [t]);

	useEffect(() => {
		if (!payload) return;

		const tryPrint = () => {
			setStatus(t("printDialogRequested"));
			window.focus();
			window.print();
		};

		const onAfterPrint = () => {
			setStatus("afterprint");
			window.setTimeout(() => window.close(), 80);
		};

		window.addEventListener("afterprint", onAfterPrint, { once: true });

		if (document.fonts?.ready) {
			document.fonts.ready
				.then(() => {
					setStatus(t("printDialogRequested"));
					window.setTimeout(tryPrint, 250);
				})
				.catch(() => {
					window.setTimeout(tryPrint, 250);
				});
		} else {
			window.setTimeout(tryPrint, 250);
		}

		return () => {
			window.removeEventListener("afterprint", onAfterPrint);
		};
	}, [payload, t]);

	const printStyles = useMemo(() => {
		if (!payload) return "";
		return `
			@font-face {
				font-family: '${payload.printFontName}';
				src: url('${payload.printFontUrl}') format('woff2');
				font-weight: normal;
				font-style: normal;
				font-display: block;
			}
			:root {
				color-scheme: light;
			}
			* { box-sizing: border-box; }
			html, body {
				margin: 0;
				padding: 0;
				background: #f4f0e8;
				color: #171717;
				font-family: system-ui, -apple-system, sans-serif;
			}
			.print-window-root {
				min-height: 100vh;
				background: linear-gradient(180deg, #f4f0e8 0%, #ece6db 100%);
			}
			.print-toolbar {
				position: sticky;
				top: 0;
				z-index: 10;
				display: flex;
				align-items: center;
				gap: 12px;
				padding: 14px 18px;
				border-bottom: 1px solid #d7d0c2;
				background: rgba(255, 252, 245, 0.94);
				backdrop-filter: blur(10px);
			}
			.print-status {
				font-size: 12px;
				color: #6b655d;
			}
			.print-shell {
				padding: 24px;
			}
			.print-page {
				width: ${payload.contentWidthPx}px;
				height: ${payload.contentHeightPx}px;
				overflow: hidden;
				position: relative;
				background: white;
				margin: 0 auto 20px auto;
				box-shadow: 0 16px 40px rgba(0,0,0,0.14);
			}
			.at-surface {
				position: relative;
				width: 100%;
				height: 100%;
			}
			.at-surface > div { position: absolute; }
			.at-surface svg { display: block; }
			.at-surface,
			.at-surface text,
			.at-surface tspan {
				font-family: '${payload.printFontName}', 'alphaTab', 'Bravura', sans-serif !important;
			}
			.at-surface .at,
			.at-surface-svg .at {
				font-family: '${payload.printFontName}', 'alphaTab', 'Bravura', sans-serif !important;
				font-size: 34px;
				font-style: normal;
				font-weight: normal;
				speak: none;
				-webkit-font-smoothing: antialiased;
				-moz-osx-font-smoothing: grayscale;
			}
			@page {
				size: ${payload.pageWidthMm}mm ${payload.pageHeightMm}mm;
				margin: ${payload.marginMm}mm;
			}
			@media print {
				html, body {
					background: white;
					-webkit-print-color-adjust: exact;
					print-color-adjust: exact;
				}
				.print-toolbar { display: none !important; }
				.print-shell { padding: 0; }
				.print-page {
					margin: 0;
					box-shadow: none;
					page-break-inside: avoid;
				}
			}
		`;
	}, [payload]);

	return (
		<div className="print-window-root min-h-screen">
			<style>{printStyles}</style>
			<div className="print-toolbar">
				<Button size="sm" onClick={() => window.print()}>
					{t("print")}
				</Button>
				<Button size="sm" variant="outline" onClick={() => window.close()}>
					{t("close")}
				</Button>
				<div className="print-status">{status}</div>
			</div>
			<div className="print-shell">
				{payload ? (
					<div
						// biome-ignore lint/security/noDangerouslySetInnerHtml: alphaTab SVG content from internal rendering
						dangerouslySetInnerHTML={{ __html: payload.pagesHtml }}
					/>
				) : null}
			</div>
		</div>
	);
}
