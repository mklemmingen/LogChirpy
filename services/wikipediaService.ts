export async function fetchLocalizedNamesBatch(
    scientificNames: string[],
    lang: string
): Promise<Record<string, string>> {
    if (!scientificNames.length) return {};

    // Build a pipe-separated | list of page titles
    const titles = scientificNames
        .map((n) => encodeURIComponent(n.replace(/ /g, '_')))
        .join('%7C'); // '|' escaped

    // Wikipedia API: ask only for our target language
    const endpoint = `https://${lang}.wikipedia.org/w/api.php` +
        `?action=query` +
        `&format=json` +
        `&prop=langlinks` +
        `&titles=${titles}` +
        `&lllang=${lang}` +
        `&lllimit=1` +
        `&origin=*`;

    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Wiki API ${res.status}`);

    const json = await res.json();
    const pages = json.query?.pages ?? {};
    const map: Record<string, string> = {};

    // pages is an object keyed by pageid
    Object.values(pages).forEach((pg: any) => {
        const originalTitle = pg.title.replace(/_/g, ' ');
        const links = pg.langlinks as Array<{ lang: string; '*': string }>;
        if (links && links.length > 0) {
            map[originalTitle] = links[0]['*'];
        }
    });

    return map;
}
