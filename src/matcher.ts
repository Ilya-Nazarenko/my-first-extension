import errors from './errors.json';

interface ErrorEntry {
	id: string;
	pattern: string;
	title: string;
	what: string;
	why: string;
	fix: string[];
}

export interface Explanation {
	matched: string;
	position: number;
	title: string;
	what: string;
	why: string;
	fix: string[];
}

const compiled = (errors as ErrorEntry[]).map((e) => ({ ...e, regex: new RegExp(e.pattern) }));

function fill(text: string, match: RegExpMatchArray): string {
	const first = match.slice(1).find((g) => g !== undefined) ?? '';
	return text.replace(/\{(x|\d)\}/g, (_, key: string) =>
		key === 'x' ? first : match[Number(key)] ?? ''
	);
}

export function explain(text: string): Explanation[] {
	if (!text) {
		return [];
	}
	const results: Explanation[] = [];
	for (const e of compiled) {
		const m = text.match(e.regex);
		if (!m) {
			continue;
		}
		results.push({
			matched: m[0],
			position: m.index ?? 0,
			title: fill(e.title, m),
			what: fill(e.what, m),
			why: fill(e.why, m),
			fix: e.fix.map((f) => fill(f, m)),
		});
	}
	results.sort((a, b) => b.position - a.position);
	return results;
}