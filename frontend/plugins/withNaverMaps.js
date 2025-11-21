const { withAndroidManifest } = require('@expo/config-plugins');

const withNaverMaps = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;

    // Get Naver Maps Client ID from environment
    const naverMapClientId = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID;

    if (!naverMapClientId) {
      console.warn('EXPO_PUBLIC_NAVER_MAP_CLIENT_ID not found in environment variables');
      return config;
    }

    // Add meta-data to application
    if (!androidManifest.application) {
      androidManifest.application = [{}];
    }

    if (!androidManifest.application[0]['meta-data']) {
      androidManifest.application[0]['meta-data'] = [];
    }

    // Check if Naver Maps meta-data already exists
    const existingMetaData = androidManifest.application[0]['meta-data'].find(
      (item) => item.$['android:name'] === 'com.naver.maps.map.NCP_KEY_ID'
    );

    if (!existingMetaData) {
      // Add Naver Maps NCP_KEY_ID meta-data
      androidManifest.application[0]['meta-data'].push({
        $: {
          'android:name': 'com.naver.maps.map.NCP_KEY_ID',
          'android:value': naverMapClientId,
        },
      });
    } else {
      // Update existing meta-data
      existingMetaData.$['android:value'] = naverMapClientId;
    }

    return config;
  });
};

module.exports = withNaverMaps;
