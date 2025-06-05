/**
 * Fetch localized page titles for a list of scientific names from Wikipedia.
 * Chunks requests to avoid URL length limits and handles errors gracefully.
 *
 * @param scientificNames  Array of species scientific names (e.g., 'Turdus migratorius')
 * @param lang             Target language code (e.g., 'de', 'fr')
 * @returns                Map from original title to localized name
 */
export async function fetchLocalizedNamesPage(
    scientificNames: string[],
    lang: string
): Promise<Record<string, string>> {
    if (scientificNames.length === 0) return {};

    const result: Record<string, string> = {};

    // Split into chunks of 50 titles to respect URL limits
    const chunkSize = 50;
    for (let i = 0; i < scientificNames.length; i += chunkSize) {
        const chunk = scientificNames.slice(i, i + chunkSize);
        const titlesParam = chunk
            .map(name => name.replace(/ /g, '_'))
            .map(encodeURIComponent)
            .join('|');

        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            prop: 'langlinks',
            titles: titlesParam,
            lllang: lang,
            lllimit: '1',
            origin: '*',
        });

        const url = `https://${lang}.wikipedia.org/w/api.php?${params}`;

        try {
            const resp = await fetch(url);
            if (!resp.ok) {
                console.warn(`Wikipedia API returned status ${resp.status}`);
                continue;
            }

            const data = await resp.json();
            const pages = data.query?.pages || {};

            Object.values<any>(pages).forEach(page => {
                const originalTitle = page.title.replace(/_/g, ' ');
                const links = page.langlinks as { lang: string; '*': string }[];
                if (Array.isArray(links) && links.length > 0) {
                    result[originalTitle] = links[0]['*'];
                }
            });
        } catch (err) {
            console.warn('Error fetching localized names from Wikipedia:', err);
        }
    }

    return result;
}

/**
 * Localized bird names for one species in multiple languages.
 */
export interface LocalizedNames {
    /** English common name (or page title) */
    en: string;
    /** German local name, if found */
    de?: string;
    /** Spanish local name, if found */
    es?: string;
    /** Ukrainian local name, if found */
    uk?: string;
    /** Arabic local name, if found */
    ar?: string;
}

/**
 * Fetch English, German, Spanish, Ukrainian, and Arabic names for a single scientific name.
 * Uses Wikipedia langlinks from the English Wikipedia and filters for the desired languages.
 *
 * @param scientificName  The Latin binomial (e.g., 'Turdus migratorius')
 * @returns                Object with keys en, de, es, uk, ar
 */
export async function fetchLocalizedNamesSingle(
    scientificName: string
): Promise<LocalizedNames> {
    const defaultName = scientificName.replace(/_/g, ' ');
    if (!scientificName) return { en: defaultName };

    const titleParam = encodeURIComponent(scientificName.replace(/ /g, '_'));
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        prop: 'langlinks',
        titles: titleParam,
        lllimit: '500',
        origin: '*',
    });

    const url = `https://en.wikipedia.org/w/api.php?${params}`;
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Wikipedia API ${resp.status}`);

        const data = await resp.json();
        const pages = data.query?.pages || {};

        // Initialize with English fallback
        let en = defaultName;
        let de: string | undefined;
        let es: string | undefined;
        let uk: string | undefined;
        let ar: string | undefined;

        Object.values<any>(pages).forEach(page => {
            // Page.title is the English Wikipedia page title
            en = (page.title || defaultName).replace(/_/g, ' ');
            const links = page.langlinks as { lang: string; '*': string }[];
            if (Array.isArray(links)) {
                for (const ll of links) {
                    switch (ll.lang) {
                        case 'de': de = ll['*']; break;
                        case 'es': es = ll['*']; break;
                        case 'uk': uk = ll['*']; break;
                        case 'ar': ar = ll['*']; break;
                    }
                }
            }
        });

        return { en, de, es, uk, ar };
    } catch (err) {
        console.warn('Error fetching single localized name from Wikipedia:', err);
        return { en: defaultName };
    }
}


