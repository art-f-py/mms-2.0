# Processamento em lote — como replicar a metodologia em N relatórios

Documento de **decisão**, não de implementação. Nada aqui está construído; o que existe
hoje é a infraestrutura de um caso por vez (`src/validation/`). O objetivo é deixar
explícito o que um lote teria de fazer, onde ele pode ser automatizado sem perder a
honestidade da extração, e onde não pode — para a decisão entre "agente de IA lendo PDF
em lote" e "manual/semi-manual caso a caso" ser tomada com o custo de cada caminho à
vista.

---

## 1. O que a infraestrutura de hoje já resolve

Um lote não precisa reimplementar nada disto:

- **Vocabulário** — `src/validation/caseSchema.js` deriva as categorias das próprias
  tabelas de peso. Nenhuma etapa do lote transcreve string de categoria à mão.
- **Completude** — `validateCase` devolve a lista do que falta, por método, sem lançar.
  É o que separa "caso pronto" de "caso parcial" sem julgamento humano repetido.
- **Conversões numéricas** — `mapCaseToFormData` faz espessura→faixa e
  fraturas/RQD→espaçamento (Nicholas 1981, Tables 1 e 2), e **reusa** os conversores que
  já existem no app para RMR/GSI/Q (`rmrData.js`). RSS, profundidade e mergulho não são
  convertidos em lugar nenhum: o número cru vai para o formulário e cada cálculo o
  classifica na própria escala.
- **Comparação** — `compareCase` produz as seis posições do método real.
- **Relatório de pasta** — `buildValidationReport` roda os três passos sobre um
  diretório inteiro e devolve o texto: quantos prontos, o que falta em cada pendente,
  e a comparação dos prontos.

Ou seja: **da pasta de JSONs para a tabela de resultados, o lote já existe.** O que não
existe é o trecho anterior — do PDF para o JSON.

---

## 2. As três regras da metodologia, e o que cada uma exige de um lote

### 2.1 Regra de descarte

Do `METODOLOGIA.md`: pular relatórios com múltiplas zonas ou domínios sem representante
único (Almaden/Ixtaca, 6 zonas com médias diferentes e veio de 2–20 m).

Num lote isso precisa virar um **passo de triagem explícito, anterior à extração**, com
saída de três estados — `incluído`, `descartado`, `inconclusivo` — e o motivo registrado
em texto. Dois sinais já identificados servem de heurística de primeira passada:

- **Descartar**: o relatório nomeia várias zonas (MHG/NHG/MLG…), ou usa "vein swarm",
  "multiple zones", "stacked lenses".
- **Bom sinal**: o relatório se classifica como "bedded", "stratiform", "tabular" —
  linguagem técnica direta, não inferência do leitor.

**A heurística tria, não decide.** Um relatório marcado `descartado` por palavra-chave e
nunca revisado por humano é uma amostra enviesada silenciosa: se a triagem automática
eliminar preferencialmente depósitos complexos, a validação passa a medir o MCDM só em
geometria simples, e o resultado parece melhor do que é. O registro do motivo existe
justamente para essa auditoria ser possível depois.

### 2.2 Valor conservador

Do `METODOLOGIA.md`: havendo faixa estreita e coerente, usar o valor menos favorável à
lavra, preferindo o sub-valor que o próprio texto identifica como principal quando essa
pista existe.

Esta regra **não é automatizável sem perda**, e é o ponto mais delicado do lote inteiro.
Ela tem duas metades de naturezas diferentes:

- "menos favorável à lavra" é uma regra **mecânica** — dá para aplicar sobre uma faixa
  já extraída, desde que se saiba a direção de cada critério.
- "o sub-valor que o texto identifica como principal" é **leitura**. Foi ela que produziu
  a melhor decisão de todo o conjunto até agora: no Highland, 1,6 m não é só o extremo
  inferior da faixa 1,6–3,7 m, é a espessura média da unidade Domino, que o Item 1.7
  chama de "the principal copper host". Uma regra automática que pegasse o mínimo da
  faixa chegaria ao mesmo número **pelo motivo errado** — e chegaria ao número errado no
  próximo relatório em que a unidade principal não for a mais fina.

Consequência prática para o lote: **o campo de valor e o campo de provenância têm de ser
preenchidos pelo mesmo passo, e a provenância precisa dizer qual das duas metades da
regra decidiu.** Um número sem essa frase é indistinguível de um chute.

### 2.3 Provenância obrigatória

Cada valor traz `<campo>_provenance` — item do relatório, tabela, citação, e a
justificativa da escolha quando houve escolha.

Já é verificável hoje: `validateCase(caso, { requireProvenance: true })` promove
provenância ausente de aviso a pendência. O default é aviso porque o pipeline roda sem
ela; **um lote deve rodar com `requireProvenance: true`**, que é onde a regra do
`METODOLOGIA.md` vale integralmente. É o modo de auditar antes de publicar resultado.

O terceiro campo, `<campo>_confidence`, é o que permite filtrar depois: uma validação
rodada só sobre valores de confiança alta é um teste diferente — e mais forte — do que
uma que aceita escolhas dentro de faixa.

---

## 3. O trecho que falta: PDF → JSON

É aqui que a decisão mora. O restante do pipeline é determinístico.

### 3.1 O que um agente de IA lendo PDF faria bem

- **Triagem** (§2.1). Ler o sumário e o Item 1 procurando os sinais de múltiplas zonas é
  exatamente leitura de texto em volume — e o custo do erro é baixo, porque um descarte
  indevido só perde um caso, não contamina o resultado.
- **Localizar a seção certa.** "Onde está o mergulho" é uma pergunta de busca; os dois
  casos parciais falharam nisso por limite de esforço, não de capacidade.
- **Extrair o método real e a citação.** Os dois casos acertaram com citação textual
  explícita e confiança alta. É o campo mais fácil do schema.
- **Transcrever número único e explícito.** Espessura do Belgravia (5,1 ft da Tabela 1-1)
  é transcrição, não julgamento.

### 3.2 O que um agente faria mal, ou perigosamente bem

- **Escolher dentro de uma faixa.** Ver §2.2. O risco não é errar o número: é produzir
  uma provenância convincente para uma escolha que não foi feita pelo motivo declarado.
  Texto plausível é exatamente o que um modelo de linguagem gera com mais facilidade, e
  não há como distinguir depois, lendo só o JSON.
- **Tabelas em PDF.** O Highland já mostrou o modo de falha: a Tabela 16.2 existe, o
  sumário a confirma, e a extração linear embaralha o conteúdo. Um agente que "leu" essa
  tabela e devolveu números precisa ser conferido contra a página renderizada — o erro
  aqui é silencioso e numericamente plausível.
- **Preencher `shape`.** Mapear "sediment-hosted stratiform copper deposit" para
  `Tabular` é defensável; para `Massivo` não é. Mas a distância entre as duas decisões
  não aparece no JSON — as duas saem como uma string de três letras maiúsculas. Este
  campo pede provenância com citação **obrigatória**, não opcional.
- **Reduzir dado estruturalmente não-único a um número.** A profundidade por painel do
  Highland (91/122/183/274 m) é o caso-teste: a resposta certa é recusar, e recusar é
  justamente o que um extrator otimizado para "preencher o campo" não faz.

### 3.3 Desenho recomendado, se a automação for adiante

Quatro passos, com o terceiro sendo o único caro:

1. **Triagem automática** → decisão + motivo, sem extrair nada.
2. **Extração automática dos campos de valor único** — método real com citação, e todo
   número que o relatório publique de forma explícita e isolada. Faixa, tabela em imagem
   e dado não-único saem como `null` com o status descrevendo por quê. **Não preencher é
   sucesso**, e o prompt precisa dizer isso com todas as letras.
3. **Revisão humana dirigida** — não do relatório inteiro, só dos campos que o passo 2
   marcou. É aqui que a regra do valor conservador é aplicada por quem leu o texto.
   `validateCase` já produz exatamente essa lista de trabalho, por caso.
4. **Execução e agregação** — `buildValidationReport` sobre a pasta, com
   `requireProvenance: true`.

O ganho da automação é concentrar o esforço humano no passo 3, que é pequeno por caso e
irredutível. O risco é o passo 2 preencher o que deveria recusar — e a defesa contra isso
não é prompt, é o passo 3 existir.

---

## 4. Dois bloqueios que valem para qualquer volume

Nenhum dos dois é resolvível por mais leitura de relatório: são decisões externas.

1. **Limite de "Muito estreito" (UBC 1995).** Sem ele, **todo depósito com menos de 10 m
   de espessura é inmapeável para UBC e SH&B** — o mapeador recusa em vez de adivinhar
   (`thicknessCategory`). Os dois casos reais de hoje têm 1,55 m e 1,6 m: os dois caem
   aí. Não é caso de borda, é a faixa onde mora a lavra de camada — potássio, cobre
   estratiforme, carvão —, que é justamente onde o R&P aparece. Enquanto o limite não vier
   de Miller-Tait, Pakalnis & Poulin (1995), um lote desse tipo de depósito só roda com o
   Nicholas sozinho, ou com `geometry.thickness_category` declarada caso a caso por quem
   tem a fonte. **A fonte foi procurada e não está em acesso aberto** — é capítulo de
   anais da Balkema, sem DOI livre; os dois caminhos (perguntar ao Higor, ou acervo
   UFRGS/COMUT) e o número exato que se precisa dela estão registrados na "Nota de busca"
   de `casos/METODOLOGIA.md`.
2. **`ore_value_class` (Baixo/Médio/Alto).** Sem critério publicado, **nenhum caso roda o
   SH&B**. Um número de teor ou de preço no relatório não resolve: falta a regra de corte,
   que é do Francisco.

---

## 5. O que registrar por lote, para o resultado ser defensável

Além dos casos em si:

- **Quantos relatórios entraram, quantos foram descartados e por quê** — sem isso não há
  como afirmar que a amostra não foi selecionada pelo resultado.
- **A distribuição dos métodos reais.** Se 8 de 10 casos forem R&P, a validação mede o
  comportamento do ranking para R&P, não para o MCDM em geral. Os dois casos de hoje já
  são os dois R&P.
- **Quantos casos precisaram de escolha dentro de faixa**, e o resultado com e sem eles.
- **A versão dos pesos.** A comparação usa o Enfoque uniforme entre os quatro grupos, que
  é o ponto de partida do app — não um resultado neutro. Um lote rodado com outra
  repartição não é comparável ao anterior sem dizer isso.
