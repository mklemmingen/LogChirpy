const { withAndroidStyles } = require('@expo/config-plugins');

const withCustomAndroidStyles = (config) => {
  return withAndroidStyles(config, (config) => {
    // Add the missing Fullscreen style that expo-video requires
    const fullscreenStyle = {
      name: 'Fullscreen',
      parent: '@android:style/Theme.NoTitleBar.Fullscreen',
      items: [
        {
          name: 'android:windowFullscreen',
          value: 'true',
        },
        {
          name: 'android:windowContentOverlay',
          value: '@null',
        },
      ],
    };

    // Add the style to the styles array
    if (!config.modResults.resources.style) {
      config.modResults.resources.style = [];
    }

    // Check if Fullscreen style already exists
    const existingFullscreen = config.modResults.resources.style.find(
      (style) => style.$.name === 'Fullscreen'
    );

    if (!existingFullscreen) {
      config.modResults.resources.style.push({
        $: { name: 'Fullscreen', parent: '@android:style/Theme.NoTitleBar.Fullscreen' },
        item: [
          { $: { name: 'android:windowFullscreen' }, _: 'true' },
          { $: { name: 'android:windowContentOverlay' }, _: '@null' },
        ],
      });
    }

    return config;
  });
};

module.exports = withCustomAndroidStyles;