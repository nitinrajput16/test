const path = require('node:path');
module.exports = {
  themeV2: () => process.env.CODEPLAT_THEME_V2 === '1',
  pagePath(name) { return path.join(__dirname, '../../public', `${name}${process.env.CODEPLAT_THEME_V2 === '1' ? '' : '-legacy'}.html`); }
};
