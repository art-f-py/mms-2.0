<p align="center">
  <img src="src/assets/mineracao.png" alt="MMS 2.0" width="120">
</p>

<h1 align="center">MMS 2.0 — Mining Method Selection Tool</h1>

<p align="center">
  Ferramenta web de suporte a decisao para selecao de metodos de lavra subterranea, com base em criterios geotecnicos, geometricos e economicos.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-1.1.0-blue">
  <img alt="Stack" src="https://img.shields.io/badge/stack-React%20%2B%20Vite-555">
  <img alt="Domain" src="https://img.shields.io/badge/domain-mining%20engineering%20%7C%20decision%20support-orange">
</p>

## Sumario

- [Visao geral](#visao-geral)
- [Principais recursos](#principais-recursos)
- [Metodologia](#metodologia)
- [Metodos de selecao implementados](#metodos-de-selecao-implementados)
- [Sistema de ponderacao](#sistema-de-ponderacao)
- [Decisao multicriterio (MCDM)](#decisao-multicriterio-mcdm)
- [Instalacao e execucao](#instalacao-e-execucao)
- [Como usar](#como-usar)
- [Parametros principais](#parametros-principais)
- [Arquitetura do projeto](#arquitetura-do-projeto)
- [Desenvolvimento](#desenvolvimento)
- [Validacao](#validacao)
- [Uso de IA](#uso-de-ia)
- [Limitacoes conhecidas](#limitacoes-conhecidas)
- [Roadmap tecnico](#roadmap-tecnico)
- [Citacao](#citacao)
- [Contribuicao](#contribuicao)
- [Licenca](#licenca)
- [Agradecimentos](#agradecimentos)

## Visao geral

O **MMS 2.0** e uma aplicacao web para selecao de metodos de lavra subterranea, reconstruida do zero a partir do MMS 1.0 (mafmine.com.br) com arquitetura modular em React. A ferramenta implementa tres metodos classicos de selecao numerica publicados na literatura de engenharia de minas — **UBC (1995)**, **Nicholas (1981/1992)** e **SH&B (2007)** — permitindo que os tres sejam executados simultaneamente a partir de um unico conjunto de parametros do deposito. Sobre os resultados classicos, uma camada de decisao multicriterio (TOPSIS) produz um segundo ranking, que combina os criterios de cada metodo com seis criterios fixos de desempenho tecnico e economico dos metodos de lavra.

O projeto e desenvolvido no **LAPROM (Laboratorio de Processamento Mineral)**, na Universidade Federal do Rio Grande do Sul, como parte de um projeto de iniciacao cientifica.

**Aplicacao publicada:** https://mafmine.k8s.inf.ufrgs.br/v3.1/tools/mms_2.0/

## Principais recursos

- Formulario unificado que se adapta automaticamente aos metodos de selecao escolhidos.
- Visualizacao em tempo real da secao transversal do deposito (SVG), atualizada conforme forma, espessura, mergulho, profundidade e distribuicao de teores.
- Calculo automatico do Rock Substance Strength (RSS) a partir de UCS, densidade e profundidade.
- Entrada de RMR por classe direta, ou por conversao a partir de GSI ou Q-System.
- Sistema de ponderacao por criterio, com granularidade por dominio geologico (corpo de minerio, hanging wall, footwall).
- Presets de multiplicadores de dominio conforme a publicacao original do Nicholas (1992).
- Resultados com ranking, grafico de barras e radar de contribuicao por criterio (breakdown) para cada metodo de lavra.
- Persistencia local dos parametros preenchidos, dos pesos do MCDM e dos cenarios salvos (localStorage).
- Decisao multicriterio (TOPSIS) para os tres metodos de selecao, com ponderacao manual por grupo de criterios (Enfoque) ou automatica por entropia de Shannon (Entropy), matriz de decisao exibida ao vivo e comparacao de cenarios salvos.
- Interface em quatro idiomas: portugues, ingles, espanhol e frances.
- Formulario para reportar problemas. Os dados preenchidos (nome, e-mail e mensagem) sao enviados ao servico externo formcarry.com.
- Cenario de regressao do SH&B fixado em teste automatizado contra o MMS 1.0.

## Metodologia

O MMS 2.0 avalia sempre os mesmos dez metodos de lavra candidatos:

Open Pit · Block Caving · Sublevel Stoping · Sublevel Caving · Longwall · Room & Pillar · Shrinkage Stoping · Cut & Fill · Top Slicing · Square Set Stoping

Cada metodo de selecao segue a mesma logica geral:

1. **Classificacao dos parametros numericos**
   Os valores inseridos pelo usuario (angulo de mergulho, profundidade, UCS, densidade) sao convertidos em classes categoricas, com faixas proprias a cada metodo de selecao.

2. **Consulta as tabelas de pesos**
   Cada classe corresponde a uma chave em uma tabela de pesos publicada na literatura do respectivo metodo. A tabela retorna dez scores, um para cada metodo de lavra candidato.

3. **Soma ponderada**
   Os scores de todos os criterios sao somados por metodo de lavra, multiplicados pelos pesos de criterio e, quando aplicavel, pelos multiplicadores de dominio geologico definidos pelo usuario.

4. **Ranking**
   Os dez metodos de lavra sao ordenados por score decrescente.

Valores de penalidade tecnica (-49 no UBC/Nicholas, -50 no SH&B) nao eliminam um metodo do ranking; funcionam como penalizacao pesada para indicar inadequacao tecnica severa.

### Formula do RSS

```
RSS = UCS (MPa) x 10^6 / (Densidade (kg/m3) x Profundidade (m) x 9.81)
```

Faixas de classificacao (UBC e SH&B): Muito fraca (<5) · Fraca (5-10) · Moderada (10-15) · Resistente (>=15)
Faixas de classificacao (Nicholas): Fraca (<8) · Moderada (8-15) · Resistente (>15)

## Metodos de selecao implementados

| Metodo | Referencia | Criterios considerados |
| --- | --- | --- |
| UBC 1995 | Miller, Pakalnis & Poulin | Geometria, profundidade, RSS, RMR |
| Nicholas 1981/1992 | Nicholas, D. E. | Geometria, RSS, espacamento e condicao das descontinuidades |
| SH&B 2007 | Shahriar, Bakhtavar et al. | Geometria, profundidade, RSS, RMR, valor do minerio |

O RMR pode ser informado diretamente por classe, ou obtido por conversao a partir de GSI ou do Q-System, usando as correlacoes de Bieniawski (1989).

## Sistema de ponderacao

Alem dos pesos padrao (neutros) de cada metodo, a ferramenta permite:

- **UBC e SH&B**: ponderacao individual por criterio, organizada por dominio geologico (geometria, corpo de minerio, hanging wall, footwall).
- **Nicholas**: dois modos mutuamente exclusivos —
  - *Multiplicadores de dominio*, com presets extraidos da publicacao original de 1992 (geo/ob/hw/fw), alem de entrada livre;
  - *Individualizacao extrema*, com pesos proprios para cada criterio dentro de cada dominio geologico.

Os dois modos do Nicholas nunca coexistem: ativar um reinicia o outro para o valor neutro, evitando combinacoes de ponderacao sem respaldo tecnico.

## Decisao multicriterio (MCDM)

Alem do ranking classico, a pagina de resultados oferece um ranking multicriterio, calculado pelo metodo **TOPSIS** (Hwang & Yoon, 1981) sobre a matriz de decisao do metodo de selecao em foco (UBC, Nicholas ou SH&B). A metodologia foi desenvolvida em colaboracao com **Francisco Vargas** (Universidad de Concepcion).

### Matriz de decisao estendida

As linhas sao os dez metodos de lavra candidatos. As colunas sao os criterios classicos do metodo de selecao, pontuados a partir do formulario, seguidos de seis criterios fixos que descrevem o metodo de lavra em si, e nao o deposito. Por isso os seis valem igual em qualquer metodo de selecao:

| Criterio fixo | Grupo | Direcao |
| --- | --- | --- |
| Desempenho | Tecnico-Operacional | Maximizar |
| Produtividade | Tecnico-Operacional | Maximizar |
| Recuperacao | Tecnico-Operacional | Maximizar |
| Diluicao | Tecnico-Operacional | Minimizar |
| Investimento de capital | Economia | Minimizar |
| Custos comparativos | Economia | Minimizar |

Os criterios classicos sao todos maximizados. A normalizacao vetorial do TOPSIS trata cada coluna de forma independente, de modo que escalas nativas diferentes (1 a 5 nos criterios fixos, indice de 10 a 100 nos custos comparativos) entram na conta sem reescala manual.

### Conversao de escala

Antes do TOPSIS, os scores classicos sao convertidos para a escala de 1 a 9, com uma regra propria por metodo de selecao:

- **Nicholas**: conversao linear dos scores de 0 a 4 (`2 x score + 1`).
- **UBC**: tabela categorica de correspondencia, que cobre todo o dominio de scores das tabelas do metodo.
- **SH&B**: as tabelas publicadas ja trazem o fator de importancia do criterio embutido no score; a conversao desfaz esse fator e aplica a mesma tabela de correspondencia do UBC, com duas excecoes pontuais confirmadas.

Nos tres metodos, os scores de eliminacao (-49 ou -50) sao convertidos para 0, abaixo do 1 atribuido ao pior score comum.

### Ponderacao

Dois modos, mutuamente exclusivos:

- **Enfoque** (manual): o usuario distribui o peso entre quatro grupos de criterios — Geometria, Geomecanica, Tecnico-Operacional e Economia —, com os quatro pesos somando 1. O peso de cada grupo se divide igualmente entre os criterios do grupo presentes na matriz. Ao ajustar um grupo, os outros tres sao rebalanceados de forma proporcional (mantem a proporcao entre si) ou igualitaria (dividem o restante em partes iguais), conforme a opcao escolhida.
- **Entropy** (automatico): os pesos sao calculados pela entropia de Shannon a partir da dispersao de cada coluna da matriz ja convertida. Criterios que pouco diferenciam os metodos de lavra recebem peso menor.

### Recursos da tela

- Matriz de decisao exibida ao vivo, com o peso de cada coluna atualizado conforme a ponderacao.
- Comparacao de cenarios salvos: cada cenario guarda metodo de selecao, modo (Enfoque ou Entropy) e pesos, e e recalculado com os dados atuais do formulario, lado a lado com os demais.
- Sinalizacao dos criterios em que um metodo de lavra recebeu a pontuacao minima da escala (scores de eliminacao). No MCDM a sinalizacao e informativa: o metodo continua no ranking.

### Verificacao e pendencias

A implementacao do TOPSIS e da ponderacao por entropia tem paridade numerica com o motor de referencia fornecido por Francisco Vargas, fixada em teste automatizado.

O valor de **desempenho do Top Slicing** e uma estimativa ainda nao confirmada: a celula correspondente esta vazia na tabela de origem. O valor esta isolado e declarado como pendente no codigo (`PENDING_CONFIRMATION`, em `src/algorithms/mcdmCriteria.js`).

## Instalacao e execucao

### Requisitos

- Node.js (o CI usa a versao 22) e npm.
- Git.

### Preparar o projeto

```bash
git clone https://github.com/art-f-py/mms-2.0.git
cd mms-2.0
npm install
```

### Executar em desenvolvimento

```bash
npm run dev
```

A aplicacao fica disponivel em `http://localhost:5173/`.

### Gerar build de producao

```bash
npm run build
```

O build e gerado em `dist/`.

## Como usar

1. Acesse a tela inicial e clique em **Iniciar**.
2. Selecione um ou mais metodos de selecao (UBC, Nicholas, SH&B).
3. Preencha a geometria do deposito — forma, espessura, mergulho e distribuicao de teores. A secao transversal e atualizada em tempo real.
4. Preencha os parametros geotecnicos (UCS, densidade, profundidade, RMR) para o corpo de minerio, hanging wall e footwall.
5. Se o SH&B estiver selecionado, informe o valor do minerio na etapa complementar.
6. Ajuste os pesos por criterio, se desejar, na etapa complementar.
7. Revise os parametros preenchidos e clique em **Calcular**.
8. Na pagina de resultados, inspecione o ranking, o grafico de barras e o radar normalizado de cada metodo de selecao. Clique em qualquer metodo de lavra para visualizar o breakdown de contribuicao por criterio.
9. Na aba **Decisao multicriterio**, escolha o metodo de selecao, o modo de ponderacao (Enfoque ou Entropy) e, no Enfoque, os pesos por grupo. Salve cenarios para compara-los na aba **Comparar cenarios**.

## Parametros principais

| Parametro | Descricao | Usado por |
| --- | --- | --- |
| Forma geral | Massivo, Tabular ou Irregular | UBC, Nicholas, SH&B |
| Espessura | Muito estreito a Muito espesso | UBC, Nicholas, SH&B |
| Mergulho | Angulo em graus | UBC, Nicholas, SH&B |
| Distribuicao de teores | Uniforme, Gradacional ou Erratico | UBC, Nicholas, SH&B |
| Profundidade | Metros, por dominio geologico | UBC, SH&B |
| UCS, densidade | Usados no calculo automatico do RSS | UBC, Nicholas, SH&B |
| RMR | Classe direta, GSI ou Q-System | UBC, SH&B |
| Espacamento e condicao das descontinuidades | Por dominio geologico | Nicholas |
| Valor do minerio | Baixo, Medio ou Alto | SH&B |

## Arquitetura do projeto

```
src/
├── algorithms/       # Algoritmos de calculo e tabelas de pesos por metodo
├── components/       # Componentes reutilizaveis de interface
├── context/          # Estado global da aplicacao (MmsContext)
├── data/             # Dados de referencia (UCS e densidade por rocha)
├── i18n/             # Traducao: configuracao e arquivos dos 4 idiomas
├── pages/            # Home, Inputs, Statistics, DepositSketch
├── utils/            # Logica pura extraida da interface (ranking MCDM, marcadores, comparacao de cenarios)
└── assets/           # Imagens e recursos estaticos
```

A logica de calculo esta isolada em `src/algorithms/`, separada das tabelas de pesos. Adicionar um novo metodo de selecao consiste em criar um novo arquivo de pesos e uma nova funcao de calculo, sem necessidade de alterar os metodos existentes.

## Desenvolvimento

### Scripts npm

| Script | Descricao |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento Vite. |
| `npm run build` | Gera o build de producao em `dist/`. |
| `npm run preview` | Serve o build gerado para inspecao local. |
| `npm run lint` | Executa o ESLint no projeto. |
| `npm test` | Roda a suite de testes (Vitest) uma vez. |
| `npm run test:watch` | Roda a suite em modo observacao. |

### Qualidade de codigo

Antes de propor uma alteracao:

```bash
npm run lint
npm run build
```

A suíte de testes, o lint, o build e as lacunas conhecidas estão descritos em [`docs/TESTES.md`](docs/TESTES.md).

### Estrutura do repositorio

O mapa completo da estrutura de pastas e arquivos e gerado automaticamente por `scripts/repo_map_gen.py` e mantido em `repo_map.txt`.

## Validacao

O que esta fixado em teste automatizado:

- **Regressao contra o MMS 1.0**: um cenario de deposito (camada de carvao tabular, plana e profunda), apenas para o **SH&B**. Os scores dos dez metodos de lavra e o ranking sao os que o MMS 1.0 produzia para o mesmo cenario. Nao ha cenario equivalente automatizado para o UBC nem para o Nicholas.
- **Tabelas de pesos**: integridade estrutural e alinhamento entre as classes calculadas, as opcoes do formulario e as chaves das tabelas, nos tres metodos.
- **Decisao multicriterio**: paridade do TOPSIS e da ponderacao por entropia com o motor de referencia em R.

Comparacoes manuais anteriores com o MMS 1.0 nao estao registradas no repositorio. O detalhamento da suite e das lacunas conhecidas esta em [`docs/TESTES.md`](docs/TESTES.md).

## Uso de IA

O desenvolvimento contou com auxilio de IA generativa (Claude Code e, para refinamento de prompts e pesquisas pontuais, Claude no claude.ai), sempre com revisao e aprovacao do autor. Como foi usada, onde contribuiu e quais decisoes vieram de pessoas e fontes identificadas: [`docs/USO-DE-IA.md`](docs/USO-DE-IA.md).

## Limitacoes conhecidas

- A ferramenta ainda nao possui segmentacao de deposito por profundidade (avaliacao por trechos).
- A responsividade para telas moveis esta em desenvolvimento.
- Nao ha exportacao de resultados em formato de relatorio.
- Os textos da decisao multicriterio ainda estao em portugues nas interfaces em ingles, espanhol e frances.
- As descricoes conceituais dos seis criterios fixos do MCDM ainda nao foram escritas (a interface exibe um texto provisorio).
- O valor de desempenho do Top Slicing no MCDM e estimado e aguarda confirmacao.

## Roadmap tecnico

- Segmentacao do deposito por profundidade.
- Responsividade completa para dispositivos moveis.
- Exportacao de resultados.

## Citacao

Se utilizar este software em trabalhos academicos, cite o projeto conforme `CITATION.cff`.

Referencia curta:

```text
Feijó, Artur; Campos, Higor José Silva; Cardozo, Fernando Alves Cantini;
Petter, Carlos Otávio; Petter, Renato Aurélio; Vargas Soto, Francisco Ignacio.
MMS 2.0 - Mining Method Selection Tool. Version 1.1.0. 2026. MIT License.
```

Resumo do CFF:

- Titulo: `MMS 2.0 - Mining Method Selection Tool`
- Versao: `1.1.0`
- Ano: `2026`
- Licenca: `MIT`
- Instituicao: Universidade Federal do Rio Grande do Sul — LAPROM

## Contribuicao

Contribuicoes sao bem-vindas. Para manter o projeto organizado:

1. Crie uma branch para a alteracao.
2. Mantenha a mudanca focada em um problema ou recurso.
3. Nao altere as tabelas de pesos dos metodos classicos sem validacao cruzada contra o MMS 1.0. As escalas de conversao para 1-9 e os criterios fixos do MCDM dependem de confirmacao de Francisco Vargas.
4. Rode `npm test`, `npm run lint` e `npm run build` antes de propor a alteracao.
5. Atualize este README e `CITATION.cff` quando a mudanca afetar instalacao, uso, autoria, citacao ou metodologia.

Evite versionar artefatos gerados como `node_modules/` e `dist/`.

## Licenca

Este projeto e distribuido sob a licenca MIT. Consulte [`LICENSE`](LICENSE) para detalhes.

## Agradecimentos

Ao **LAPROM** e ao corpo docente da Universidade Federal do Rio Grande do Sul pela orientacao e infraestrutura. Aos autores das publicacoes originais de UBC (1995), Nicholas (1981, 1992) e SH&B (2007), cujas tabelas de classificacao fundamentam os algoritmos deste projeto. A **Francisco Vargas** (Universidad de Concepcion), pela metodologia multicriterio desenvolvida em colaboracao com o projeto e pela revisao da terminologia em espanhol.
