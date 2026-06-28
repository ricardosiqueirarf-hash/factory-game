import { UPGRADES, applyUpgrade, assignManager, buyCompany, getHoldingValue, getMonthlyProfit, getTotalDebt, hireManager, loadHolding, money, passMonth, resetHolding, saveHolding, sellCompany } from './holdingLogic';
import { Company, HoldingState, HoldingTab, Manager } from './holdingTypes';

export class BusinessIdleApp {
  private state: HoldingState = loadHolding();

  constructor(private readonly root: HTMLElement) {
    this.root.className = 'idle-root';
    this.render();
  }

  private render(): void {
    this.root.innerHTML = `
      <header class="idle-topbar">
        <div>
          <p class="eyebrow">Factory Holding Tycoon</p>
          <h1>Holding empresarial</h1>
        </div>
        <div class="top-metrics">
          <span>Capital <b>${money(this.state.capital)}</b></span>
          <span>Lucro mensal <b class="${getMonthlyProfit(this.state) >= 0 ? 'good' : 'bad'}">${money(getMonthlyProfit(this.state))}</b></span>
          <span>Valor da holding <b>${money(getHoldingValue(this.state))}</b></span>
          <span>Reputação <b>Nv. ${this.state.reputation}</b></span>
        </div>
      </header>
      <section class="month-bar">
        <div><b>Mês ${this.state.month}</b><span> Passe o mês para receber lucro, pagar managers, recalcular valuation e gerar eventos.</span></div>
        <button data-pass-month>Passar mês</button>
      </section>
      <nav class="sector-tabs">
        ${this.tab('dashboard', 'Dashboard')}
        ${this.tab('market', 'Mercado de Empresas')}
        ${this.tab('portfolio', 'Meu Portfólio')}
        ${this.tab('managers', 'Managers')}
        ${this.tab('events', 'Eventos/Histórico')}
      </nav>
      <main class="sector-layout">
        <section class="sector-main">${this.content()}</section>
        <aside class="sector-side">${this.sidePanel()}</aside>
      </main>
    `;
    this.bind();
  }

  private tab(tab: HoldingTab, label: string): string {
    return `<button class="${this.state.activeTab === tab ? 'active' : ''}" data-tab="${tab}">${label}</button>`;
  }

  private content(): string {
    if (this.state.activeTab === 'market') return this.marketHtml();
    if (this.state.activeTab === 'portfolio') return this.portfolioHtml();
    if (this.state.activeTab === 'managers') return this.managersHtml();
    if (this.state.activeTab === 'events') return this.eventsHtml();
    return this.dashboardHtml();
  }

  private dashboardHtml(): string {
    const activeManagers = this.state.managers.filter((manager) => manager.assignedCompanyId).length;
    return `
      <div class="section-title">
        <div><p class="eyebrow">Visão geral</p><h2>Dashboard da holding</h2></div>
        <p>Compre empresas problemáticas, aplique melhorias, contrate managers e venda empresas valorizadas.</p>
      </div>
      <div class="finance-grid">
        <article><span>Capital disponível</span><b>${money(this.state.capital)}</b></article>
        <article><span>Lucro mensal/passivo</span><b class="${getMonthlyProfit(this.state) >= 0 ? 'good' : 'bad'}">${money(getMonthlyProfit(this.state))}</b></article>
        <article><span>Valor total da holding</span><b>${money(getHoldingValue(this.state))}</b></article>
        <article><span>Dívida total</span><b class="bad">${money(getTotalDebt(this.state))}</b></article>
        <article><span>Empresas ativas</span><b>${this.state.portfolio.length}</b></article>
        <article><span>Managers ativos</span><b>${activeManagers}</b></article>
      </div>
      <div class="dre-table">
        ${this.state.history.slice(0, 5).map((event) => this.eventRow(event.title, event.description, event.impact)).join('') || '<p><span>Nenhum evento ainda.</span><b>-</b></p>'}
      </div>
    `;
  }

  private marketHtml(): string {
    return `
      <div class="section-title">
        <div><p class="eyebrow">Aquisição</p><h2>Mercado de empresas</h2></div>
        <p>Procure empresas baratas, com potencial alto ou valuation descontado. Oportunidades raras aparecem com destaque.</p>
      </div>
      <div class="company-grid">${this.state.market.map((company) => this.companyCard(company, 'market')).join('')}</div>
    `;
  }

  private portfolioHtml(): string {
    if (this.state.portfolio.length === 0) {
      return '<div class="section-title"><div><p class="eyebrow">Portfólio</p><h2>Nenhuma empresa comprada</h2></div><p>Vá ao mercado e compre sua primeira empresa.</p></div>';
    }
    return `
      <div class="section-title">
        <div><p class="eyebrow">Operação</p><h2>Meu portfólio</h2></div>
        <p>Aplique upgrades para recuperar empresas, melhorar margem e aumentar valuation antes de vender.</p>
      </div>
      <div class="company-grid owned-grid">${this.state.portfolio.map((company) => this.companyCard(company, 'owned')).join('')}</div>
    `;
  }

  private companyCard(company: Company, mode: 'market' | 'owned'): string {
    const margin = company.monthlyRevenue > 0 ? company.monthlyProfit / company.monthlyRevenue : 0;
    const manager = company.managerId ? this.state.managers.find((item) => item.id === company.managerId) : null;
    return `
      <article class="company-card ${company.rareOpportunity ? 'rare' : ''}">
        <header>
          <div>
            <p class="eyebrow">${company.sector}${company.rareOpportunity ? ' · Oportunidade rara' : ''}</p>
            <h3>${company.name}</h3>
          </div>
          <strong class="${company.monthlyProfit >= 0 ? 'good' : 'bad'}">${money(company.monthlyProfit)}/mês</strong>
        </header>
        <div class="mini-metrics">
          <p>Receita <b>${money(company.monthlyRevenue)}</b></p>
          <p>Custo <b>${money(company.monthlyCost)}</b></p>
          <p>Margem <b>${(margin * 100).toFixed(1)}%</b></p>
          <p>Eficiência <b>${company.efficiency}</b></p>
          <p>Qualidade <b>${company.quality}</b></p>
          <p>Demanda <b>${company.demand}</b></p>
          <p>Risco <b>${company.risk}</b></p>
          <p>Dívida <b>${money(company.debt)}</b></p>
          <p>Potencial <b>${company.potential}</b></p>
          <p>Valuation <b>${money(company.estimatedValue)}</b></p>
          <p>Múltiplo <b>${company.valuationMultiple}x</b></p>
          ${manager ? `<p>Manager <b>${manager.name}</b></p>` : ''}
        </div>
        ${mode === 'market' ? `<button data-buy="${company.id}">Comprar por ${money(company.purchasePrice)}</button>` : this.ownedActions(company)}
      </article>
    `;
  }

  private ownedActions(company: Company): string {
    return `
      <div class="card-actions">
        <button data-sell="${company.id}">Vender por ${money(company.estimatedValue)}</button>
      </div>
      <div class="upgrade-list">
        <h4>Melhorias</h4>
        ${UPGRADES.map((upgrade) => {
          const applied = company.upgradesApplied.includes(upgrade.id);
          const disabled = applied || this.state.capital < upgrade.cost;
          return `<button ${disabled ? 'disabled' : ''} data-upgrade-company="${company.id}" data-upgrade="${upgrade.id}"><b>${applied ? '✓ ' : ''}${upgrade.name}</b><span>${upgrade.description} · ${money(upgrade.cost)}</span></button>`;
        }).join('')}
      </div>
    `;
  }

  private managersHtml(): string {
    return `
      <div class="section-title">
        <div><p class="eyebrow">Equipe executiva</p><h2>Managers</h2></div>
        <p>Contrate e atribua managers. Cada manager só pode liderar uma empresa por vez.</p>
      </div>
      <div class="company-grid">${this.state.managers.map((manager) => this.managerCard(manager)).join('')}</div>
    `;
  }

  private managerCard(manager: Manager): string {
    const assigned = manager.assignedCompanyId ? this.state.portfolio.find((company) => company.id === manager.assignedCompanyId) : null;
    const signingCost = manager.salaryMonthly * 2;
    return `
      <article class="company-card manager-card">
        <header><div><p class="eyebrow">${manager.type} · ${manager.rarity}</p><h3>${manager.name}</h3></div><strong>${money(manager.salaryMonthly)}/mês</strong></header>
        <p>${manager.description}</p>
        <div class="mini-metrics">
          <p>Status <b>${manager.hired ? 'Contratado' : 'Disponível'}</b></p>
          <p>Atribuído <b>${assigned ? assigned.name : '-'}</b></p>
          <p>Custo inicial <b>${money(signingCost)}</b></p>
        </div>
        ${manager.hired ? this.assignButtons(manager) : `<button data-hire-manager="${manager.id}" ${this.state.capital < signingCost ? 'disabled' : ''}>Contratar manager</button>`}
      </article>
    `;
  }

  private assignButtons(manager: Manager): string {
    if (this.state.portfolio.length === 0) return '<p>Compre uma empresa para atribuir este manager.</p>';
    return `<div class="upgrade-list"><h4>Atribuir</h4>${this.state.portfolio.map((company) => `<button data-assign-manager="${manager.id}" data-assign-company="${company.id}" ${manager.assignedCompanyId && manager.assignedCompanyId !== company.id ? 'disabled' : ''}>${company.name}</button>`).join('')}</div>`;
  }

  private eventsHtml(): string {
    return `
      <div class="section-title"><div><p class="eyebrow">Histórico</p><h2>Eventos e decisões</h2></div><p>Registro de compras, vendas, eventos de mercado, upgrades e resultados mensais.</p></div>
      <div class="dre-table history-list">${this.state.history.map((event) => this.eventRow(event.title, event.description, event.impact)).join('')}</div>
    `;
  }

  private eventRow(title: string, description: string, impact: 'good' | 'bad' | 'neutral'): string {
    const icon = impact === 'good' ? '▲' : impact === 'bad' ? '▼' : '•';
    return `<p><span><b class="${impact}">${icon} ${title}</b><small>${description}</small></span></p>`;
  }

  private sidePanel(): string {
    return `
      <h2>Painel executivo</h2>
      <div class="exec-risk">MÊS ${this.state.month}</div>
      <p>Capital <b>${money(this.state.capital)}</b></p>
      <p>Lucro mensal <b class="${getMonthlyProfit(this.state) >= 0 ? 'good' : 'bad'}">${money(getMonthlyProfit(this.state))}</b></p>
      <p>Holding <b>${money(getHoldingValue(this.state))}</b></p>
      <p>Dívida <b class="bad">${money(getTotalDebt(this.state))}</b></p>
      <p>Empresas <b>${this.state.portfolio.length}</b></p>
      <p>Managers contratados <b>${this.state.managers.filter((manager) => manager.hired).length}</b></p>
      <hr />
      <button data-pass-month>Passar mês</button>
      <button data-reset>Resetar jogo</button>
    `;
  }

  private bind(): void {
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((button) => {
      button.onclick = () => {
        this.state.activeTab = button.dataset.tab as HoldingTab;
        saveHolding(this.state);
        this.render();
      };
    });

    this.root.querySelectorAll<HTMLElement>('[data-pass-month]').forEach((button) => {
      button.onclick = () => {
        passMonth(this.state);
        this.render();
      };
    });

    this.root.querySelectorAll<HTMLElement>('[data-buy]').forEach((button) => {
      button.onclick = () => {
        buyCompany(this.state, button.dataset.buy ?? '');
        this.render();
      };
    });

    this.root.querySelectorAll<HTMLElement>('[data-sell]').forEach((button) => {
      button.onclick = () => {
        sellCompany(this.state, button.dataset.sell ?? '');
        this.render();
      };
    });

    this.root.querySelectorAll<HTMLElement>('[data-upgrade-company]').forEach((button) => {
      button.onclick = () => {
        applyUpgrade(this.state, button.dataset.upgradeCompany ?? '', button.dataset.upgrade ?? '');
        this.render();
      };
    });

    this.root.querySelectorAll<HTMLElement>('[data-hire-manager]').forEach((button) => {
      button.onclick = () => {
        hireManager(this.state, button.dataset.hireManager ?? '');
        this.render();
      };
    });

    this.root.querySelectorAll<HTMLElement>('[data-assign-manager]').forEach((button) => {
      button.onclick = () => {
        assignManager(this.state, button.dataset.assignManager ?? '', button.dataset.assignCompany ?? '');
        this.render();
      };
    });

    this.root.querySelector<HTMLElement>('[data-reset]')?.addEventListener('click', () => {
      this.state = resetHolding();
      this.render();
    });
  }
}
