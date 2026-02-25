import type { ReactNode } from "react";
import { useState } from "react";
import { CodeBlock } from "./CodeBlock";
import { TutorialAlphaTexPlayground } from "./TutorialAlphaTexPlayground";
import { TutorialImage } from "./TutorialImage";

function tutorialSampleFor(name: string): string {
	if (name === "overview") {
		return String.raw`\title "Canon Rock"
\subtitle "JerryC"
\tempo 90
.
:2 19.2{v f} 17.2{v f} |
15.2{v f} 14.2{v f} |
12.2{v f} 10.2{v f} |
12.2{v f} 14.2{v f}.4 :8 15.2 17.2 |`;
	}

	if (name === "metadata") {
		return String.raw`\title "My Song"
\subtitle "Demo"
\artist "Tabst"
\album "Practice"
\tempo 96
.
0.3 2.3 3.3 5.3 |`;
	}

	if (name === "in-markdown") {
		return String.raw`%%{init: {"scale":1,"speed":2,"scrollMode":"Continuous","metronome":false,"player":"enable"}}%%

\title "Canon Rock"
\subtitle "JerryC"
\tempo 90
.
:2 19.2{v f} 17.2{v f} |`;
	}

	if (name === "metadata-full") {
		return String.raw`\title "Song Title"
\subtitle Subtitle
\artist Artist
\album 'My Album'
\words Daniel
\music alphaTab
\copyright 'Daniel (Creator of alphaTab)'
\instructions "This is an example.\nWith instructions."
\notices "Additional notes\nEmbedded in the data model."
\tab "Daniel"
\tempo 200 "Tempo Label"
\instrument 30
\capo 2
\tuning e5 b4 g4 d4 a3 e3
.
:4 C4 D4 E4 F4 | C4 D4 E4 F4`;
	}

	if (name === "instruments-guitar") {
		return String.raw`\title "Instrument & Tuning"
\instrument ElectricGuitarClean
\tuning E4 B3 G3 D3 A2 E2
.
:4 0.6 2.5 2.4 2.3 | 3.2 2.2 0.1 3.1`;
	}

	if (name === "instruments-piano") {
		return String.raw`\title "Instrument & Tuning (Piano)"
\instrument piano
\tuning piano
.
:4 C4 D4 E4 F4 | G4 A4 B4 r`;
	}

	if (name === "notes-single") {
		return "0.6.2 1.5.4 3.4.4 |\n5.3.8 5.3.8 5.3.8 5.3.8 r.2";
	}

	if (name === "notes-chords") {
		return "(0.3 0.4).4 (3.3 3.4).4 (5.3 5.4).4 r.8 (0.3 0.4).8 |\nr.8 (3.3 3.4).8 r.8 (6.3 6.4).8 (5.3 5.4).4 r.4 |";
	}

	if (name === "notes-duration") {
		return ":4 2.3 3.3 :8 3.3 4.3 3.3 4.3 |\n2.3.4 3.3 3.3.8 4.3 3.3 4.3";
	}

	if (name === "notes-repeat") return "3.3*4 | 4.3*4";

	if (name === "notes-voices") {
		return String.raw`\track "Piano"
\staff{score} \tuning piano \instrument acousticgrandpiano
\voice
c4 d4 e4 f4 | c4 d4 e4 f4
\voice
c3 d3 e3 f3 | c3 d3 e3 f3`;
	}

	if (name === "notes-accidentals") {
		return String.raw`\track
\accidentals explicit
C#4 Db4 C##4 Dbb4 |
\accidentals auto
C#4 Db4 C##4 Dbb4 |
C#4 { acc forceFlat } C4 { acc forceSharp }`;
	}

	if (name === "styles-dynamics-on") {
		return String.raw`\showDynamics
.
C4 D4 E4 F4`;
	}
	if (name === "styles-dynamics-off") {
		return String.raw`\hideDynamics
.
C4 D4 E4 F4`;
	}
	if (name === "styles-system-sign") {
		return String.raw`\useSystemSignSeparator
\defaultSystemsLayout 2
.
\track "T1"
:1 C4 | C4 | C4
\track "T2"
:1 C4 | C4 | C4`;
	}
	if (name === "styles-tuning-show") {
		return String.raw`\track \staff \tuning E4 B3 G3 D3 A2 E2
3.3.1
\track \staff \tuning D4 A3 F3 C3 G2 D2
3.3.1`;
	}
	if (name === "styles-tuning-hide") {
		return String.raw`\track \staff \tuning E4 B3 G3 D3 A2 E2 hide
3.3.1
\track \staff \tuning D4 A3 F3 C3 G2 D2
3.3.1`;
	}
	if (name === "styles-track-names") {
		return String.raw`\singletracktracknamepolicy AllSystems
\firstsystemtracknamemode fullname
\othersystemstracknamemode shortname
\firstsystemtracknameorientation horizontal
\othersystemstracknameorientation vertical
.
\track "Piano 1" "pno1" { defaultsystemslayout 3 }
\staff {score}
C4 D4 E4 F4 | C4 D4 E4 F4`;
	}

	if (name === "bar-ts")
		return String.raw`\ts 3 4 | \ts 4 4 | \ts 6 8 | \ts common`;
	if (name === "bar-repeats") {
		return String.raw`\ro 1.3 2.3 3.3 4.3 | 5.3 6.3 7.3 8.3 | \rc 2 1.3 2.3 3.3 4.3 |`;
	}
	if (name === "bar-alt-endings") {
		return String.raw`\ro 1.3 2.3 3.3 4.3 | \ae (1 2 3) 5.3 6.3 7.3 8.3 | \ae 4 \rc 4 5.3 8.3 7.3 6.3`;
	}
	if (name === "bar-keys") {
		return String.raw`\ks Cb | \ks C | \ks C# | \ks Aminor | \ks Dmajor | \ks Bminor`;
	}
	if (name === "bar-section") {
		return String.raw`\section Intro
1.1 1.1 1.1 1.1 |
\section "Chorus 01"
1.1 1.1 1.1 1.1 |`;
	}
	if (name === "bar-clef-ottava") {
		return String.raw`\clef G2 | \clef F4 | \clef C3 | \clef C4 | \clef N |
\clef Treble | \clef Bass | \clef Tenor | \clef Alto | \clef Neutral |
\clef F4 \ottava 15ma | | \ottava regular | | \clef C3 \ottava 8vb | |`;
	}
	if (name === "bar-tempo-in-bars") {
		return String.raw`.
\tempo 30 1.3 2.3 3.3 4.3 |
\tempo 80 1.3 2.3 3.3 4.3`;
	}
	if (name === "bar-triplet-feel") {
		return String.raw`\tf none 3.3*4 |
\tf triplet-16th 3.3*4 | \tf triplet-8th 3.3*4 |
\tf dotted-16th 3.3*4 | \tf dotted-8th 3.3*4 |
\tf scottish-16th 3.3*4 | \tf scottish-8th 3.3*4 |`;
	}
	if (name === "bar-anacrusis") {
		return String.raw`\ks D \ts 24 16 \ac r.16 6.3 7.3 9.3 7.3 6.3 | r.16 5.4 7.4 9.4 7.4 5.4`;
	}
	if (name === "bar-double-bar")
		return "\\db 3.3 3.3 3.3 3.3 | 1.1 2.1 3.1 4.1";
	if (name === "bar-simile") {
		return String.raw`3.3*4 | \simile simple | 3.3*4 | 4.3*4 | \simile firstofdouble | \simile secondofdouble`;
	}

	if (name === "beat-effects") {
		return "3.3{f} 3.3{fo} 3.3{vs} |\n3.3{v} 3.3{vw} |\n3.3{tp 8} 3.3{tp 16} 3.3{tp 32}";
	}
	if (name === "beat-dynamics") {
		return "1.1.8{dy ppp} 1.1{dy pp} 1.1{dy p} 1.1{dy mp} 1.1{dy mf} 1.1{dy f}";
	}
	if (name === "beat-tuplet-range") {
		return ":4{tu 3} 3.3 3.3 3.3 :8 3.3 3.3 3.3 3.3 |\n:8{tu 3} 3.3 3.3 3.3 3.3.16 3.3.16 3.3.16";
	}
	if (name === "beat-tremolo-wb")
		return "3.3.1{tb (0 4 0 8)} | 3.3.1{tb (0 -4 0 -8)} |";
	if (name === "beat-tremolo-wb-exact") return "3.3.1{tbe (0 0 5 4 30 8 60 0)}";
	if (name === "beat-brush-arp") {
		return ":2 (0.1 0.2 0.3 2.4 2.5 0.6){bd} (0.1 0.2 0.3 2.4 2.5 0.6){bu} |\n(0.1 0.2 0.3 2.4 2.5 0.6){ad} (0.1 0.2 0.3 2.4 2.5 0.6){au} |";
	}
	if (name === "beat-chords") {
		return '(1.1 3.2 5.3 3.4 1.5){ch "A#add9"} (1.1 3.2 5.3 3.4 1.5)*3 |';
	}
	if (name === "beat-timer") {
		return String.raw`\tempo 120
.
3.3.4 { timer } 3.3.4*3 |`;
	}
	if (name === "beat-sustain-wah")
		return "3.3{string} 3.3{spd} 3.3 3.3 {spu} | 3.3 3.3{waho} 3.3 3.3 {wahc}";
	if (name === "beat-barre-ottava")
		return "1.1 {barre 24} 2.1 {barre 24} | 3.3.4{ ot 15ma } 3.3.4{ ot 8vb }";
	if (name === "beat-beaming")
		return ":8 3.3{ beam invert } 3.3 | 3.1{ beam up } 3.1 | 3.6{ beam down } 3.6 |";

	if (name === "note-effects") {
		return ":8 3.3{nh} 3.3{ah} 3.3{ph} 3.3{th} 3.3{sh}\n3.3{sl} 4.3 3.3{ss} 4.3 |\n3.3{ac} 3.3{hac} 3.3{ten}";
	}
	if (name === "note-bends") return "3.3{b (0 4)} | 3.3{b (0 4 0 8)} |";
	if (name === "note-trill") return ":4 3.3{tr 4 16} 3.3{tr 5 32} 3.3{tr 6 64}";
	if (name === "note-vibrato") return "3.3{v}";
	if (name === "note-slide")
		return "3.3{sl} 4.3 3.3{ss} 4.3 | 3.3{sib} 3.3{sia} 3.3{sou} 3.3{sod}";
	if (name === "note-hopo") return "3.3{h} 4.3 4.3{h} 3.3 |";
	if (name === "note-lht") return ":16 15.1{h} 13.1{h} 12.1{h} 15.2{lht}";
	if (name === "note-ghost-dead") return "3.3{g} | x.3 3.3{x}";
	if (name === "note-accent-staccato")
		return "3.3{ac} 3.3{hac} 3.3{ten} | 3.3{st}";
	if (name === "note-pm-lr") return "3.3{pm} 3.3{pm} | 3.4{lr} 3.3{lr}";
	if (name === "note-fingering")
		return ":8 3.3{lf 1} 3.3{lf 2} 3.3{lf 3} 3.3{lf 4}";
	if (name === "note-ornaments")
		return ":1 C4{turn} | C4 {iturn} | C4 {umordent} | C4 {lmordent}";
	if (name === "note-show-strings")
		return "3.3{string} 3.4{string} 3.5{string}";
	if (name === "note-bends-exact") return ":1 3.3 {be (0 0 5 2 30 4)}";
	if (name === "note-tied-stringed")
		return "3.3 -.3 | (1.1 3.2 2.3 0.4) (-.1 -.4)";
	if (name === "note-tied-non-stringed") {
		return String.raw`\tuning piano
.
:2 a4 - |
:2 a4 a4{-} |
:2 (a4 a3) (- a3)`;
	}
	if (name === "note-invisible") return ":8 3.3 (4.4{hide} 5.5)";
	if (name === "note-slur")
		return "(3.3 {slur s1} 4.4).4 7.3.8 8.3.8 10.3 {slur s1}.8";

	if (name === "lyrics-basic") {
		return String.raw`\title "With Lyrics"
\instrument piano
.
\lyrics "Do Re Mi Fa So La Ti"
C4 D4 E4 F4 | G4 A4 B4 r`;
	}
	if (name === "lyrics-combine") {
		return String.raw`\title "Combine Syllables"
\instrument piano
.
\lyrics "Do+Do  Mi+Mi"
C4 C4 E4 E4`;
	}
	if (name === "lyrics-delay") {
		return String.raw`\title "Start Later"
\instrument piano
.
\lyrics 2 "Do Re Mi Fa So La Ti"
r r r r | r r r r |
C4 D4 E4 F4 | G4 A4 B4 r`;
	}
	if (name === "lyrics-comment") {
		return String.raw`\title "Comment"
\subtitle "Useful when loading lyrics from another source"
\instrument piano
.
\lyrics "[This is a comment]Do Re Mi Fa"
C4 D4 E4 F4`;
	}

	if (name === "percussion-basic") {
		return String.raw`\title "Percussion Basics"
\instrument 25
.
\track "Drums"
\staff {score}
c#5.4 d4.4 c#5.4 d4.4 |`;
	}
	if (name === "percussion-official") {
		return String.raw`\track "Drums"
\instrument percussion
\tempo 120
\clef neutral
\articulation defaults
(KickHit RideBell).16 r KickHit KickHit |`;
	}
	if (name === "percussion-articulation-custom") {
		return String.raw`\track "Drums"
\instrument percussion
\tempo 120
\clef neutral
\articulation Kick 36
Kick.4 Kick.8 Kick.8 Kick.4 Kick.4`;
	}
	if (name === "percussion-articulation-defaults") {
		return String.raw`\track "Drums"
\instrument percussion
\tempo 120
\clef neutral
\articulation defaults
\ts 2 4
("Kick (Hit)" "Hi-Hat (Open)") "Kick (Hit)" "Kick (Hit)" "Kick (Hit)"`;
	}

	if (name === "sync-points") {
		return String.raw`\title "Sync Demo"
.
1.3 2.3 3.3 4.3 |
\sync 1 0 1200 1.0`;
	}

	if (name === "example-progression") {
		return String.raw`\chord "Bm/D" 2 3 4 0 x x
\chord "Cadd9" 0 3 0 2 3 x
.
\ts 4 4
r.4 * 3 0.1.8 2.1.8 |
(2.1 0.4).8{ch "Bm/D"} 4.3 3.2 4.3 0.4 2.1 4.3.4 |`;
	}

	return String.raw`\title "Tutorial Playground"
\tempo 100
.
0.3 2.3 3.3 5.3 |`;
}

/**
 * MDX 组件库
 * 所有可以在 MDX 文件中使用的组件都在这里导出
 */
export const components = {
	CodeBlock,
	TutorialImage,

	// 测试用的交互式按钮组件
	TestButton: ({
		children,
		onClick,
		...props
	}: {
		children?: ReactNode;
		onClick?: () => void;
	}) => {
		const [clicked, setClicked] = useState(false);

		return (
			<button
				type="button"
				onClick={() => {
					setClicked(true);
					onClick?.();
					setTimeout(() => setClicked(false), 1000);
				}}
				className={`px-4 py-2 rounded transition-colors ${
					clicked
						? "bg-green-500 text-white"
						: "bg-primary text-primary-foreground hover:bg-primary/90"
				}`}
				{...props}
			>
				{children || "点击测试"}
			</button>
		);
	},

	// 测试用的计数器组件
	Counter: ({ initialValue = 0 }: { initialValue?: number }) => {
		const [count, setCount] = useState(initialValue);

		return (
			<div className="my-4 p-4 border border-border rounded-lg bg-card">
				<p className="text-sm text-muted-foreground mb-2">计数器测试组件</p>
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() => setCount(count - 1)}
						className="px-3 py-1 border rounded hover:bg-accent"
					>
						-
					</button>
					<span className="text-lg font-semibold min-w-[3rem] text-center">
						{count}
					</span>
					<button
						type="button"
						onClick={() => setCount(count + 1)}
						className="px-3 py-1 border rounded hover:bg-accent"
					>
						+
					</button>
				</div>
			</div>
		);
	},

	// 测试用的折叠面板组件
	Collapsible: ({
		title,
		children,
	}: {
		title: string;
		children?: ReactNode;
	}) => {
		const [isOpen, setIsOpen] = useState(false);

		return (
			<div className="my-4 border border-border rounded-lg overflow-hidden">
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className="w-full px-4 py-2 text-left bg-muted hover:bg-muted/80 transition-colors flex items-center justify-between"
				>
					<span className="font-medium">{title}</span>
					<span className="text-muted-foreground">{isOpen ? "▼" : "▶"}</span>
				</button>
				{isOpen && <div className="p-4 bg-card">{children}</div>}
			</div>
		);
	},

	// 测试用的提示框组件
	Alert: ({
		type = "info",
		children,
	}: {
		type?: "info" | "success" | "warning" | "error";
		children?: ReactNode;
	}) => {
		const styles = {
			info: "bg-[var(--highlight-bg)] border-[var(--highlight-bg)] text-[var(--highlight-text)]",
			success: "bg-green-500/10 border-green-500/20 text-green-600",
			warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-600",
			error: "bg-red-500/10 border-red-500/20 text-red-600",
		};

		return (
			<div className={`my-4 p-4 rounded-lg border ${styles[type]}`}>
				{children}
			</div>
		);
	},

	AlphaTexPlayground: ({ sample = "default" }: { sample?: string }) => {
		return (
			<TutorialAlphaTexPlayground initialContent={tutorialSampleFor(sample)} />
		);
	},
};
