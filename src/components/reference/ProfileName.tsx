'use client';
import {useEffect,useRef,useState} from 'react';
import {profileName} from '@/lib/profile-presentation';
function NameLine({children}:{children:string}){
 const box=useRef<HTMLSpanElement>(null);const text=useRef<HTMLSpanElement>(null);const [fit,setFit]=useState({scale:1,size:0});
 useEffect(()=>{let live=true;const measure=()=>{if(!live||!box.current)return;const style=getComputedStyle(box.current);const canvas=document.createElement('canvas');const context=canvas.getContext('2d');if(!context)return;context.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;const label=children.toLocaleUpperCase('es');const spacing=parseFloat(style.letterSpacing)||0;const natural=context.measureText(label).width+Math.max(0,label.length-1)*spacing;const ratio=Math.min(1,box.current.clientWidth/Math.max(1,natural));setFit({scale:Math.max(.72,ratio),size:parseFloat(style.fontSize)*Math.min(1,ratio/.72)});};const observer=new ResizeObserver(measure);if(box.current)observer.observe(box.current);document.fonts.ready.then(measure);return()=>{live=false;observer.disconnect();};},[children]);
 return <span className="index-name-line" data-fitted={fit.size>0} ref={box} style={{lineHeight:fit.size?`${fit.size*1.08}px`:undefined}}><span ref={text} style={{transform:`scaleX(${fit.scale})`,fontSize:fit.size?`${fit.size}px`:undefined}}>{children}</span></span>;
}
export function ProfileName({name}:{name:string}){
 const {given,surname}=profileName(name);const lines:string[]=[];
 for(const word of surname.split(' ')){const last=lines.length-1;if(last>=0&&(lines[last]+' '+word).length<=13)lines[last]+=' '+word;else lines.push(word);}
 return <h1 className="index-name" aria-label={name}><span className="index-given">{given}</span><span className={`index-surname${lines.length>1?' index-surname-multiline':''}`}>{lines.map((line,i)=><NameLine key={i}>{line}</NameLine>)}</span></h1>;
}
