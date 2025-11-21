const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withPodfileSource = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Check if source is already specified
      if (!podfileContent.includes("source 'https://github.com/CocoaPods/Specs.git'")) {
        // Add GitHub source at the top of Podfile
        const sourceDeclaration = "source 'https://github.com/CocoaPods/Specs.git'\n\n";

        // Insert after any existing source declarations or at the beginning
        if (podfileContent.includes('require_relative')) {
          // Insert before require_relative
          podfileContent = podfileContent.replace(
            /require_relative/,
            `${sourceDeclaration}require_relative`
          );
        } else {
          // Insert at the very beginning
          podfileContent = sourceDeclaration + podfileContent;
        }

        fs.writeFileSync(podfilePath, podfileContent);
      }

      return config;
    },
  ]);
};

module.exports = withPodfileSource;
