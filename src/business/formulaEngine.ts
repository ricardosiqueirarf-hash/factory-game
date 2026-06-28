const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  IF: (cond, yes, no) => (cond ? yes : no),
  SE: (cond, yes, no) => (cond ? yes : no),
  MIN: (...args) => Math.min(...args),
  MAX: (...args) => Math.max(...args),
  SUM: (...args) => args.reduce((total, value) => total + value, 0),
  SOMA: (...args) => args.reduce((total, value) => total + value, 0),
  ABS: (value) => Math.abs(value),
  ROUND: (value) => Math.round(value),
  ARRED: (value) => Math.round(value),
  FLOOR: (value) => Math.floor(value),
  INT: (value) => Math.floor(value),
  CEILING: (value) => Math.ceil(value),
  TETO: (value) => Math.ceil(value)
};

export type FormulaVariables = Record<string, number>;

export type FormulaResult = {
  value: number;
  error?: string;
};

export function evaluateFormula(formula: string, variables: FormulaVariables): FormulaResult {
  try {
    const trimmed = formula.trim().replace(/^=/, '');
    if (!trimmed) return { value: 0, error: 'Formula vazia' };

    let expression = trimmed.toUpperCase();
    expression = expression.replace(/;/g, ',');

    const allowed = /^[0-9A-Z_+\-*/()., <>=!&|]+$/;
    if (!allowed.test(expression)) {
      return { value: 0, error: 'Use apenas numeros, variaveis, operadores e funcoes permitidas' };
    }

    expression = expression.replace(/<>/g, '!=').replace(/(?<![<>=!])=(?!=)/g, '==');

    const names = Object.keys(variables).sort((a, b) => b.length - a.length);
    for (const name of names) {
      const safeName = name.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expression = expression.replace(new RegExp(`\\b${safeName}\\b`, 'g'), `vars.${name.toUpperCase()}`);
    }

    for (const fn of Object.keys(FUNCTIONS)) {
      expression = expression.replace(new RegExp(`\\b${fn}\\s*\\(`, 'g'), `fns.${fn}(`);
    }

    if (/\b[A-Z_]{2,}\b/.test(expression.replace(/vars\.[A-Z_]+/g, '').replace(/fns\.[A-Z_]+/g, ''))) {
      return { value: 0, error: 'Variavel ou funcao desconhecida' };
    }

    const normalizedVariables: FormulaVariables = {};
    for (const [key, value] of Object.entries(variables)) {
      normalizedVariables[key.toUpperCase()] = Number(value) || 0;
    }

    const result = Function('vars', 'fns', `return Number(${expression});`)(normalizedVariables, FUNCTIONS);
    if (!Number.isFinite(result)) return { value: 0, error: 'Resultado invalido' };
    return { value: result };
  } catch {
    return { value: 0, error: 'Erro na formula' };
  }
}
