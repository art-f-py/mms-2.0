# Testes, lint e build

Este documento descreve as verificações automatizadas que existem hoje no MMS 2.0 — o que
cada uma cobre, como rodar, e o que **não** é coberto. Os números abaixo referem-se ao
estado do repositório no commit `2a222b9` (branch `main`).

## Como rodar

```bash
npm install          # uma vez
npm test             # vitest run — a suíte inteira, uma passada
npm run test:watch   # vitest em modo observação
npm run lint         # eslint .
npm run build        # vite build → dist/
```

Para rodar um arquivo ou uma pasta: `npx vitest run src/algorithms/__tests__/topsis.test.js`.

Lint e testes rodam automaticamente só no deploy de `main` (ver [Automação](#automação)).
Em qualquer outra branch, rodar os três antes de propor uma alteração é responsabilidade de
quem altera.

## A suíte (Vitest)

### Configuração

A configuração está em `vite.config.js`, bloco `test`:

- `environment: 'node'` — nenhum teste monta DOM nem renderiza componente;
- `include: ['src/**/__tests__/**/*.test.js']` — todo arquivo `*.test.js` dentro de uma
  pasta `__tests__/`, em qualquer ponto de `src/`, entra na suíte.

Consequência do padrão de `include`: qualquer pasta nova com `__tests__/` passa a rodar
automaticamente, inclusive pastas que não estão versionadas mas existem na cópia local.
Uma contagem diferente da listada aqui numa máquina de desenvolvimento geralmente vem daí.

### Organização

Cada pasta de `src/` com lógica testável tem uma subpasta `__tests__/` ao lado do código, e
cada arquivo de teste leva o nome do módulo que cobre (`topsis.js` →
`__tests__/topsis.test.js`). Os testes são escritos em português, e quase todo arquivo abre
com um comentário explicando **o contrato** que ele fixa e por quê.

Totais: **43 arquivos, 1122 testes**, todos passando.

| Pasta | Arquivos | Testes |
| --- | --- | --- |
| `src/algorithms/__tests__/` | 20 | 590 |
| `src/utils/__tests__/` | 11 | 215 |
| `src/context/__tests__/` | 5 | 132 |
| `src/data/__tests__/` | 1 | 83 |
| `src/components/__tests__/` | 5 | 61 |
| `src/i18n/__tests__/` | 1 | 41 |

### O que cada grupo cobre

**Métodos clássicos (UBC 1995, Nicholas 1981/1992, SH&B 2007)** — `src/algorithms/__tests__/`

- `classification.test.js` — funções de classificação (RSS, profundidade, mergulho) nas
  fronteiras exatas de cada faixa, por método.
- `weight-tables.test.js` — integridade estrutural das tabelas de pesos dos três métodos e
  alinhamento entre as classes que as funções produzem, as opções do formulário e as chaves
  das tabelas (uma classe sem chave correspondente pontuaria zero em silêncio).
- `weights.test.js` — pesos por critério da etapa complementar: neutro (1,00) equivale a não
  passar peso, 0,00 zera o critério, multiplicadores de domínio do Nicholas, chaves do
  breakdown por domínio.
- `rss-fallback.test.js` — de onde cada método tira a classe de RSS (o campo manual só vale
  para o Nicholas).
- `normalize.test.js` — normalização 0–100 usada no radar da tela de resultados.
- `scenarios.test.js` — o cenário de referência do carvão (seção própria abaixo).

**Decisão multicritério (MCDM)** — `src/algorithms/__tests__/`

- `topsis.test.js` e `entropyWeights.test.js` — o motor TOPSIS e a ponderação por entropia
  de Shannon: fórmula contra exemplo calculado à mão, invariância de escala, direção dos
  critérios, casos degenerados, e **paridade com o motor de referência** (caso portado do R
  original, com os valores esperados transcritos do outro motor, não recalculados).
- `saatyScale.test.js`, `ubcScale.test.js`, `shbScale.test.js` — conversão dos scores
  clássicos para a escala de Saaty, valor a valor contra as tabelas fornecidas, incluindo as
  exceções documentadas do SH&B.
- `mcdmCriteria.test.js` — os seis critérios fixos (direção, transcrição dos valores, e a
  pendência registrada em `PENDING_CONFIRMATION`).
- `decisionMatrix.test.js` — montagem da matriz de decisão e exportação (offset do Pro D.M.).
- `mcdmPipeline.test.js`, `mcdmPipelineUbc.test.js`, `mcdmPipelineShb.test.js` — o pipeline
  completo por método de seleção, da matriz de decisão ao ranking TOPSIS, com regressão
  cruzada (a liberação do UBC e do SH&B não alterou o resultado dos métodos anteriores).
- `enfoque.test.js`, `enfoqueRebalance.test.js`, `equalizeOtherGroups.test.js`,
  `classicCriteriaShb.test.js` — pesos por grupo (Enfoque), as duas políticas de
  rebalanceamento e a atribuição de cada critério ao seu grupo.

**Estado da aplicação (reducer)** — `src/context/__tests__/`

Testam o reducer de `MmsContext.jsx` como função pura: pesos do MCDM, modo Enfoque ×
Entropy, política de rebalanceamento, cenários salvos, migração de estado persistido de
versões anteriores, e o "retrato neutro" congelado junto com o resultado.

**Regras de formulário** — `src/data/__tests__/formRules.test.js`

Campos que dependem dos métodos selecionados, limpeza de estado órfão, sanitização do estado
persistido e completude de cada etapa.

**Tradução** — `src/i18n/__tests__/locales.test.js`

Paridade de chaves entre os quatro idiomas (`pt-BR` é a referência): todo idioma precisa ter
exatamente as mesmas chaves. Verifica presença, não qualidade da tradução — um texto ainda em
português num locale estrangeiro passa.

**Utilitários da tela** — `src/utils/__tests__/`

Lógica extraída dos componentes para poder ser testada em Node: montagem do ranking MCDM a
partir do formulário, marcadores de eliminação e de piso de escala, comparação de cenários,
layout das colunas da matriz, rótulos de método, cor por colocação, parser do campo de peso,
exportação da matriz.

**Componentes (leitura de fonte)** — `src/components/__tests__/`

Ver [Lacunas](#lacunas-conhecidas): estes arquivos leem o código-fonte dos componentes em vez
de renderizá-los.

### O cenário de referência do carvão

`src/algorithms/__tests__/scenarios.test.js` — 21 testes.

**O que é.** Um cenário de depósito fixo passado ao cálculo do SH&B, com os scores esperados
dos 10 métodos de lavra e o ranking escritos no teste. O comentário do arquivo o descreve como
"validado manualmente contra o MMS 1.0": os valores esperados são os que o MMS 1.0 produzia
para o mesmo cenário, e qualquer divergência é tratada como regressão no núcleo de cálculo.

**Entradas.** Forma tabular, espessura intermediária, mergulho de 8° (→ plano), teor uniforme,
profundidade de 900 m (→ profunda), valor do minério baixo, RMR pobre (minério) / razoável
(capa e lapa), todos os pesos neutros. Para o RSS, o teste usa valores físicos de uma camada de
carvão (minério 25 MPa / 1400 kg/m³, capa de folhelho 40 MPa / 2400 kg/m³, lapa de arenito
50 MPa / 2500 kg/m³), que dão RSS entre 1,9 e 2,3 → "Muito fraca" nos três domínios.

**De onde vieram os dados.** A combinação categórica (as classes) é a do cenário usado na
comparação com o MMS 1.0. Os números de UCS e densidade foram **escolhidos** depois
(commit `d100ab9`) para cair na mesma classe de RSS que o MMS 1.0 usava, quando o cálculo
deixou de aceitar a classe digitada à mão no SH&B. Não é um caso real publicado. O repositório
não registra de onde veio o cenário categórico original.

**Resultado fixado.** LW 23,42 · C&F 22,19 · SQS 20,17 · TS 17,10 · SLC 13,69 · BC 12,96 ·
SLS 10,21 · R&P −1,22 · OP −21,36 · SKS −35,44 (tolerância de 0,01), nesta ordem de ranking.
Além disso: as 12 classificações entram no breakdown, a soma do breakdown reproduz cada score,
pesos neutros explícitos equivalem a não passar pesos, e um RSS manual preenchido não altera o
SH&B.

**Que tipo de teste é.** Integração sobre funções puras, não ponta a ponta: chama
`calculateSHB` diretamente, sem formulário, reducer ou tela. Cobre classificação + tabelas de
peso + soma, só para o SH&B. Não há cenário equivalente fixado para o UBC ou o Nicholas, nem
cenário de referência do MCDM contra um resultado externo além da paridade TOPSIS/entropia.

## Lint (ESLint 9)

Configuração em `eslint.config.js` (formato flat), aplicada a todo `**/*.{js,jsx}` exceto
`dist/`:

- `@eslint/js` — regras recomendadas;
- `eslint-plugin-react-hooks` — regras dos hooks do React;
- `eslint-plugin-react-refresh` — restrições de exportação para o hot reload do Vite;
- `no-unused-vars` como erro, ignorando nomes que começam com maiúscula ou `_`.

Não há Prettier nem verificação de tipos (o projeto é JavaScript, sem TypeScript).

## Build (Vite 8)

`npm run build` gera `dist/` com `@vitejs/plugin-react`. O `base` em `vite.config.js` é
`/v3.1/tools/mms_2.0/`, o caminho de publicação no Mafmine. O build confirma que o código
compila e que os imports se resolvem; não executa testes.

## Automação

O único workflow do repositório é `.github/workflows/deploy-mafmine.yaml`. Ele roda a cada push
em `main` (ou manualmente) e faz: `npm install` → `npm run lint` → `npm test` →
`npm run build` → copia `dist/` para o repositório do Mafmine no GitLab → commit e push lá.

**O deploy para se lint ou testes falharem.** Se qualquer um dos dois falhar, o job é
interrompido antes do build, e nada é publicado no Mafmine.

**Fora do deploy não há verificação automática.** Push em outras branches e pull requests não
disparam nenhum workflow, e não há hook de pre-commit. Uma branch com a suíte quebrada só é
detectada depois de entrar em `main`, quando o deploy falha: `main` fica com o defeito, mas o
Mafmine continua com a última versão publicada.

## Lacunas conhecidas

- **Sem teste de componente React.** Não há Testing Library nem ambiente de DOM (`jsdom` ou
  `happy-dom`); o ambiente é `node`. Para compensar, a lógica da tela foi extraída para funções
  puras em `src/utils/` e testada lá.
- **Testes de fonte.** Os cinco arquivos de `src/components/__tests__/` e a segunda metade de
  `src/utils/__tests__/sliderTrack.test.js` leem o código-fonte com `readFileSync` e procuram
  padrões (uma prop, uma comparação, uma chave de tradução). Provam que um mecanismo decidido
  continua escrito, não que a tela renderiza certo. Um refactor que mude a escrita sem mudar o
  comportamento pode quebrá-los, e uma mudança de comportamento que preserve o texto passa por
  eles. Os próprios arquivos dizem isso no cabeçalho.
- **Nenhum teste ponta a ponta.** Não há Playwright, Cypress ou equivalente: o fluxo
  formulário → cálculo → tela nunca é exercitado num navegador.
- **Cenário de referência só para o SH&B.** Ver a seção do carvão.
- **Paridade de tradução, não conteúdo.** O teste de i18n garante que as chaves existem nos
  quatro idiomas, não que o texto está traduzido.
- **Dado pendente de confirmação.** Um valor dos critérios fixos (desempenho do Top Slicing)
  é estimado, não confirmado. Está registrado em `PENDING_CONFIRMATION`
  (`src/algorithms/mcdmCriteria.js`), e há um teste que trava essa lista.
- **Sem verificação automática fora do deploy.** Push em outras branches e pull requests não
  rodam lint nem testes; a trava só existe no deploy de `main` (ver [Automação](#automação)).
- **Sem medição de cobertura.** Nenhum relatório de cobertura está configurado.
