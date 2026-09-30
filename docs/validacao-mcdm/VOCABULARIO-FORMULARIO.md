# Vocabulário categórico real do formulário — levantamento (Item 1)

Levantamento **somente de leitura** sobre o app existente. Nada aqui é decisão de
mapeamento: é a transcrição literal do que o código aceita hoje, com o arquivo e a
linha de origem. Onde não existe regra no código, está marcado como **LACUNA** —
essas voltam para decisão humana (Francisco/Higor), não são inventadas aqui.

Data do levantamento: 2026-09-24. Base: `main`.

---

## 1. Formato do `formData` que os três cálculos leem

Chaves lidas por `calculateNicholas` / `calculateUBC` / `calculateSHB`
(`src/algorithms/algorithms.js:160-280`) e exigidas por
`requiredFieldsForStep` (`src/data/formRules.js:112-150`):

| Caminho | Tipo | Quem usa |
| --- | --- | --- |
| `geometry.shape` | categoria | os 3 |
| `geometry.thickness` | categoria | os 3 |
| `geometry.grade` | categoria | os 3 |
| `dip` | **número (graus)** — topo do objeto, fora de `geometry` | os 3 (classificado internamente) |
| `depth.ore` | **número (m)** | UBC, SH&B (Nicholas não tem critério de profundidade) |
| `depth.hangingWall`, `depth.footwall` | **número (m)** | entram no cálculo do RSS das 3 zonas |
| `ucs.{ore,hangingWall,footwall}` | **número (MPa)** | RSS |
| `density.{ore,hangingWall,footwall}` | **número (kg/m³)** | RSS |
| `rmr.{ore,hangingWall,footwall}` | categoria | UBC, SH&B |
| `jointSpacing.{ore,hangingWall,footwall}` | categoria | só Nicholas |
| `jointCondition.{ore,hangingWall,footwall}` | categoria | só Nicholas |
| `rss.{ore,hangingWall,footwall}` | categoria | **só Nicholas sozinho** (fallback manual) |
| `oreValue` | categoria | só SH&B |
| `selectedMethods` | `{nicholas, ubc, shb}` booleanos | — |

Nomes de zona são `ore` / `hangingWall` / `footwall` (`formRules.js:52`), não
`ob`/`hw`/`fw` — esses últimos só existem como chaves de peso e de breakdown.

---

## 2. Pergunta 1 — opções literais de "Forma" (shape)

**As três tabelas de peso usam exatamente as mesmas três strings**, e o `<select>`
oferece as mesmas três:

```
"Massivo"   "Tabular"   "Irregular"
```

- `src/algorithms/nicholasWeights.js:7-13` (`NICHOLAS_GEOMETRY.shape.options`)
- `src/algorithms/ubcWeights.js:16-22` (`UBC_GEOMETRY.shape.options`)
- `src/algorithms/shbWeights.js:9-15` (`SHB_GEOMETRY.shape.options`)
- `src/pages/Inputs.jsx:904-907` — `options={["Massivo", "Tabular", "Irregular"]}`

Não há quarta opção, não há variante de grafia, e a string do estado é a string da
chave da tabela (a i18n só troca o rótulo exibido: `enums.shape.*`).

Definições em `tips.shape` (`src/i18n/locales/pt-BR.json`), úteis para classificar um
relatório:

- **Massivo** — volume extenso e compacto, sem geometria alongada definida.
- **Tabular** — camada delgada e alongada (filão/veio), comprimento e largura
  substancialmente maiores que a espessura.
- **Irregular** — sem padrão geométrico definido; limites pouco previsíveis.

### Demais categorias de geometria (mesma fonte, para completar o quadro)

| Critério | Opções literais | Observação |
| --- | --- | --- |
| `geometry.thickness` | `"Muito estreito"`, `"Estreito"`, `"Intermediário"`, `"Espesso"`, `"Muito espesso"` | `formRules.js:9-15`. Com **Nicholas sozinho** o formulário remove `"Muito estreito"` (`thicknessOptionsFor`, linha 24); se o valor já estiver gravado, `calculateNicholas` o rebaixa para `"Estreito"` (`algorithms.js:214`). |
| `geometry.grade` | `"Uniforme"`, `"Gradacional"`, `"Errático"` | idênticas nas 3 tabelas; `Inputs.jsx:926-929`. |
| `oreValue` (só SH&B) | `"Baixo"`, `"Médio"`, `"Alto"` | `shbWeights.js:52-58`. |

O `dip` **não** é categórico no formulário: é número em graus, classificado no cálculo
(ver §4).

---

## 3. Pergunta 2 — geomecânica por domínio (ob/hw/fw): categórica ou numérica?

**As duas coisas, e a divisão é por método.** As zonas são sempre as mesmas três
(`ore`, `hangingWall`, `footwall`); o que muda é se o formulário pede número ou categoria.

### 3.1 Campos numéricos contínuos (por zona)

Existem três, e só existem quando **UBC ou SH&B** está marcado (`Inputs.jsx:955-1035`):

- `ucs.{zona}` — MPa
- `density.{zona}` — kg/m³
- `depth.{zona}` — m

Eles não vão para tabela nenhuma: alimentam o cálculo do RSS (§4.1). **Não existe
campo numérico para RMR, espaçamento ou condição de fratura** — ver 3.3 e 3.4.

### 3.2 `rss` — categórico, com duas escalas distintas

| Onde | Opções literais |
| --- | --- |
| Tabelas UBC (`ubcWeights.js:51-58`, `72-79`, `93-100`) e SH&B (`shbWeights.js:63-70`, `87-94`, `110-117`) | `"Muito fraca"`, `"Fraca"`, `"Moderada"`, `"Resistente"` — **4 classes** |
| Tabelas Nicholas (`nicholasWeights.js:37-43`, `66-72`, `93-99`) | `"Fraca"`, `"Moderada"`, `"Resistente"` — **3 classes**, sem `"Muito fraca"` |
| `<select>` manual `fd.rss.{zona}` (`Inputs.jsx:1042-1046`) | `"Fraca"`, `"Moderada"`, `"Resistente"` |

O `<select>` manual **só é renderizado com Nicholas sozinho** e só `calculateNicholas`
o lê, como fallback (`algorithms.js:220-222`). UBC e SH&B ignoram `fd.rss` de propósito —
comentário explícito em `algorithms.js:172-175`: são escalas diferentes para o mesmo número.

### 3.3 `rmr` — categórico (UBC/SH&B apenas), com renomeação interna no SH&B

O valor **gravado no formData** usa o vocabulário do UBC (`Inputs.jsx:183`):

```
"Muito pobre"   "Pobre"   "Razoável"   "Boa"   "Muito boa"
```

Confere com `UBC_OREBODY.rmr.options` (`ubcWeights.js:60-68`) e as duas outras zonas.

As tabelas do SH&B usam **outras strings** — `"Muito fraca"`, `"Fraca"`, `"Média"`,
`"Forte"`, `"Muito forte"` (`shbWeights.js:72-80`) — mas isso **não vaza para o
formData**: `calculateSHB` traduz internamente em `mapRmrToSHB`
(`algorithms.js:258-264`). Um caso de validação deve gravar sempre o vocabulário do UBC.

### 3.4 `jointSpacing` e `jointCondition` — categóricos, exclusivos do Nicholas

Só aparecem no formulário com Nicholas marcado (`formRules.js:144`), e só
`calculateNicholas` os lê.

| Critério | Opções literais | Fonte |
| --- | --- | --- |
| `jointSpacing` | `"Muito Perto"`, `"Perto"`, `"Longe"`, `"Muito Longe"` | `nicholasWeights.js:45-53` (ob), `74-82` (hw), `101-109` (fw); `Inputs.jsx:1087-1089` |
| `jointCondition` | `"Fraca"`, `"Média"`, `"Forte"` | `nicholasWeights.js:55-62`, `84-91`, `111-118`; `Inputs.jsx:1099-1101` |

Atenção à grafia de `jointSpacing`: **"Muito Perto" e "Muito Longe" com P e L
maiúsculos**, diferente de todas as outras categorias do app (`"Muito estreito"`,
`"Muito fraca"`, `"Muito boa"` são minúsculas). A chave é comparada literalmente em
`sumCriteria` (`algorithms.js:143`), então a caixa errada faz o critério sumir
silenciosamente da pontuação — em produção sem aviso nenhum (o `console.warn` de
`warnCriterionDropped` só roda em DEV, `algorithms.js:122`).

---

## 4. Pergunta 3 — precedentes de conversão numérico contínuo → categoria

**Existem, e são cinco.** Todos vivem no app e são a fonte legítima para o mapeador do
Item 3. Os pontos de corte abaixo são transcritos do código, não arredondados.

### 4.1 RSS (UCS + densidade + profundidade → classe)

`RSS = UCS × 10⁶ / (densidade × profundidade × 9,81)` — adimensional.

- **UBC / SH&B** — `classifyRSS` (`algorithms.js:16-26`):
  `< 5` Muito fraca | `5 – 10` Fraca | `10 – 15` Moderada | `≥ 15` Resistente
- **Nicholas** — `classifyRSSNicholas` (`algorithms.js:31-39`), escala diferente:
  `< 8` Fraca | `8 – 15` (inclusive) Moderada | `> 15` Resistente

A conversão é feita **dentro** de cada `calculate*`, a partir dos três números. Um caso
de validação que traga UCS/densidade/profundidade reais não precisa classificar o RSS:
basta entregar os números.

### 4.2 Profundidade → faixa

- **UBC** — `classifyDepthUBC` (`algorithms.js:41-47`): `≤ 100 m` Rasa | `≤ 600 m`
  Intermediária | `> 600 m` Profunda
- **SH&B** — `classifyDepthSHB` (`algorithms.js:49-56`): `≤ 200 m` Rasa | `≤ 500 m`
  Intermediária | `≤ 800 m` Pouco profunda | `> 800 m` Profunda

Entrada: `fd.depth.ore`. Nicholas não tem esse critério.

### 4.3 Mergulho (graus) → faixa

- **UBC e Nicholas** — `classifyDipUBC` (`algorithms.js:58-64`), usada pelos dois
  (`algorithms.js:171` e `213`): `< 20°` Plano | `20 – 55°` Intermediário | `> 55°` Inclinado
- **SH&B** — `classifyDipSHB` (`algorithms.js:66-74`): `< 15°` Plano | `< 30°` Baixo |
  `< 45°` Intermediário | `< 60°` Pouco inclinado | `≥ 60°` Inclinado

### 4.4 RMR numérico → classe

`rmrToClass` (`src/data/rmrData.js:3-9`), Bieniawski (1989):
`≤ 20` Muito pobre | `≤ 40` Pobre | `≤ 60` Razoável | `≤ 80` Boa | `> 80` Muito boa

**Este é o precedente direto para "RMR real do relatório → categoria do formulário".**
O formulário já expõe essa conversão ao usuário (`Inputs.jsx:198-199`), mas grava só a
classe resultante — o número não fica no estado.

### 4.5 GSI e Q → RMR numérico → classe

`rmrData.js:12-18`, ambos usados por botões do formulário (`Inputs.jsx:199`, `221`):

- `gsiToRmr(gsi) = (gsi + 11,63) / 1,13`
- `qToRmr(q) = 9 × ln(q) + 44`

Cobre relatórios NI 43-101 que publicam GSI ou Q em vez de RMR.

---

## 5. LACUNAS — sem regra no código, decisão volta para o humano

Estas **não têm precedente no repositório**. Qualquer número aqui seria invenção.

1. **Espessura em metros → categoria.** Não existe conversor: o campo é `<select>` puro.
   O único texto com faixas está na dica da UI (`tips.thickness.sections`,
   `src/i18n/locales/pt-BR.json`), atribuído a **Nicholas (1981/1992)**:
   Estreito `< 10 m` | Intermediário `10 – 30 m` | Espesso `30 – 100 m` |
   Muito espesso `> 100 m`. **A faixa de `"Muito estreito"` (extensão UBC 1995) não tem
   limite numérico em lugar nenhum** — há um `TODO` admitindo isso em
   `Inputs.jsx:907-910` ("confirmar faixa numérica com a publicação original"), e a fonte
   (Miller-Tait, Pakalnis & Poulin, 1995) foi procurada e não está em acesso aberto: ver
   a "Nota de busca" em `casos/METODOLOGIA.md`. Além
   disso, texto de dica não é tabela de peso: promover essas faixas a regra de código é
   decisão a confirmar, não consequência do levantamento.

2. **Espaçamento de fraturas em metros → `"Muito Perto"/"Perto"/"Longe"/"Muito Longe"`.**
   Nenhuma faixa numérica em código ou i18n. A dica diz apenas que as opções
   "correspondem ao espaçamento típico entre planos de fratura consecutivos", sem número.
   Relatórios NI 43-101 costumam publicar espaçamento em metros ou RQD — o corte é decisão.

3. **Condição de fratura → `"Fraca"/"Média"/"Forte"`.** Puramente qualitativo por
   definição (abertura, preenchimento, rugosidade — `tips.jointCondition`). Não há índice
   numérico associado. Mapear a partir de Jr/Ja (sistema Q) ou do sub-escore de
   descontinuidades do RMR seria uma correlação nova, não um precedente existente.

4. **`oreValue` → `"Baixo"/"Médio"/"Alto"`.** Explicitamente qualitativo e relativo
   (`tips.oreValue`): "não corresponde a um valor monetário específico". Não há corte em
   US$/t no app.

---

## 6. Duas observações que afetam o Item 4

- **O MCDM não está mais restrito ao Nicholas.** `MCDM_SUPPORTED_METHODS` hoje é
  `["nicholas", "ubc", "shb"]` e `MCDM_PENDING_METHODS` está **vazio**
  (`src/algorithms/mcdmPipeline.js:42` e `72`) — o SH&B foi liberado quando
  `shbScale.js` resolveu o fator embutido. O harness de comparação pode rodar os três.
- A entrada do pipeline é `buildDecisionMatrix(formData, selectedMethods)`
  (`src/algorithms/decisionMatrix.js:139`) → `runMcdmPipeline(matrix, { method })`
  (`mcdmPipeline.js:233`). Mesmo `formData` dos cálculos clássicos, então o mapeador do
  Item 3 serve aos dois lados da comparação sem adaptação.
