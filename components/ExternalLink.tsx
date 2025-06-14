import React from 'react';
import { Link } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { type ComponentProps } from 'react';
import { Platform } from 'react-native';

type ExternalUrl = `http${string}` | `https${string}` | `mailto:${string}` | `tel:${string}`;
type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: ExternalUrl };

export function ExternalLink({ href, ...rest }: Props) {
    return (
        <Link
            target="_blank"
            {...rest}
            href={href as any} // External URL - type assertion needed for expo-router
            onPress={async (event) => {
                if (Platform.OS !== 'web') {
                    // Prevent the default behavior of linking to the default browser on native.
                    event.preventDefault();
                    // Open the link in an in-app browser.
                    await openBrowserAsync(href);
                }
            }}
        />
    );
}