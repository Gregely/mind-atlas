/** Plain text utilities: word counts, tokenising for the lexicon, tag normalisation. */

/** Count words in a body of text. */
export function wordCount(s: string): number {
  const m = s.trim().match(/[\p{L}\p{N}’']+/gu);
  return m ? m.length : 0;
}

/** Split a body into paragraphs (blank-line separated). */
export function paragraphs(s: string): string[] {
  return s
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** First characters of the body, on one line, for placards and ledgers. */
export function incipit(s: string, n = 120): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? flat.slice(0, n).replace(/\s+\S*$/, '') + ' …' : flat;
}

/** Normalise a tag: trimmed, lower-case, single spaces, no leading '#'. */
export function normalizeTag(t: string): string {
  return t.replace(/^#+/, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40);
}

/**
 * Common English function words, excluded from the lexicon so it shows content words.
 * Edit freely.
 */
export const STOPWORDS = new Set(
  `a about above after again against all also am an and any are aren't as at be because been before being below
  between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each
  even ever every few for from further get gets got had hadn't has hasn't have haven't having he he'd he'll he's her
  here here's hers herself him himself his how how's however i i'd i'll i'm i've if in into is isn't it it's its itself
  just let's like made make many may me might more most much must mustn't my myself no nor not now of off on once
  one only or other ought our ours ourselves out over own perhaps quite rather really same say said says shan't she
  she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there
  there's these they they'd they'll they're they've thing things this those though through thus to too under until
  up upon us very was wasn't way we we'd we'll we're we've well were weren't what what's when when's where where's
  whether which while who who's whom whose why why's will with within without won't would wouldn't yes yet you
  you'd you'll you're you've your yours yourself yourselves also still back something nothing anything everything
  someone anyone everyone around another being across toward towards onto per via ago`
    .split(/\s+/)
    .filter(Boolean),
);

/** Lower-case content words of length ≥ 3, stopwords removed. */
export function contentWords(s: string): string[] {
  const m = s.toLowerCase().replace(/’/g, "'").match(/[\p{L}][\p{L}']*/gu) || [];
  return m
    .map((w) => w.replace(/'s$/, '').replace(/^'+|'+$/g, ''))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/** Escape a string for use inside a RegExp. */
export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
