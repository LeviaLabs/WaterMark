// The watermark theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in watermark.settings.json and the generated watermark.settings.ts;
// change them with `astryx experimental theme editor set watermark ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {watermarkSettings} from './watermark.settings';

export const watermarkTheme = defineTheme({
  extends: watermarkSettings,
  name: 'watermark',
});
