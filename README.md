<h1 align="center">
  <samp>Tabst</samp>
</h1>

<h3 align="center">Write guitar tabs like markdown.</h3>

[中文README](./README.zh.md)

[![DOI](https://zenodo.org/badge/1133258569.svg)](https://doi.org/10.5281/zenodo.18447447)
![CI](https://img.shields.io/github/actions/workflow/status/LIUBINfighter/Tabst.app/ci.yml?branch=main)
![Release](https://img.shields.io/github/v/release/LIUBINfighter/Tabst.app)
![Downloads (Total)](https://img.shields.io/github/downloads/LIUBINfighter/Tabst.app/total)
![Downloads (Latest)](https://img.shields.io/github/downloads/LIUBINfighter/Tabst.app/latest/total)

<div align="center">
<img width="2560" height="1406" alt="image" src="https://github.com/user-attachments/assets/d58323a0-44bb-4468-87c7-281c898a5ab6" />
</div>
  
## Features

Write. Play. Share.

Efficiently write alphaTex. Play scores. Share PDF/GP.

## Why Tabst

Say no to bulky binaries and XML; the world belongs to plain text.

While document writing already has a plethora of out-of-the-box Markdown editors, precise typesetting tools like LaTeX, and innovative tools like Typst, why in the realm of guitar tabs are we still connecting notes on scores like in Word?

[MusiXTeX](https://ctan.org/pkg/musixtex) and [Lilypond](https://lilypond.org/) have set a publishing-grade example in music notation languages, while [alphaTab.js](https://www.alphatab.net/) has made interactive and playable scores possible. In Tabst, we write alphaTex in a simple, intuitive syntax, and easily share with your friends.

This is just the beginning. My vision is to transform scattered PDFs and images of scores into alphaTex stored in Tabst. Visual language models (OMR Optical Music Recognition) are on the way.

## Tech Stack

- [alphaTex](https://www.alphatab.net/docs/alphatex/introduction)
- [alphaTab.js](https://www.alphatab.net/)
- [CodeMirror](https://codemirror.net/)
- pnpm
- TypeScript
- Vite
- [Electron](https://www.electronjs.org/docs/latest/)
- [React 19](https://react.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwindcss 3](https://tailwindcss.com/docs/installation) (Ultimately decided to revert to v3 as v4 is not stable enough)
- [biome](https://biomejs.dev/guides/getting-started/)
- [Zustand](https://github.com/pmndrs/zustand)
- [Lucide Icon](https://lucide.dev/guide/packages/lucide-react)

## Development Environment

MCP Server

- [context7](https://context7.com/)
- [shadcn/ui](https://ui.shadcn.com/)

## Install Deps

```powershell
pnpm install
```

## Development

```powershell
pnpm run dev  # Run React development server + Electron development process
```
