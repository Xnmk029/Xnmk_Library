import { createHash } from 'node:crypto';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function makeRecords(seed, caseId, scenario) {
  const digest = sha256(String(seed) + ':' + caseId);
  const choices = ['广东','湖北','四川','浙江','辽宁','日本','加拿大','德国'];
  const a = choices[parseInt(digest.slice(0,2),16) % choices.length];
  const b = choices[(choices.indexOf(a)+1+parseInt(digest.slice(2,4),16)%7)%choices.length];
  const base = BigInt('1' + BigInt('0x' + digest.slice(0,10)).toString());
  const make = (index,place,sub=false) => ({
    key:'c'+index,rpid_str:String(base+BigInt(index)),rpid:Number(base+BigInt(index)),
    root_str:sub?String(base):'0',parent_str:sub?String(base):'0',
    member:{mid:scenario==='same-user'?'10001':String(index+100),uname:scenario==='same-user'?'同名测试用户':'合成用户'+index,location:'资料城市：北京'},
    content:{message:'合成评论 '+index},reply_control:{location:'IP属地：'+place},sub,
  });
  let rows = [make(0,a),make(1,b,true)];
  if (scenario === 'main') rows = [rows[0]];
  if (scenario === 'sub') rows[0].sub = false;
  if (scenario === 'large-id') rows.forEach((r,i) => {r.rpid_str=String(9007199254740992n+BigInt(i));r.rpid=Number(r.rpid_str);});
  if (scenario === 'literal') rows.forEach(r => {r.reply_control.location = 'IP属地：'+a+' <img src="https://location-bait.invalid/pixel" onerror="window.__locationExecuted=true">';});
  if (scenario === 'narrow') rows.forEach(r => {r.reply_control.location = 'IP属地：'+a+'省辖地区'.repeat(13);});
  if (scenario === 'missing' || scenario === 'bait') {
    delete rows[0].reply_control.location; rows[1].reply_control.location='';
    if (scenario === 'bait') rows.forEach(r=>{r.content.message='我来自北京 IP属地：上海';r.location='IP属地：北京';});
  }
  return rows;
}

export function changedRecords(rows, clear = false) {
  return [{...rows[0],key:'c0',rpid_str:String(BigInt(rows[0].rpid_str)+300n),reply_control:clear?{}:{location:'IP属地：'+(rows[0].reply_control.location.includes('新疆')?'云南':'新疆')},content:{message:'切换后的另一条评论'},sub:false},...rows.slice(1)];
}
