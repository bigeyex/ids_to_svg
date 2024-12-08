const fs = require('fs');

import IDSToSvg from "./src"
const idsToSvg = IDSToSvg.fromFontSync('fonts/SourceHanSerifCNRegular.otf');

const svg = idsToSvg.svgFromIds('⿰王⿱丿⿻乚龷');

console.log(svg);
fs.writeFileSync('output.svg', svg);
