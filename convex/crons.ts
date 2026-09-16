import {cronJobs} from 'convex/server';
import {internal} from './_generated/api';
const crons=cronJobs();
crons.interval('Panama news: six names per hour',{hours:1},internal.activityActions.news,{});
crons.interval('Reuse Monitor social archive',{hours:24},internal.activityActions.socialArchive,{});
crons.interval('Assembly public voting reports',{hours:24},internal.legislativeActions.refresh,{});
export default crons;
