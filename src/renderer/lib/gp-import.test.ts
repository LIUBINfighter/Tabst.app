import { describe, expect, it } from "vitest";
import {
	convertScoreBytesToAlphaTex,
	isImportableScoreFilePath,
	isMxlFilePath,
} from "./gp-import";

const MINIMAL_MXL_BASE64 =
	"UEsDBBQAAAAIADl971wmH8xxoAAAAPQAAAAWAAAATUVUQS1JTkYvY29udGFpbmVyLnhtbF2OOw7CMBBErxJti5JAhyw76TgBHMCyN2DJ3rX8ieD2GIoQ0U3x3szI+Rl8t2LKjknBaThCh2TYOroruF0v/RnmSRqmoh1h+kObTFlBTSRYZ5cF6YBZFCM4Ilk2NSAV8cXEVgKTTMxlcR7zL3ZL9b6PujwUZMMJh1CzM82FLqB1ui+viAp0jN4ZXdqLcSU7JGyw1Tv+8HHGSY67lXFbn95QSwMEFAAAAAgAOX3vXEFNk7UcAQAAGwIAAA4AAABzY29yZS5tdXNpY3htbFVRsXKDMAz9FY6dOGk7dBDKlGZp7zqkd10NKEEXsDlbJM3f18a0JAvSe5KenwRsf/ouu5DzbE2Zb1brPCNT24bNqcy/Dm/Fa75F8LV1VAzayZU9Lf3Pq02OcLXunL6FsHSEH9/v2YG8gLojE0CIKkXHXu5lM27K/DOKTWWje8L9yKIdqIUBtUzgXEhKjxo9aT86yszYV+TCWoHTIo6rUcgjNHzhuIDHDagFwJluCEc+SutxDWrOQE28cHRQkRaPL6BSMuFCbgP9cQmASu11R8ewJ58M7oP7GKFjQ/gEaoqgUou692eshMrAUrdhWGjAXRiOEWwt+jI9NmfhDKmvGZ2WsEes/ecwubm2tqNgKTlL6mo+0nzHh9vGn4y/UEsBAhQAFAAAAAgAOX3vXCYfzHGgAAAA9AAAABYAAAAAAAAAAAAAAAAAAAAAAE1FVEEtSU5GL2NvbnRhaW5lci54bWxQSwECFAAUAAAACAA5fe9cQU2TtRwBAAAbAgAADgAAAAAAAAAAAAAAAADUAAAAc2NvcmUubXVzaWN4bWxQSwUGAAAAAAIAAgCAAAAAHAIAAAAA";

describe("score import", () => {
	it("recognizes compressed MusicXML files", () => {
		expect(isMxlFilePath("song.mxl")).toBe(true);
		expect(isMxlFilePath("SONG.MXL")).toBe(true);
		expect(isImportableScoreFilePath("song.mxl")).toBe(true);
		expect(isImportableScoreFilePath("song.atex")).toBe(false);
	});

	it("converts compressed MusicXML into renderable AlphaTex", () => {
		const bytes = Uint8Array.from(Buffer.from(MINIMAL_MXL_BASE64, "base64"));
		const alphaTex = convertScoreBytesToAlphaTex(bytes);

		expect(alphaTex).toMatch(/\\title "MXL.Test"/);
		expect(alphaTex).toContain('\\track ("Guitar" "Guitar")');
		expect(alphaTex).toContain("E4.1");
	});
});
