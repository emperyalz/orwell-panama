import {ArrowUpRight} from 'lucide-react';
export function SourceLink({href,children}:{href?:string;children:React.ReactNode}){return href?<a className="source-link" href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={13}/></a>:<span className="record-muted">{children}</span>;}
