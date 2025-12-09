module.exports = {
  expo: {
    name: "Cardealo",
    slug: "cardealo",
    version: "2.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    runtimeVersion: {
      policy: "appVersion"
    },
    updates: {
      url: "https://u.expo.dev/8f5a86f1-d0fe-4f59-945b-de508bb92123"
    },
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#2D2D2D"
    },
    ios: {
      supportsTablet: true,
      usesNonExemptEncryption: false,
      infoPlist: {
        NMFClientId: process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID,
        NMFClientSecret: process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_SECRET,
        NMFNcpKeyId: process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID,
        NSLocationWhenInUseUsageDescription: "This app needs access to your location to show nearby stores and card benefits.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app needs access to your location to show nearby stores and card benefits."
      },
      bundleIdentifier: "com.cardealo.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#292929"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ],
      package: "com.cardealo.app"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-font",
      "expo-dev-client",
      "expo-updates",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 200,
          backgroundColor: "#2D2D2D",
          resizeMode: "contain"
        }
      ],
      "./plugins/withNaverMaps",
      "./plugins/withNaverMapsGradle",
      "./plugins/withPodfileSource"
    ],
    extra: {
      eas: {
        projectId: "8f5a86f1-d0fe-4f59-945b-de508bb92123"
      }
    }
  }
};
