import { evaluateFormula } from './formulaEngine';
import { buyNextCompany, canHireManager, getCompanyPrice, getSelectedCompany, hireManager, loadPortfolio, money, resetPortfolio, savePortfolio, simulateManagedQuarter, simulatePlayerMonth } from './portfolioLogic';
import { PortfolioCompany, PortfolioMaterial, PortfolioState } from './portfolioTypes';

export class BusinessIdleApp {
  private state: PortfolioState = loadPortfolio();

  constructor(private readonly root: HTMLElement) {
    this.root.className = 'idle-root';
    this.render();
  }

  private render(): void {
    const selected = getSelectedCompany(this.state);
    this.root.innerHTML = `
      <header class="idle-topbar">
        <div><p class="eyebrow">Carteira de empresas</p><h1>Holding operacional</h1></div>
        <div class="top-metrics">
          <span>Capital <b>${money(this.state.founderCapital)}</b></span>
          <span>Empresas <b>${this.state.companies.length}</b></span>
          <span>Nivel liberado <b>${this.state.maxUnlockedLevel}</b></span>
          <span>Empresa ativa <b>${selected.name}</b></span>
        </div>
      </header>

      <main class="sector-layout portfolio-layout">
        <section class="sector-main">
          ${this.portfolioHtml()}
          ${selected.status === 'player' ? this.operatorHtml(selected) : this.managerHtml(selected)}
        </section>
        <aside class="sector-side">${this.executiveHtml(selected)}</aside>
      </main>
      <footer class="idle-console">${this.state.message}</footer>
    `;
    this.bind();
  }

  private portfolioHtml(): string {
    return `
      <div class="section-title">
        <div><p class="eyebrow">Tela 01</p><h2>Carteira de empresas</h2></div>
        <p>Comece com uma empresa nivel 1. Para abrir outra, primeiro contrate um manager na empresa atual.</p>
      </div>
      <div class="company-grid">
        ${this.state.companies.map((company) => this.companyCard(company)).join('')}
      </div>
    `;
  }

  private companyCard(company: PortfolioCompany): string {
    const active = company.id === this.state.selectedCompanyId;
    return `
      <button class="company-card ${active ? 'active' : ''}" data-company-id="${company.id}">
        <strong>${company.name}</strong>
        <span>${company.status === 'manager' ? 'Com manager' : 'Operada pelo jogador'}</span>
        <small>Faturamento medio: ${money(company.averageRevenue)}/mes</small>
        <small>Lucro mes: ${money(company.profitMonth)} | Margem ${(company.marginMonth * 100).toFixed(1)}%</small>
      </button>
    `;
  }

  private operatorHtml(company: PortfolioCompany): string {
    return `
      <section class="operator-panel">
        <div class="section-title">
          <div><p class="eyebrow">Operacao manual</p><h2>${company.name}</h2></div>
          <p>Antes de passar o mes, ajuste a politica de estoque. O manager so libera quando lucro mensal > salario e margem >= 7%.</p>
        </div>
        <div class="finance-grid">
          <article><span>Faturamento medio</span><b>${money(company.averageRevenue)}</b></article>
          <article><span>Salario manager</span><b>${money(company.managerSalary)}</b></article>
          <article><span>Lucro necessario</span><b>${money(company.managerSalary + 1)}</b></article>
          <article><span>Margem minima</span><b>7.0%</b></article>
        </div>
        <div class="material-grid">${company.materials.map((material, index) => this.materialHtml(material, index, company)).join('')}</div>
        <div class="strategy-grid exit-grid">
          <button data-run-month><b>Passar mes</b><span>Fecha o mes manualmente e gera DRE operacional.</span></button>
          <button data-hire-manager ${canHireManager(company) ? '' : 'disabled'}><b>Contratar manager</b><span>${canHireManager(company) ? 'Requisitos atingidos. Automatizar empresa.' : 'Exige lucro > salario do manager e margem >= 7%.'}</span></button>
        </div>
      </section>
    `;
  }

  private materialHtml(material: PortfolioMaterial, index: number, company: PortfolioCompany): string {
    const vars = this.vars(company, material);
    const shouldBuy = evaluateFormula(material.reorderFormula, vars);
    const qty = evaluateFormula(material.quantityFormula, vars);
    const coverage = material.monthlyFlow > 0 ? material.stock / material.monthlyFlow : 0;
    return `
      <article class="material-card">
        <header><h3>${material.name}</h3><span>${Math.round(material.stock).toLocaleString('pt-BR')} ${material.unit}</span></header>
        <p>Vazao media <b>${Math.round(material.monthlyFlow).toLocaleString('pt-BR')}/mes</b></p>
        <p>Cobertura <b>${coverage.toFixed(1)} meses</b></p>
        <p>Compra prevista <b>${shouldBuy.value > 0 ? Math.max(0, Math.round(qty.value)).toLocaleString('pt-BR') : '0'} ${material.unit}</b></p>
        <label>Formula comprar?</label><input data-reorder-index="${index}" value="${this.attr(material.reorderFormula)}" />
        <label>Formula quantidade</label><input data-qty-index="${index}" value="${this.attr(material.quantityFormula)}" />
        <small>${shouldBuy.error || qty.error || 'Formula ok'}</small>
      </article>
    `;
  }

  private managerHtml(company: PortfolioCompany): string {
    return `
      <section class="operator-panel">
        <div class="section-title">
          <div><p class="eyebrow">Operacao automatizada</p><h2>${company.name}</h2></div>
          <p>Esta empresa esta sob manager. Voce nao opera mais o mes a mes; recebe uma DRE trimestral e distribuicao de caixa.</p>
        </div>
        <div class="strategy-grid exit-grid">
          <button data-run-quarter><b>Receber DRE trimestral</b><span>O manager roda 3 meses de operacao e distribui parte do lucro ao fundador.</span></button>
          <button data-buy-next><b>Comprar empresa nivel ${this.state.maxUnlockedLevel}</b><span>Custo: ${money(getCompanyPrice(this.state.maxUnlockedLevel))}. So pode ter uma empresa sem manager por vez.</span></button>
        </div>
        <div class="dre-table">
          ${(company.reports.length ? company.reports : []).map((report) => `
            <p><span>Tri ${report.quarter} | Receita ${money(report.revenue)} | Lucro ${money(report.profit)}</span><b>${(report.margin * 100).toFixed(1)}%</b></p>
          `).join('') || '<p><span>Nenhuma DRE trimestral recebida ainda.</span><b>-</b></p>'}
        </div>
      </section>
    `;
  }

  private executiveHtml(company: PortfolioCompany): string {
    const managerReady = canHireManager(company);
    return `
      <h2>Painel executivo</h2>
      <div class="exec-risk">${company.status === 'manager' ? 'AUTOMATIZADA' : managerReady ? 'MANAGER DISPONIVEL' : 'OPERACAO MANUAL'}</div>
      <p>Objetivo atual <b>${company.status === 'manager' ? 'Comprar nova empresa' : 'Contratar manager'}</b></p>
      <p>Faturamento medio <b>${money(company.averageRevenue)}</b></p>
      <p>Lucro mensal <b>${money(company.profitMonth)}</b></p>
      <p>Margem <b>${(company.marginMonth * 100).toFixed(1)}%</b></p>
      <p>Salario manager <b>${money(company.managerSalary)}</b></p>
      <p>Capital fundador <b>${money(this.state.founderCapital)}</b></p>
      <p>Proxima empresa <b>${money(getCompanyPrice(this.state.maxUnlockedLevel))}</b></p>
      <button data-reset>Resetar carteira</button>
    `;
  }

  private bind(): void {
    this.root.querySelectorAll<HTMLElement>('[data-company-id]').forEach((el) => {
      el.onclick = () => {
        this.state.selectedCompanyId = el.dataset.companyId ?? this.state.selectedCompanyId;
        savePortfolio(this.state);
        this.render();
      };
    });

    this.root.querySelector<HTMLElement>('[data-run-month]')?.addEventListener('click', () => {
      const company = getSelectedCompany(this.state);
      simulatePlayerMonth(company);
      this.state.message = `${company.name}: mes fechado. Lucro ${money(company.profitMonth)} | margem ${(company.marginMonth * 100).toFixed(1)}%.`;
      savePortfolio(this.state);
      this.render();
    });

    this.root.querySelector<HTMLElement>('[data-hire-manager]')?.addEventListener('click', () => {
      hireManager(this.state, getSelectedCompany(this.state));
      savePortfolio(this.state);
      this.render();
    });

    this.root.querySelector<HTMLElement>('[data-run-quarter]')?.addEventListener('click', () => {
      simulateManagedQuarter(this.state);
      savePortfolio(this.state);
      this.render();
    });

    this.root.querySelector<HTMLElement>('[data-buy-next]')?.addEventListener('click', () => {
      buyNextCompany(this.state);
      savePortfolio(this.state);
      this.render();
    });

    this.root.querySelectorAll<HTMLInputElement>('[data-reorder-index]').forEach((input) => {
      input.onchange = () => {
        const company = getSelectedCompany(this.state);
        const material = company.materials[Number(input.dataset.reorderIndex)];
        if (material) material.reorderFormula = input.value;
        savePortfolio(this.state);
        this.render();
      };
    });

    this.root.querySelectorAll<HTMLInputElement>('[data-qty-index]').forEach((input) => {
      input.onchange = () => {
        const company = getSelectedCompany(this.state);
        const material = company.materials[Number(input.dataset.qtyIndex)];
        if (material) material.quantityFormula = input.value;
        savePortfolio(this.state);
        this.render();
      };
    });

    this.root.querySelector<HTMLElement>('[data-reset]')?.addEventListener('click', () => {
      this.state = resetPortfolio();
      this.render();
    });
  }

  private vars(company: PortfolioCompany, material: PortfolioMaterial): Record<string, number> {
    return {
      ESTOQUE: material.stock,
      VAZAO: material.monthlyFlow,
      FATURAMENTO: company.averageRevenue,
      CAIXA: company.cash,
      CUSTO: material.unitCost,
      MES: company.month,
      NIVEL: company.level,
      MARGEM: company.marginMonth
    };
  }

  private attr(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
