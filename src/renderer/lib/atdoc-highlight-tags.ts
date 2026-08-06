import { Tag, type Tag as TagType, tags } from "@lezer/highlight";
import type { EditorHighlightColors } from "./theme-system/types";

/**
 * ATDOC 分层注释高亮标签（TSDoc/JSDoc 风格）。
 *
 * 自定义标签通过继承 `tags.comment` 获得降级能力：主题未配置某个 ATDOC
 * 颜色槽位时，自动回退到普通注释颜色；配置了则按标签层级覆盖。
 */
const atdocCommentTag = Tag.define(tags.comment);
const atdocSectionTag = Tag.define(atdocCommentTag);
const atdocKeyTag = Tag.define(atdocCommentTag);
const atdocOperatorTag = Tag.define(atdocCommentTag);
const atdocValueTag = Tag.define(atdocCommentTag);
const atdocStringTag = Tag.define(atdocValueTag);
const atdocColorTag = Tag.define(atdocValueTag);
const atdocInlineTag = Tag.define(atdocCommentTag);

export const atdocHighlightTags = {
	/** `[meta]` 等 INI 分节头 */
	section: atdocSectionTag,
	/** `at.player.playbackSpeed` 或节内裸键 `speed` */
	key: atdocKeyTag,
	/** `=` 分隔符 */
	operator: atdocOperatorTag,
	/** 数值/布尔/枚举/列表等普通值 */
	value: atdocValueTag,
	/** 引号字符串值 */
	string: atdocStringTag,
	/** `#ef4444` 十六进制颜色值 */
	color: atdocColorTag,
	/** 注释行内 `#tag` */
	tag: atdocInlineTag,
} as const;

export interface AtDocHighlightSpec {
	tag: TagType;
	color: string;
	fontWeight?: string;
}

/**
 * 根据主题颜色配置生成 ATDOC 高亮规则。
 *
 * 未配置的槽位会被省略，对应 token 按标签层级回退到注释颜色。
 */
export function buildAtDocHighlightSpecs(
	colors: EditorHighlightColors,
): AtDocHighlightSpec[] {
	const specs: AtDocHighlightSpec[] = [];
	if (colors.atdocSection) {
		specs.push({
			tag: atdocHighlightTags.section,
			color: colors.atdocSection,
			fontWeight: "bold",
		});
	}
	if (colors.atdocKey) {
		specs.push({ tag: atdocHighlightTags.key, color: colors.atdocKey });
	}
	if (colors.atdocValue) {
		specs.push({ tag: atdocHighlightTags.value, color: colors.atdocValue });
	}
	if (colors.atdocString) {
		specs.push({ tag: atdocHighlightTags.string, color: colors.atdocString });
	}
	if (colors.atdocColor) {
		specs.push({ tag: atdocHighlightTags.color, color: colors.atdocColor });
	}
	if (colors.atdocTag) {
		specs.push({ tag: atdocHighlightTags.tag, color: colors.atdocTag });
	}
	return specs;
}
