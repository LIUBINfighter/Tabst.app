import { Printer, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadBravuraFont } from "../lib/assets";
import {
	buildPrintFontFaceCss,
	buildPrintFontFamilyCssValue,
} from "../lib/print-fonts";
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

		void loadBravuraFont(payload.printFontUrl)
			.catch((err) => {
				console.warn("[PrintWindow] Failed to load Bravura aliases:", err);
			})
			.finally(() => {
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
			});

		return () => {
			window.removeEventListener("afterprint", onAfterPrint);
		};
	}, [payload, t]);

	const printStyles = useMemo(() => {
		if (!payload) return "";
		return `
			${buildPrintFontFaceCss(payload.printFontName, payload.printFontUrl)}
			:root {
				color-scheme: light dark;
			}
			* {
				box-sizing: border-box;
			}
			html, body {
				margin: 0;
				padding: 0;
				min-height: 100%;
				background:
					radial-gradient(circle at top, hsl(var(--primary) / 0.14), transparent 34%),
					linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted) / 0.42) 100%);
				color: hsl(var(--foreground));
				font-family: inherit;
			}
			body {
				min-height: 100vh;
			}
			button {
				font: inherit;
			}
			.print-window-root {
				min-height: 100vh;
				display: flex;
				flex-direction: column;
			}
			.print-toolbar {
				position: sticky;
				top: 0;
				z-index: 10;
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 16px;
				padding: 14px 18px;
				border-bottom: 1px solid hsl(var(--border));
				background: hsl(var(--background) / 0.86);
				backdrop-filter: blur(18px) saturate(1.1);
				box-shadow: 0 10px 30px hsl(var(--foreground) / 0.06);
			}
			.print-toolbar-meta {
				min-width: 0;
				display: flex;
				flex-direction: column;
				gap: 4px;
			}
			.print-toolbar-title {
				font-size: 13px;
				font-weight: 600;
				line-height: 1.2;
				color: hsl(var(--foreground));
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.print-toolbar-subtitle {
				font-size: 11px;
				line-height: 1.2;
				color: hsl(var(--muted-foreground));
			}
			.print-toolbar-actions {
				display: flex;
				align-items: center;
				gap: 10px;
				flex-shrink: 0;
			}
			.print-status {
				display: inline-flex;
				align-items: center;
				max-width: min(32vw, 360px);
				padding: 6px 10px;
				border: 1px solid hsl(var(--border));
				border-radius: 999px;
				background: hsl(var(--card) / 0.72);
				color: hsl(var(--muted-foreground));
				font-size: 11px;
				line-height: 1;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.print-shell {
				flex: 1;
				padding: 28px;
			}
			.print-stack {
				width: fit-content;
				max-width: 100%;
				margin: 0 auto;
			}
			.print-page {
				width: ${payload.contentWidthPx}px;
				height: ${payload.contentHeightPx}px;
				overflow: hidden;
				position: relative;
				background: white;
				margin: 0 auto 24px auto;
				border: 1px solid hsl(var(--border));
				border-radius: calc(var(--radius) * 1.5);
				box-shadow:
					0 22px 44px hsl(var(--foreground) / 0.10),
					0 2px 10px hsl(var(--foreground) / 0.05);
			}
			.at-surface {
				position: relative;
				width: 100%;
				height: 100%;
			}
			.at-surface > div {
				position: absolute;
			}
			.at-surface svg {
				display: block;
			}
			.at-surface .at,
			.at-surface-svg .at {
				font-family: ${buildPrintFontFamilyCssValue(payload.printFontName)} !important;
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
			@media (max-width: 900px) {
				.print-toolbar {
					align-items: flex-start;
					flex-direction: column;
				}
				.print-toolbar-actions {
					width: 100%;
					flex-wrap: wrap;
				}
				.print-status {
					max-width: 100%;
				}
				.print-shell {
					padding: 16px;
				}
			}
			@media print {
				html, body {
					background: white !important;
					-webkit-print-color-adjust: exact;
					print-color-adjust: exact;
				}
				.print-window-root,
				.print-shell,
				.print-stack {
					background: transparent !important;
					border: 0 !important;
					border-radius: 0 !important;
					box-shadow: none !important;
				}
				.print-toolbar {
					display: none !important;
				}
				.print-shell {
					padding: 0;
				}
				.print-stack {
					width: auto;
					max-width: none;
					margin: 0;
				}
				.print-page {
					margin: 0;
					background: white !important;
					border: 0 !important;
					border-radius: 0 !important;
					box-shadow: none !important;
					outline: 0 !important;
					page-break-inside: avoid;
				}
			}
		`;
	}, [payload]);

	return (
		<div className="print-window-root min-h-screen bg-background text-foreground">
			<style>{printStyles}</style>
			<div className="print-toolbar">
				<div className="print-toolbar-meta">
					<div className="print-toolbar-title">
						{payload?.fileName ?? t("printPreview")}
					</div>
					<div className="print-toolbar-subtitle">
						{payload
							? `${t("printPreview")} · ${payload.pageWidthMm}×${payload.pageHeightMm}mm`
							: t("printPreparing")}
					</div>
				</div>
				<div className="print-toolbar-actions">
					<div className="print-status">{status}</div>
					<Button size="sm" onClick={() => window.print()}>
						<Printer className="h-4 w-4" />
						{t("print")}
					</Button>
					<Button size="sm" variant="outline" onClick={() => window.close()}>
						<X className="h-4 w-4" />
						{t("close")}
					</Button>
				</div>
			</div>
			<div className="print-shell">
				{payload ? (
					<div
						className="print-stack"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: alphaTab SVG content from internal rendering
						dangerouslySetInnerHTML={{ __html: payload.pagesHtml }}
					/>
				) : null}
			</div>
		</div>
	);
}
