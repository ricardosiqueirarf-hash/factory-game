import { BusinessStateData, CommercialStrategyKey, CompanyKind, Department, MaterialState } from './businessTypes';
import { applyCommercialStrategy, canHireGeneralManager, chooseCompany, getCompanyName, getCompanyPurchasePrice, getCompanyValuation, getNextAffordableScale, loadBusiness, recalculateIndicators, resetBusiness, runMonth, saveBusiness, sellCompany } from './businessLogic';
import { delegateCompanyToManager } from './exitLogic';
import { evaluateFormula } from './formulaEngine';

export class BusinessIdleApp {
  private state: BusinessStateData = loadBusiness();

  constructor(private readonly root: HTMLElement) {
    this.root.className = 'idle-root';
    this.render();
  }

  private render(): void {
    if (!this.state.companyKind) {
      this.root.innerHTML = this.startHtml();
      this.bind();
      return;
    }

    this.root.innerHTML = `
      <header class="idle-topbar">
        <div><p class="eyebrow">Factory Idle OS</p><h1>${getCompanyName(this.state.companyKind)} | Porte ${this.state.companyScale}</h1></div>
        <div class="top-metrics"><span>Mes <b>${this.state.month}</b></span><span>Capital fundador <b>${this.money(this.state.founder.capital)}</b></span><span>Caixa empresa <b>${this.money(this.state.financials.cash)}</b></span><span>Resultado <b>${this.money(this.state.financials.resultMonth)}</b></span></div>
      </header>
      <section class="month-bar"><div><b>Decisao mensal manual</b><span> Ajuste formulas e estrategias antes de fechar o mes.</span></div><button data-run-month>Passar mes</button></section>
      <nav class="sector-tabs">
        ${this.tab('logistics', 'Logistica')}${this.tab('commercial', 'Comercial')}${this.tab('finance', 'Financeiro / Saida')}
      </nav>
      <main class="sector-layout"><section class="sector-main">${this.departmentHtml()}</section><aside class="sector-side">${this.execHtml()}</aside></main>
      <footer class="idle-console">${this.state.lastMessage}</footer>
    `;
    this.bind();
  }

  private startHtml(): string {
    const scale = getNextAffordableScale(this.state.founder);
    const doorsPrice = getCompanyPurchasePrice('doors_factory', scale);
    const sawmillPrice = getCompanyPurchasePrice('sawmill', scale);
    return `
      <main class="start-screen">
        <p class="eyebrow">Simulador empresarial idle</p>
        <h1>Compre uma empresa</h1>
        <p>Objetivo: operar a empresa, construir margem e independencia, contratar gerente geral ou vender a empresa. Depois use o capital para comprar empresas maiores.</p>
        <div class="finance-grid">
          <article><span>Capital do fundador</span><b>${this.money(this.state.founder.capital)}</b></article>
          <article><span>Empresas vendidas</span><b>${this.state.founder.soldCompanies}</b></article>
          <article><span>Empresas gerenciadas</span><b>${this.state.founder.managedCompanies}</b></article>
          <article><span>Proximo porte alvo</span><b>${scale}</b></article>
        </div>
        <div class="choice-grid">
          <button data-company="doors_factory"><b>Fabrica de portas | Porte ${scale}</b><span>Preco: ${this.money(doorsPrice)}. Aluminio, vidro e ferragens.</span></button>
          <button data-company="sawmill"><b>Madereira | Porte ${scale}</b><span>Preco: ${this.money(sawmillPrice)}. Madeira bruta, cola e verniz.</span></button>
        </div>
        <button data-reset class="reset-start">Resetar carreira</button>
      </main>
    `;
  }

  private tab(department: Department, label: string): string {
    return `<button class="${this.state.selectedDepartment === department ? 'active' : ''}" data-tab="${department}">${label}</button>`;
  }

  private departmentHtml(): string {
    if (this.state.selectedDepartment === 'commercial') return this.commercialHtml();
    if (this.state.selectedDepartment === 'finance') return this.financeHtml();
    return this.logisticsHtml();
  }

  private logisticsHtml(): string {
    recalculateIndicators(this.state);
    return `
      <div class="section-title"><div><p class="eyebrow">Setor</p><h2>Logistica e estoque</h2></div><p>Use formulas tipo Excel para decidir compras antes de passar o mes.</p></div>
      <div class="formula-help">Variaveis: <code>ESTOQUE</code>, <code>VAZAO</code>, <code>DEMANDA</code>, <code>CAIXA</code>, <code>CAPITAL</code>, <code>CUSTO</code>, <code>MES</code>, <code>PORTE</code>. Funcoes: <code>SE</code>, <code>MAX</code>, <code>MIN</code>, <code>SOMA</code>.</div>
      <div class="indicator-builder"><h3>Indicadores</h3>${this.state.indicators.map((indicator) => `<p><b>${indicator.name}</b><span>${this.num(indicator.value)}</span><small>${indicator.formula}</small></p>`).join('')}</div>
      <div class="material-grid">${this.state.materials.map((material) => this.materialHtml(material)).join('')}</div>
    `;
  }

  private materialHtml(material: MaterialState): string {
    const coverage = material.monthlyFlow > 0 ? material.stock / material.monthlyFlow : 0;
    const reorder = evaluateFormula(material.reorderFormula, this.previewVars(material));
    const qty = evaluateFormula(material.quantityFormula, this.previewVars(material));
    return `
      <article class="material-card">
        <header><h3>${material.name}</h3><span>${this.num(material.stock)} ${material.unit}</span></header>
        <p>Vazao media <b>${this.num(material.monthlyFlow)}/mes</b></p>
        <p>Cobertura <b>${coverage.toFixed(1)} meses</b></p>
        <p>Compra prevista <b>${reorder.value > 0 ? this.num(Math.max(0, qty.value)) : '0'} ${material.unit}</b></p>
        <label>Comprar?</label><input data-reorder="${material.key}" value="${this.attr(material.reorderFormula)}" />
        <label>Quantidade</label><input data-quantity="${material.key}" value="${this.attr(material.quantityFormula)}" />
        <small>${reorder.error || qty.error || 'Formula ok'}</small>
      </article>
    `;
  }

  private commercialHtml(): string {
    const c = this.state.commercial;
    return `
      <div class="section-title"><div><p class="eyebrow">Setor</p><h2>Comercial</h2></div><p>Aumente faturamento sem criar demanda que o estoque nao suporta.</p></div>
      <div class="strategy-grid">
        ${this.strategy('hire_seller', 'Contratar vendedor', 'Aumenta capacidade, mas sobe folha.')}
        ${this.strategy('marketing', 'Marketing', 'Aumenta demanda mensal.')}
        ${this.strategy('training', 'Treinamento', 'Melhora conversao.')}
        ${this.strategy('reallocate_sales', 'Realocar equipe', 'Aumenta foco comercial.')}
      </div>
      <div class="finance-grid"><article><span>Demanda</span><b>${this.num(c.baseDemand)}</b></article><article><span>Capacidade</span><b>${this.num(c.salesCapacity)}</b></article><article><span>Vendedores</span><b>${c.sellers}</b></article><article><span>Marketing</span><b>${c.marketingLevel}</b></article></div>
    `;
  }

  private strategy(key: CommercialStrategyKey, title: string, description: string): string {
    return `<button class="strategy-card" data-strategy="${key}"><b>${title}</b><span>${description}</span></button>`;
  }

  private financeHtml(): string {
    const f = this.state.financials;
    const margin = f.revenueMonth > 0 ? (f.resultMonth / f.revenueMonth) * 100 : 0;
    const valuation = getCompanyValuation(this.state);
    return `
      <div class="section-title"><div><p class="eyebrow">Setor</p><h2>Financeiro e saida</h2></div><p>Escolha o caminho: contratar gerente geral ou vender a empresa.</p></div>
      <div class="dre-table">
        ${this.row('Receita', f.revenueMonth)}${this.row('Faturamento perdido', f.lostRevenueMonth)}${this.row('Compras', -f.purchasesMonth)}${this.row('Estoque parado', -f.stockHoldingCostMonth)}${this.row('Comercial', -f.commercialCostMonth)}${this.row('Fixo/Folha', -f.fixedCostMonth)}${this.row('Resultado', f.resultMonth)}
      </div>
      <div class="finance-grid"><article><span>Caixa empresa</span><b>${this.money(f.cash)}</b></article><article><span>Margem</span><b>${margin.toFixed(1)}%</b></article><article><span>Valuation estimado</span><b>${this.money(valuation)}</b></article><article><span>Gerente geral</span><b>${this.state.hasGeneralManager ? 'Contratado' : 'Nao'}</b></article></div>
      <div class="strategy-grid exit-grid"><button data-hire-manager><b>Contratar gerente geral</b><span>Libera o fundador para comprar outra empresa. Exige caixa, lucro e margem.</span></button><button data-sell-company><b>Vender empresa</b><span>Realiza o valuation, aumenta capital do fundador e permite comprar empresa maior.</span></button></div>
    `;
  }

  private row(label: string, value: number): string {
    return `<p><span>${label}</span><b class="${value >= 0 ? 'good' : 'bad'}">${this.money(value)}</b></p>`;
  }

  private execHtml(): string {
    const f = this.state.financials;
    const margin = f.revenueMonth > 0 ? f.resultMonth / f.revenueMonth : 0;
    const managerReady = canHireGeneralManager(this.state);
    const risk = f.cash < 0 ? 'QUEBROU' : f.cash < 8000 ? 'RISCO ALTO' : f.resultMonth < 0 ? 'ATENCAO' : 'SAUDAVEL';
    return `<h2>Painel executivo</h2><div class="exec-risk">${risk}</div><p>Objetivo 1 <b>${managerReady ? 'Gerente disponivel' : 'Construir margem'}</b></p><p>Objetivo 2 <b>Vender por ${this.money(getCompanyValuation(this.state))}</b></p><p>Capital fundador <b>${this.money(this.state.founder.capital)}</b></p><p>Caixa empresa <b>${this.money(f.cash)}</b></p><p>Margem mes <b>${(margin * 100).toFixed(1)}%</b></p><p>Empresas vendidas <b>${this.state.founder.soldCompanies}</b></p><p>Ativos gerenciados <b>${this.state.founder.managedCompanies}</b></p><button data-reset>Resetar carreira</button>`;
  }

  private bind(): void {
    this.root.querySelectorAll<HTMLElement>('[data-company]').forEach((el) => el.onclick = () => { this.state = chooseCompany(el.dataset.company as CompanyKind, this.state); this.render(); });
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => el.onclick = () => { this.state.selectedDepartment = el.dataset.tab as Department; saveBusiness(this.state); this.render(); });
    this.root.querySelectorAll<HTMLInputElement>('[data-reorder]').forEach((el) => el.onchange = () => { const m = this.state.materials.find((x) => x.key === el.dataset.reorder); if (m) m.reorderFormula = el.value; saveBusiness(this.state); this.render(); });
    this.root.querySelectorAll<HTMLInputElement>('[data-quantity]').forEach((el) => el.onchange = () => { const m = this.state.materials.find((x) => x.key === el.dataset.quantity); if (m) m.quantityFormula = el.value; saveBusiness(this.state); this.render(); });
    this.root.querySelectorAll<HTMLElement>('[data-strategy]').forEach((el) => el.onclick = () => { this.state.lastMessage = applyCommercialStrategy(this.state, el.dataset.strategy as CommercialStrategyKey); saveBusiness(this.state); this.render(); });
    this.root.querySelector<HTMLElement>('[data-run-month]')?.addEventListener('click', () => { const r = runMonth(this.state); this.state.lastMessage = `Mes fechado: ${r.fulfilledUnits}/${r.demandedUnits} pedidos atendidos. Resultado ${this.money(r.result)}.`; this.render(); });
    this.root.querySelector<HTMLElement>('[data-hire-manager]')?.addEventListener('click', () => { this.state = delegateCompanyToManager(this.state); this.render(); });
    this.root.querySelector<HTMLElement>('[data-sell-company]')?.addEventListener('click', () => { this.state = sellCompany(this.state); this.render(); });
    this.root.querySelector<HTMLElement>('[data-reset]')?.addEventListener('click', () => { this.state = resetBusiness(); this.render(); });
  }

  private previewVars(material: MaterialState): Record<string, number> {
    const vars: Record<string, number> = { ESTOQUE: material.stock, VAZAO: material.monthlyFlow, DEMANDA: this.state.commercial.baseDemand, CAIXA: this.state.financials.cash, CAPITAL: this.state.founder.capital, CUSTO: material.unitCost, MES: this.state.month, PORTE: this.state.companyScale };
    for (const indicator of this.state.indicators) vars[indicator.name] = indicator.value;
    return vars;
  }

  private money(value: number): string { return `${value < 0 ? '-R$ ' : 'R$ '}${Math.abs(Math.round(value)).toLocaleString('pt-BR')}`; }
  private num(value: number): string { return Math.round(value).toLocaleString('pt-BR'); }
  private attr(value: string): string { return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}
