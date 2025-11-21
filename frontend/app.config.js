module.exports = {
  expo: {
    name: "Cardealo",
    slug: "cardealo",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      usesNonExemptEncryption: false,
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      },
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
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
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
