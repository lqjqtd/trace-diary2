const { withAndroidManifest } = require('@expo/config-plugins');

const withAMapLocation = (config, { apiKey } = {}) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    if (!androidManifest.manifest) {
      androidManifest.manifest = {};
    }

    const permissions = [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.CHANGE_WIFI_STATE',
      'android.permission.READ_PHONE_STATE',
      'android.permission.ACCESS_LOCATION_EXTRA_COMMANDS',
    ];

    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }

    permissions.forEach((permission) => {
      const exists = androidManifest.manifest['uses-permission'].some(
        (p) => p.$ && p.$['android:name'] === permission
      );
      if (!exists) {
        androidManifest.manifest['uses-permission'].push({
          $: {
            'android:name': permission,
          },
        });
      }
    });

    if (!androidManifest.manifest.application) {
      androidManifest.manifest.application = [];
    }

    let application = androidManifest.manifest.application[0];
    if (!application) {
      application = { $: {} };
      androidManifest.manifest.application.push(application);
    }

    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    const hasAmapKey = application['meta-data'].some(
      (m) => m.$ && m.$['android:name'] === 'com.amap.api.v2.apikey'
    );

    if (apiKey && !hasAmapKey) {
      application['meta-data'].push({
        $: {
          'android:name': 'com.amap.api.v2.apikey',
          'android:value': apiKey,
        },
      });
    }

    if (!application.service) {
      application.service = [];
    }

    const hasAmapService = application.service.some(
      (s) => s.$ && s.$['android:name'] === 'com.amap.api.location.APSService'
    );

    if (!hasAmapService) {
      application.service.push({
        $: {
          'android:name': 'com.amap.api.location.APSService',
        },
      });
    }

    return config;
  });
};

module.exports = withAMapLocation;
