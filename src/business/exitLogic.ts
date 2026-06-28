import { BusinessStateData } from './businessTypes';
import { canHireGeneralManager, createFreshBusiness, saveBusiness } from './businessLogic';

export function delegateCompanyToManager(state: BusinessStateData): BusinessStateData {
  if (!canHireGeneralManager(state)) {
    state.lastMessage = 'Ainda nao da para contratar gerente geral. Busque caixa, lucro mensal e margem maiores.';
    saveBusiness(state);
    return state;
  }

  const releasedCapital = Math.round(state.financials.cash * 0.35);
  const founder = {
    ...state.founder,
    capital: state.founder.capital + releasedCapital,
    managedCompanies: state.founder.managedCompanies + 1,
    lastExitValue: releasedCapital
  };

  const next = createFreshBusiness(null, founder);
  next.lastMessage = `Gerente geral contratado. Fundador liberou R$ ${releasedCapital.toLocaleString('pt-BR')} e pode comprar outra empresa.`;
  saveBusiness(next);
  return next;
}
