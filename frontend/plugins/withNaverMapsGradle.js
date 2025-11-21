const { withProjectBuildGradle } = require('@expo/config-plugins');

const withNaverMapsGradle = (config) => {
  return withProjectBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;
    const naverMavenRepo = `maven {
      url 'https://repository.map.naver.com/archive/maven'
    }`;

    // Check if Naver Maps repository is already added
    if (buildGradle.includes('repository.map.naver.com')) {
      return config;
    }

    // Add Naver Maps repository to allprojects.repositories
    const allProjectsRegex = /(allprojects\s*\{[\s\S]*?repositories\s*\{)/;

    if (allProjectsRegex.test(buildGradle)) {
      config.modResults.contents = buildGradle.replace(
        allProjectsRegex,
        `$1\n    ${naverMavenRepo}`
      );
    }

    return config;
  });
};

module.exports = withNaverMapsGradle;
