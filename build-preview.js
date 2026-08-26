/* build-preview.js — 모든 파일을 preview.html 한 개로 묶어 로컬 확인용 */
const fs = require('fs');
const files = ['store.js','ui.js','sync.js','app.js','view-words.js','view-study.js','view-decks.js','view-settings.js'];
let html = fs.readFileSync('index.html','utf8');
html = html.replace('<link rel="stylesheet" href="styles.css">','<style>\n'+fs.readFileSync('styles.css','utf8')+'\n</style>');
files.forEach(f=>{ html = html.replace(`<script src="${f}"></script>`, '<script>\n'+fs.readFileSync(f,'utf8')+'\n</script>'); });
fs.writeFileSync('preview.html', html);
console.log('preview.html', (html.length/1024).toFixed(1)+'KB');
