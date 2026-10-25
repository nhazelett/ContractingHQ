import {summarizeModifications} from './modifications.mjs';
export function incorporatePortfolio(data){
 if(!data.history)return {...data.award,latest_mod_number:null,latest_option_mod_number:null,history_pending:true,details_pending:false};
 const h=summarizeModifications(data.history.actions,{truncated:data.history.has_next});
 return {...data.award,latest_mod_number:h.latest_mod?.modification_number||null,latest_option_mod_number:h.latest_option_mod?.modification_number||null,latest_action_date:data.history.actions[0]?.action_date||data.award.latest_action_date,history_pending:false,details_pending:false};
}
export const summariesComplete=state=>!state.hasNext&&!state.pending.length;
export const portfolioComplete=state=>summariesComplete(state)&&!state.evidencePending.length;
