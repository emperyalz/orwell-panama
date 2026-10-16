/** Bound repeated same-class failures while allowing one model escalation for repair. */
export const MAX_FAILURES_PER_CLASS=2;
export function classifyFailure(message='') {
 const text=String(message).toLowerCase();
 if(/held:|allowance|allocation|reserve|subscription|usage unavailable|paused|deadline|time limit|active model/.test(text))return 'capacity';
 if(/invalid or incomplete|did not return|exit [^;]*|run error|model/.test(text))return 'model';
 return 'execution';
}
export function retryDecision({failureCounts={},failureClass='execution'}) {
 const count=(failureCounts[failureClass]??0)+1;
 return {failureClass,count,blocked:count>=MAX_FAILURES_PER_CLASS,model:failureClass==='model'&&count===1?'gpt-6.1-sol':null};
}
