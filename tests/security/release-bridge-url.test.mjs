import assert from 'node:assert/strict';
import test from 'node:test';
import {validateReleaseIdentity} from '../../scripts/architecture/release-identity.mjs';

const deployment='AKfycbwjl1JCfE0eV92P6DCn6h8jIVIBlSwLOQj8U7Mz1_7YW2Xan8DPI5tpWJuiG7znSCSs';
const expected=`https://script.google.com/macros/s/${deployment}/exec`;

function acceptsBridge(url,extra=''){
  let accepted;
  validateReleaseIdentity({
    check:(ok,message)=>{if(message.startsWith('CONFIG.drive.bridgeUrl'))accepted=ok},
    pkg:{},pkgLock:{},version:'',build:'',index:'',
    config:`${extra}\n  bridgeUrl: "${url}",\n`
  });
  return accepted;
}

test('release accepts the exact institutional Apps Script endpoint',()=>{
  assert.equal(acceptsBridge(expected),true);
});

test('an expected URL embedded elsewhere cannot certify a different bridge',()=>{
  assert.equal(acceptsBridge('https://attacker.test/exec',`// ${expected}`),false);
  for(const url of [
    `https://attacker.test/?next=${expected}`,
    `${expected}/other`,`${expected}?redirect=attacker`,`${expected}#fragment`,
    expected.replace('script.google.com','script.google.com.attacker.test'),
    expected.replace('https://','https://user:password@'),
    expected.replace('/exec','/dev'),expected.replace('https://','http://')
  ])assert.equal(acceptsBridge(url),false,url);
});
