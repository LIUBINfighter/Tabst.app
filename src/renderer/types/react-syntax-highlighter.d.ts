declare module "react-syntax-highlighter/dist/esm/prism-light" {
	const prismLight: unknown;
	export default prismLight;
}

declare module "react-syntax-highlighter/dist/esm/styles/prism" {
	type SyntaxTheme = Record<
		string,
		Record<string, string | number | undefined> | undefined
	>;

	export const oneDark: SyntaxTheme;
	export const oneLight: SyntaxTheme;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/*" {
	const language: unknown;
	export default language;
}
