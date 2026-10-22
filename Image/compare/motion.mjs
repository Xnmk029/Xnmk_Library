// Exact timing and divider equation from motion-kit-v03 compare / renderer.
export function dividerAt(t){return t>1.15&&t<4.5?960+330*Math.sin((t-1.15)/3.35*Math.PI*2)*Math.sin((t-1.15)/3.35*Math.PI):960;}
export function materialAt(t){return Math.min(t,2.4)+Math.max(0,t-2.4)*.16;}

