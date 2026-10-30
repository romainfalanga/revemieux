import { copyFileSync } from 'node:fs';
copyFileSync('node_modules/chart.js/dist/chart.umd.js', 'public/static/chart.umd.js');
