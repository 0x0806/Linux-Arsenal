// Loads the browser modules into Node (they attach to globalThis.LA)
const path = require('path');
const files = ['vfs', 'shell', 'commands/util', 'commands/builtins', 'commands/files', 'commands/text', 'commands/awk',
  'commands/system', 'commands/network', 'commands/devtools', 'docs', 'system', 'challenges'];
const fs = require('fs');
for (const f of files) {
  const p = path.join(__dirname, '..', 'js', f + '.js');
  if (fs.existsSync(p)) require(p);
}
module.exports = globalThis.LA;
