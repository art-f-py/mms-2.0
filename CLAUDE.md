# MMS 2.0 — instruções para o Claude Code

Ferramenta web (React + Vite) de seleção de métodos de lavra subterrânea: UBC 1995,
Nicholas 1981/1992 e SH&B 2007, mais decisão multicritério (TOPSIS, Enfoque, Entropy).
Como o projeto usa IA: `docs/USO-DE-IA.md`. Testes, lint, build e lacunas: `docs/TESTES.md`.

## Travas

- Confirmar a branch antes de qualquer commit.
- Nunca force push. Nunca merge em `main` sem aprovação explícita.
- `npm test`, `npm run lint` e `npm run build` passando antes de qualquer commit.
- Parar e reportar em qualquer ambiguidade, ou quando uma premissa do pedido não bater com o
  código. Não decidir no lugar do autor.
- Não tocar em nada fora do escopo pedido.

## Dados e metodologia

- Nenhum valor numérico, direção de critério ou regra de conversão entra sem fonte primária
  (publicação) ou confirmação explícita de um colaborador. Nunca estimar ou completar por
  conta própria.
- Valor ainda não confirmado vai para `PENDING_CONFIRMATION`
  (`src/algorithms/mcdmCriteria.js`), nunca entra em silêncio.
- Tabelas de conversão, critérios fixos e exceções do SH&B são do Francisco Vargas.
  Mudança nelas é decisão dele.

## Validação experimental

`src/validation/` e `docs/validacao-mcdm/` existem só na branch
`experimental/validacao-mcdm`. Nunca entram em `main` nem no release. Se aparecerem no disco
noutra branch, estão sem rastreamento: não adicionar ao commit. Como o Vitest inclui qualquer
`src/**/__tests__/**/*.test.js`, a contagem de referência da suíte é a de uma cópia limpa, sem
essa pasta.

## Convenções

- **Testes:** em `__tests__/`, ao lado do módulo, com o mesmo nome (`topsis.js` →
  `__tests__/topsis.test.js`). São escritos em português, e o arquivo abre com um cabeçalho
  explicando a garantia que fixa e por quê. O ambiente é `node`, sem Testing Library: lógica
  de tela vai para função pura em `src/utils/` para poder ser testada.
- **i18n:** `pt-BR` é a referência. Chave nova entra nos 4 locales (`pt-BR`, `en`, `es`,
  `fr`); onde não houver tradução revisada, usar o texto em português como placeholder. O
  teste `src/i18n/__tests__/locales.test.js` exige paridade de chaves.
- **Relatórios:** texto direto e curto, sem tabela ASCII. Dizer o que foi feito, o que foi
  verificado (com números) e o que ficou em aberto.
