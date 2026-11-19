import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transform,publicSnapshot,ranges} from './sync.mjs';
test('merge aligned summary rows with matrix and preserve public visibility',()=>{
 const h=Array(23).fill('');const mh=Array(21).fill('');mh[9]='Tổng case (N)';mh[10]='Case đã auto (A)';
 const e=Array(21).fill('');Object.assign(e,{0:'1',2:'Product',4:'Project',9:'100',10:'80',12:'80%'});
 const s=transform([['Dự án'],['Project'],[],['Other']],[h,['role'],[],['other-role']],[mh,[],e]);
 assert.equal(s.rows.length,2);assert.equal(s.rows[0][13],'100');assert.equal(s.rows[0][14],'80');assert.equal(s.rows[0][17],'80%');assert.equal(s.rows[1][9],'other-role');
 assert.equal(s.rows[0][8],'');assert.equal(publicSnapshot(s).rows[0][9],'');
 assert.equal(s.headers.length,32);assert.equal(s.rows[0].length,32);
 assert.ok(!ranges.some(r=>/!.*J/.test(r)));
});
test('reject changed schema and empty source',()=>{
 assert.throws(()=>transform([],[],[]));
});
