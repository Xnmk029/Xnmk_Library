import {makeKit} from './lib/primitives.mjs';
import {DRAW,SCENE_STATE} from './lib/scenes.mjs';
import {SCENES} from './catalog.mjs';
export function makeMotionRenderer(canvas,palette='phase'){
  const kit=makeKit(canvas,palette);
  return {draw(index,local,options={}){
    const scene=SCENES[index];const t=Math.max(0,Math.min(local,scene.duration));
    const quiet=['media','lowerthird','captions','callout','metric','chart','compare','process','takeaway'].includes(scene.id);
    // 持续流动层（design.md §8.1）：信息段把材质速度降到 16%，几乎静止但不冻结。
    const materialTime=quiet?Math.min(t,2.4)+Math.max(0,t-2.4)*.16:t;
    kit.begin(scene.start+materialTime,scene.state||SCENE_STATE[scene.id]||'signal');
    DRAW[scene.id](kit,t,{...scene.content,...options.content});
    if(options.transitions!==false){if(t<.32)kit.shutter(1-t/.32,'tide',true);if(t>scene.duration-.42)kit.shutter((t-scene.duration+.42)/.42,'tide');}
    return {bounds:kit.bounds};
  }};
}
