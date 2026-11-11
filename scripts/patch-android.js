// Runs in GitHub Actions after "cap add android". Adds exact-alarm permissions, signing and the version number.
const fs = require('fs');
const g = 'android/app/build.gradle', m = 'android/app/src/main/AndroidManifest.xml';
let s = fs.readFileSync(g, 'utf8');
const vc = process.env.VERSION_CODE || '1';
s = s.replace(/versionCode \d+/, 'versionCode ' + vc).replace(/versionName "[^"]*"/, 'versionName "1.' + vc + '"');
if (!s.includes('signingConfigs')) {
  s = s.replace('    buildTypes {', `    signingConfigs {
        release {
            storeFile file(System.getenv('KS_FILE'))
            storePassword System.getenv('KS_PASS')
            keyAlias 'ikoge'
            keyPassword System.getenv('KS_PASS')
        }
    }
    buildTypes {`);
  s = s.replace('        release {\n            minifyEnabled false', '        release {\n            signingConfig signingConfigs.release\n            minifyEnabled false');
}
if (!s.includes('signingConfig signingConfigs.release') || !s.includes('versionCode ' + vc)) throw new Error('gradle patch failed');
fs.writeFileSync(g, s);
let x = fs.readFileSync(m, 'utf8');
const perms = '    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />\n' +
  '    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32" />\n' +
  '    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />\n' +
  '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n';
if (!x.includes('USE_EXACT_ALARM')) x = x.replace('</manifest>', perms + '</manifest>');
if (!x.includes('USE_EXACT_ALARM')) throw new Error('manifest patch failed');
fs.writeFileSync(m, x);
console.log('patched');
