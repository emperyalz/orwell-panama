import {query} from './_generated/server';
export const latest=query({args:{},handler:async(ctx)=>{
 const sessions=await ctx.db.query('votingSessions').withIndex('by_sessionDate').order('desc').take(12);
 return sessions.map(s=>({id:s._id,title:s.votingTitle,date:s.sessionDate,sourceUrl:`https://prensa507.asamblea.gob.pa/api/v1/report/${s.reportId}/public`}));
}});
