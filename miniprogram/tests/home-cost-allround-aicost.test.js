const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const indexWxml = read('miniprogram/pages/index/index.wxml');
const indexScss = read('miniprogram/pages/index/index.scss');
const allroundTs = read('miniprogram/pages/allrounddesign/allrounddesign.ts');
const allroundJs = read('miniprogram/pages/allrounddesign/allrounddesign.js');
const allroundWxml = read('miniprogram/pages/allrounddesign/allrounddesign.wxml');
const aicostTs = read('miniprogram/pages/aicost/aicost.ts');
const aicostJs = read('miniprogram/pages/aicost/aicost.js');
const aicostWxml = read('miniprogram/pages/aicost/aicost.wxml');
const aicostScss = read('miniprogram/pages/aicost/aicost.scss');

assert.match(indexWxml, /造价生成/, 'home card should show a cost generation label');
assert.match(indexWxml, /data-url="\/pages\/aicost\/aicost"/, 'home cost entry should route to the existing cost page');
assert.match(indexScss, /\.cost-entry-label/, 'home cost label style should be defined');

for (const source of [allroundTs, allroundJs]) {
  assert.match(source, /亲子工坊/, 'allround design should include the parent-child workshop tab');
  assert.match(source, /parentWorkshop/, 'allround design should define parent workshop behavior');
  assert.match(source, /\/pages\/Parentchildcreativity\/Parentchildcreativity/, 'parent workshop tab should preserve the existing page flow');
}

assert.match(allroundWxml, /activeTab === 'parentWorkshop'/, 'allround design should render parent workshop tab content');

for (const source of [aicostTs, aicostJs]) {
  assert.match(source, /estimateTotalCost/, 'cost page should calculate a local rough estimate');
  assert.match(source, /discountRate:\s*0\.7/, 'cost page should display a price about 30 percent below normal cost');
  assert.match(source, /onViewCostDetails/, 'cost page should expose a cost detail toggle');
  assert.match(source, /onContactService/, 'cost page should expose customer service conversion');
}

assert.match(aicostWxml, /省份/, 'cost page should collect province');
assert.match(aicostWxml, /城市/, 'cost page should collect city');
assert.match(aicostWxml, /建筑面积/, 'cost page should collect building area');
assert.match(aicostWxml, /楼层高度/, 'cost page should collect floor height');
assert.match(aicostWxml, /屋顶形式/, 'cost page should collect roof type');
assert.match(aicostWxml, /地下室形式/, 'cost page should collect basement type');
assert.match(aicostWxml, /装修风格/, 'cost page should collect decoration style');
assert.match(aicostWxml, /外立面样式/, 'cost page should collect facade style');
assert.match(aicostWxml, /查看费用明细/, 'cost page should show a detail entry after estimation');
assert.match(aicostWxml, /联系客服/, 'cost page should guide users to customer service');
assert.match(aicostScss, /\.cost-breakdown/, 'cost detail styles should be defined');

console.log('home cost entry, allround parent workshop, and cost estimate checks passed');
