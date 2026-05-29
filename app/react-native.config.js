// react-native-mmkv v4 renamed its ReactPackage class to NitroMmkvPackage.
// The Expo autolinking registry still has the old v3 name (com.mrousavy.mmkv.MmkvPackage)
// which doesn't exist in v4. Override it here so the generated PackageList.java
// uses the correct class.
module.exports = {
  dependencies: {
    'react-native-mmkv': {
      platforms: {
        android: {
          packageImportPath: 'import com.margelo.nitro.mmkv.NitroMmkvPackage;',
          packageInstance: 'new NitroMmkvPackage()',
        },
      },
    },
  },
};
