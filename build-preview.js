/* build-preview.js — 모든 파일을 preview.html 한 개로 묶어 로컬 확인용 */
const fs = require('fs');
const files = ['store.js','ui.js','sync.js','app.js','view-words.js','view-study.js','view-decks.js','view-settings.js'];
let html = fs.readFileSync('index.html','utf8');
const inline = '<style>\n' + fs.readFileSync('styles.css','utf8') + '\n</style>\n<script>window.BUILD = "preview";</script>\n'
  + files.map(f => '<script>\n' + fs.readFileSync(f,'utf8') + '\n</script>').join('\n') + '\n<script>App.start();</script>';
html = html.replace(/<!-- loader:[\s\S]*?<!-- \/loader -->/, () => inline);
fs.writeFileSync('preview.html', html);
console.log('preview.html', (html.length/1024).toFixed(1)+'KB');
