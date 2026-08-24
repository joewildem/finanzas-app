// Evaluador de expresiones aritméticas para la calculadora del monto (modal de transacciones).
// Puerto de la lógica original (ver spec del usuario, sección 4.1 y 6) pero sin `eval()` — tokeniza
// y evalúa la expresión a mano, respetando precedencia de operadores (* / antes de + -).

export type CalcOperator = '+' | '-' | '*' | '/'

const OPERATORS = new Set<CalcOperator>(['+', '-', '*', '/'])

function isOperator(char: string): char is CalcOperator {
  return OPERATORS.has(char as CalcOperator)
}

// "número + número%" → porcentaje sobre el primer operando (como en calculadoras físicas), ej.
// "200+10%" → 200 + (200*10/100) = 220. Cualquier "%" restante (sin operador antes) se trata como
// /100 sobre ese número suelto.
function expandPercentages(expression: string): string {
  const withOperatorPercent = expression.replace(
    /(\d+(?:\.\d+)?)([+-])(\d+(?:\.\d+)?)%/g,
    (_match, base: string, op: string, pct: string) => {
      const baseValue = parseFloat(base)
      const pctValue = parseFloat(pct)
      return `${base}${op}(${baseValue}*${pctValue}/100)`
    },
  )
  return withOperatorPercent.replace(/(\d+(?:\.\d+)?)%/g, (_match, num: string) => `(${num}/100)`)
}

type Token = { type: 'num'; value: number } | { type: 'op'; value: CalcOperator } | { type: 'paren'; value: '(' | ')' }

function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expression.length) {
    const char = expression[i]
    if (char === ' ') {
      i++
      continue
    }
    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char })
      i++
      continue
    }
    // Signo negativo unario: al inicio, después de '(' o después de otro operador.
    const prev = tokens[tokens.length - 1]
    const isUnaryPosition = !prev || prev.type === 'op' || (prev.type === 'paren' && prev.value === '(')
    if (char === '-' && isUnaryPosition) {
      let j = i + 1
      let numStr = '-'
      while (j < expression.length && /[0-9.]/.test(expression[j])) {
        numStr += expression[j]
        j++
      }
      if (numStr === '-') throw new Error('invalid expression')
      tokens.push({ type: 'num', value: parseFloat(numStr) })
      i = j
      continue
    }
    if (isOperator(char)) {
      tokens.push({ type: 'op', value: char })
      i++
      continue
    }
    if (/[0-9.]/.test(char)) {
      let j = i
      let numStr = ''
      while (j < expression.length && /[0-9.]/.test(expression[j])) {
        numStr += expression[j]
        j++
      }
      tokens.push({ type: 'num', value: parseFloat(numStr) })
      i = j
      continue
    }
    throw new Error(`unexpected character: ${char}`)
  }
  return tokens
}

function evaluateTokens(tokens: Token[]): number {
  // Primera pasada: resuelve paréntesis (recursivo sobre el subrango).
  const withoutParens: Token[] = []
  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    if (token.type === 'paren' && token.value === '(') {
      let depth = 1
      let j = i + 1
      while (j < tokens.length && depth > 0) {
        const t = tokens[j]
        if (t.type === 'paren' && t.value === '(') depth++
        if (t.type === 'paren' && t.value === ')') depth--
        j++
      }
      const inner = tokens.slice(i + 1, j - 1)
      withoutParens.push({ type: 'num', value: evaluateTokens(inner) })
      i = j
      continue
    }
    withoutParens.push(token)
    i++
  }

  // Segunda pasada: * y /.
  const afterMulDiv: Token[] = []
  i = 0
  while (i < withoutParens.length) {
    const token = withoutParens[i]
    if (token.type === 'op' && (token.value === '*' || token.value === '/')) {
      const left = afterMulDiv.pop()
      const right = withoutParens[i + 1]
      if (left?.type !== 'num' || right?.type !== 'num') throw new Error('invalid expression')
      const result = token.value === '*' ? left.value * right.value : left.value / right.value
      afterMulDiv.push({ type: 'num', value: result })
      i += 2
      continue
    }
    afterMulDiv.push(token)
    i++
  }

  // Tercera pasada: + y -, izquierda a derecha.
  let result = 0
  if (afterMulDiv[0]?.type === 'num') result = afterMulDiv[0].value
  for (let k = 1; k < afterMulDiv.length; k += 2) {
    const op = afterMulDiv[k]
    const num = afterMulDiv[k + 1]
    if (op?.type !== 'op' || num?.type !== 'num') throw new Error('invalid expression')
    result = op.value === '+' ? result + num.value : result - num.value
  }
  return result
}

// Evalúa una expresión como "120+10%" o "200*3-50". Retorna `null` si la expresión es inválida o
// el resultado no es un número finito (ej. división entre cero), para que el caller decida cómo
// mostrar el error sin lanzar hacia arriba.
export function evaluateCalculatorExpression(expression: string): number | null {
  const trimmed = expression.trim()
  if (trimmed === '' || trimmed === '-') return 0
  try {
    const expanded = expandPercentages(trimmed)
    const tokens = tokenize(expanded)
    const result = evaluateTokens(tokens)
    if (!Number.isFinite(result)) return null
    return Math.round(result * 100) / 100
  } catch {
    return null
  }
}

export function formatCalcNumber(numStr: string): string {
  if (!numStr) return ''
  const negative = numStr.startsWith('-')
  const body = negative ? numStr.slice(1) : numStr
  const [intPart, decPart] = body.split('.')
  const withCommas = (intPart ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (negative ? '-' : '') + withCommas + (decPart !== undefined ? '.' + decPart : '')
}

// Formatea la expresión completa con separadores de miles en cada operando, para el preview de la
// calculadora — ej. "1200+300" → "1,200 + 300".
export function formatCalcExpression(expression: string): string {
  const parts = expression.split(/([+\-*/%])/)
  return parts
    .map((part) => (isOperator(part) || part === '%' ? ` ${part} ` : formatCalcNumber(part)))
    .join('')
}
