const path = require("node:path");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const { productName } = require("./package.json");

const dmgAppPath = path.join(
	__dirname,
	"out",
	`${productName}-darwin-arm64`,
	`${productName}.app`,
);

module.exports = {
	packagerConfig: {
		asar: true,
	},
	rebuildConfig: {},
	makers: [
		// Squirrel maker temporarily disabled: CI will build portable ZIP only for now
		// {
		// 	name: "@electron-forge/maker-squirrel",
		// 	config: {},
		// },
		{
			name: "@electron-forge/maker-zip",
			// no platforms specified: zip maker will be available for all supported platforms
		},
		{
			name: "@electron-forge/maker-dmg",
			config: {
				contents: [
					{
						x: 130,
						y: 220,
						type: "file",
						path: dmgAppPath,
					},
					{
						x: 410,
						y: 220,
						type: "link",
						path: "/Applications",
					},
				],
				// 强制跳过原生依赖检查
				skipNativeDeps: true,
			},
		},
		// Linux-only makers (avoid pulling flatpak deps on Windows/macOS)
		...(process.platform === "linux"
			? [
					{
						name: "@electron-forge/maker-deb",
						config: {},
					},
					{
						name: "@electron-forge/maker-rpm",
						config: {},
					},
				]
			: []),
	],
	plugins: [
		{
			name: "@electron-forge/plugin-auto-unpack-natives",
			config: {},
		},
		// Fuses are used to enable/disable various Electron functionality
		// at package time, before code signing the application
		new FusesPlugin({
			version: FuseVersion.V1,
			[FuseV1Options.RunAsNode]: false,
			[FuseV1Options.EnableCookieEncryption]: true,
			[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
			[FuseV1Options.EnableNodeCliInspectArguments]: false,
			[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
			[FuseV1Options.OnlyLoadAppFromAsar]: true,
		}),
	],
};
