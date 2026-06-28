import { BusinessStateData, CommercialStrategyKey, CompanyKind, Department, MaterialState } from './businessTypes';
import { applyCommercialStrategy, chooseCompany, getCompanyName, getMonthSeconds, loadBusiness, recalculateIndicators, resetBusiness, runMonth, saveBusiness } from './businessLogic';
import { evaluateFormula } from './formulaEngine';

export class BusinessIdleApp {
  private state: BusinessStateData = loadBusiness();
  private lastTick = performance.now();

  constructor(private readonly root: HTMLElement) {
    this.root.className = 'idle-root';
    this.render();
    window.setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    if (!this.state.companyKind) return;
    const now = performance.now();
    this.state.elapsedSeconds += (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (this.state.elapsedSeconds >= getMonthSeconds()) {
      const result = runMonth(this.state);
      this.state.lastMessage = `Mes fechado: ${result.fulfilledUnits}/${result.demandedUnits} pedidos atendidos. Resultado ${this.money(result.result)}.`;
    } else {
      saveBusiness(this.state);
    }
    this.render();
  }

  private render(): void {
    if (!this.state.companyKind) {
      this.root.innerHTML = this.startHtml();
      this.bind();
      return;
    }

    const progress = Math.min(100, (this.state.elapsedSeconds / getMonthSeconds()) * 100);
    this.root.innerHTML = `
      <header class="idle-topbar">
        <div><p class="eyebrow">Factory Idle OS</p><h1>${getCompanyName(this.state.companyKind)}</h1></div>
        <div class="top-metrics"><span>Mes <b>${this.state.month}</b></span><span>Caixa <b>${this.money(this.state.financials.cash)}</b></span><span>Resultado <b>${this.money(this.state.financials.resultMonth)}</b></span></div>
      </header>
      <section class="month-bar"><div class="progress"><i style="width:${progress}%"></i></div><button data-run-month>Fechar mes</button></section>
      <nav class="sector-tabs">
        ${this.tab('logistics', 'Logistica')}${this.tab('commercial', 'Comercial')}${this.tab('finance', 'Financeiro')}
      </nav>
      <main class="sector-layout"><section class="sector-main">${this.departmentHtml()}</section><aside class="sector-side">${this.execHtml()}</aside></main>
      <footer class="idle-console">${this.state.lastMessage}</footer>
    `;
    this.bind();
  }

  private startHtml(): string {
    return `
      <main class="start-screen">
        <p class="eyebrow">Simulador empresarial idle</p>
        <h1>Escolha a empresa</h1>
        <p>Gerencie setores, estoque, formulas tipo Excel, comercial e DRE. O desafio e crescer sem quebrar.</p>
        <div class="choice-grid">
          <button data-company="doors_factory"><b>Fabrica de portas</b><span>Aluminio, vidro e ferragens.</span></button>
          <button data-company="sawmill"><b>Madereira</b><span>Madeira bruta, cola e verniz.</span></button>
        </div>
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
      <div class="section-title"><div><p class="eyebrow">Setor</p><h2>Logistica e estoque</h2></div><p>Use formulas tipo Excel para definir quando comprar e quanto comprar.</p></div>
      <div class="formula-help">Variaveis: <code>ESTOQUE</code>, <code>VAZAO</code>, <code>DEMANDA</code>, <code>CAIXA</code>, <code>CUSTO</code>, <code>MES</code>. Funcoes: <code>SE</code>, <code>MAX</code>, <code>MIN</code>, <code>SOMA</code>.</div>
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
      <div class="section-title"><div><p class="eyebrow">Setor</p><h2>Comercial</h2></div><p>Aumente faturamento sem vender mais do que a logistica consegue atender.</p></div>
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
    return `
      <div class="section-title"><div><p class="eyebrow">Setor</p><h2>Financeiro e DRE</h2></div><p>Resultado depois das decisoes de estoque e comercial.</p></div>
      <div class="dre-table">
        ${this.row('Receita', f.revenueMonth)}${this.row('Faturamento perdido', f.lostRevenueMonth)}${this.row('Compras', -f.purchasesMonth)}${this.row('Estoque parado', -f.stockHoldingCostMonth)}${this.row('Comercial', -f.commercialCostMonth)}${this.row('Fixo/Folha', -f.fixedCostMonth)}${this.row('Resultado', f.resultMonth)}
      </div>
      <div class="finance-grid"><article><span>Caixa</span><b>${this.money(f.cash)}</b></article><article><span>Margem</span><b>${margin.toFixed(1)}%</b></article><article><span>Receita total</span><b>${this.money(f.totalRevenue)}</b></article><article><span>Resultado total</span><b>${this.money(f.totalResult)}</b></article></div>
    `;
  }

  private row(label: string, value: number): string {
    return `<p><span>${label}</span><b class="${value >= 0 ? 'good' : 'bad'}">${this.money(value)}</b></p>`;
  }

  private execHtml(): string {
    const f = this.state.financials;
    const risk = f.cash < 0 ? 'QUEBROU' : f.cash < 8000 ? 'RISCO ALTO' : f.resultMonth < 0 ? 'ATENCAO' : 'SAUDAVEL';
    return `<h2>Painel executivo</h2><div class="exec-risk">${risk}</div><p>Caixa <b>${this.money(f.cash)}</b></p><p>Receita mes <b>${this.money(f.revenueMonth)}</b></p><p>Ruptura perdida <b>${this.money(f.lostRevenueMonth)}</b></p><p>Resultado <b>${this.money(f.resultMonth)}</b></p><button data-reset>Resetar</button>`;
  }

  private bind(): void {
    this.root.querySelectorAll<HTMLElement>('[data-company]').forEach((el) => el.onclick = () => { this.state = chooseCompany(el.dataset.company as CompanyKind); this.lastTick = performance.now(); this.render(); });
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => el.onclick = () => { this.state.selectedDepartment = el.dataset.tab as Department; saveBusiness(this.state); this.render(); });
    this.root.querySelectorAll<HTMLInputElement>('[data-reorder]').forEach((el) => el.onchange = () => { const m = this.state.materials.find((x) => x.key === el.dataset.reorder); if (m) m.reorderFormula = el.value; saveBusiness(this.state); this.render(); });
    this.root.querySelectorAll<HTMLInputElement>('[data-quantity]').forEach((el) => el.onchange = () => { const m = this.state.materials.find((x) => x.key === el.dataset.quantity); if (m) m.quantityFormula = el.value; saveBusiness(this.state); this.render(); });
    this.root.querySelectorAll<HTMLElement>('[data-strategy]').forEach((el) => el.onclick = () => { this.state.lastMessage = applyCommercialStrategy(this.state, el.dataset.strategy as CommercialStrategyKey); saveBusiness(this.state); this.render(); });
    this.root.querySelector<HTMLElement>('[data-run-month]')?.addEventListener('click', () => { const r = runMonth(this.state); this.state.lastMessage = `Mes fechado: ${r.fulfilledUnits}/${r.demandedUnits} pedidos atendidos. Resultado ${this.money(r.result)}.`; this.render(); });
    this.root.querySelector<HTMLElement>('[data-reset]')?.addEventListener('click', () => { this.state = resetBusiness(); this.render(); });
  }

  private previewVars(material: MaterialState): Record<string, number> {
    const vars: Record<string, number> = { ESTOQUE: material.stock, VAZAO: material.monthlyFlow, DEMANDA: this.state.commercial.baseDemand, CAIXA: this.state.financials.cash, CUSTO: material.unitCost, MES: this.state.month };
    for (const indicator of this.state.indicators) vars[indicator.name] = indicator.value;
    return vars;
  }

  private money(value: number): string { return `${value < 0 ? '-R$ ' : 'R$ '}${Math.abs(Math.round(value)).toLocaleString('pt-BR')}`; }
  private num(value: number): string { return Math.round(value).toLocaleString('pt-BR'); }
  private attr(value: string): string { return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}
