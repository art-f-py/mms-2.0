<p align="center">
  <img src="src/assets/mineracao.png" alt="MMS 2.0" width="120">
</p>

<h1 align="center">MMS 2.0 — Mining Method Selection Tool</h1>

<p align="center">
  Ferramenta web de suporte a decisao para selecao de metodos de lavra subterranea, com base em criterios geotecnicos, geometricos e economicos.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-blue">
  <img alt="Stack" src="https://img.shields.io/badge/stack-React%20%2B%20Vite-555">
  <img alt="Domain" src="https://img.shields.io/badge/domain-mining%20engineering%20%7C%20decision%20support-orange">
</p>

## Sumario

- [Visao geral](#visao-geral)
- [Principais recursos](#principais-recursos)
- [Metodologia](#metodologia)
- [Metodos de selecao implementados](#metodos-de-selecao-implementados)
- [Sistema de ponderacao](#sistema-de-ponderacao)
- [Instalacao e execucao](#instalacao-e-execucao)
- [Como usar](#como-usar)
- [Parametros principais](#parametros-principais)
- [Arquitetura do projeto](#arquitetura-do-projeto)
- [Desenvolvimento](#desenvolvimento)
- [Validacao](#validacao)
- [Limitacoes conhecidas](#limitacoes-conhecidas)
- [Roadmap tecnico](#roadmap-tecnico)
- [Citacao](#citacao)
- [Contribuicao](#contribuicao)
- [Licenca](#licenca)
- [Agradecimentos](#agradecimentos)

## Visao geral

O **MMS 2.0** e uma aplicacao web para selecao de metodos de lavra subterranea, reconstruida do zero a partir do MMS 1.0 (mafmine.com.br) com arquitetura modular em React. A ferramenta implementa tres metodos classicos de selecao numerica publicados na literatura de engenharia de minas — **UBC (1995)**, **Nicholas (1981/1992)** e **SH&B (2007)** — permitindo que os tres sejam executados simultaneamente a partir de um unico conjunto de parametros do deposito.

O projeto e desenvolvido no **LAPROM (Laboratorio de Processamento Mineral)**, na Universidade Federal do Rio Grande do Sul, como parte de um projeto de iniciacao cientifica.

**Aplicacao publicada:** https://art-f-py.github.io/mms-2.0/

## Principais recursos

- Formulario unificado que se adapta automaticamente aos metodos de selecao escolhidos.
- Visualizacao em tempo real da secao transversal do deposito (SVG), atualizada conforme forma, espessura, mergulho, profundidade e distribuicao de teores.
- Calculo automatico do Rock Substance Strength (RSS) a partir de UCS, densidade e profundidade.
- Entrada de RMR por classe direta, ou por conversao a partir de GSI ou Q-System.
- Sistema de ponderacao por criterio, com granularidade por dominio geologico (corpo de minerio, hanging wall, footwall).
- Presets de multiplicadores de dominio conforme a publicacao original do Nicholas (1992).
- Resultados com ranking, grafico de barras e radar de contribuicao por criterio (breakdown) para cada metodo de lavra.
- Persistencia local dos parametros preenchidos (localStorage).
- Validacao cruzada contra o MMS 1.0 para multiplos cenarios de deposito.

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

## Instalacao e execucao

### Requisitos

- Node.js e npm.
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

### Publicar no GitHub Pages

```bash
npm run deploy
```

## Como usar

1. Acesse a tela inicial e clique em **Iniciar**.
2. Selecione um ou mais metodos de selecao (UBC, Nicholas, SH&B).
3. Preencha a geometria do deposito — forma, espessura, mergulho e distribuicao de teores. A secao transversal e atualizada em tempo real.
4. Preencha os parametros geotecnicos (UCS, densidade, profundidade, RMR) para o corpo de minerio, hanging wall e footwall.
5. Se o SH&B estiver selecionado, informe o valor do minerio na etapa complementar.
6. Ajuste os pesos por criterio, se desejar, na etapa complementar.
7. Revise os parametros preenchidos e clique em **Calcular**.
8. Na pagina de resultados, inspecione o ranking, o grafico de barras e o radar normalizado de cada metodo de selecao. Clique em qualquer metodo de lavra para visualizar o breakdown de contribuicao por criterio.

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
├── pages/            # Home, Inputs, Statistics, DepositSketch
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
| `npm run deploy` | Gera o build e publica no GitHub Pages. |

### Qualidade de codigo

Antes de propor uma alteracao:

```bash
npm run lint
npm run build
```

### Estrutura do repositorio

O mapa completo da estrutura de pastas e arquivos e gerado automaticamente por `scripts/repo_map_gen.py` e mantido em `repo_map.txt`.

## Validacao

Os resultados do MMS 2.0 foram validados por comparacao direta contra o MMS 1.0, utilizando multiplos cenarios de deposito (deposito tabular inclinado, deposito massivo raso e deposito tabular plano profundo), cobrindo os tres metodos de selecao. As tabelas de pesos foram conferidas linha a linha contra as tabelas originais do MMS 1.0.

## Limitacoes conhecidas

- A ferramenta ainda nao possui segmentacao de deposito por profundidade (avaliacao por trechos).
- A responsividade para telas moveis esta em desenvolvimento.
- Nao ha sistema de traducao (i18n) implementado; a interface esta disponivel apenas em portugues.
- Nao ha exportacao de resultados em formato de relatorio.

## Roadmap tecnico

- Ponderacao automatica por Entropy Weighting, como alternativa a ponderacao manual.
- Segmentacao do deposito por profundidade.
- Responsividade completa para dispositivos moveis.
- Sistema de traducao (portugues, ingles, espanhol).
- Exportacao de resultados.

## Citacao

Se utilizar este software em trabalhos academicos, cite o projeto conforme `CITATION.cff`.

Referencia curta:

```text
Feijo, Artur; Campos, Higor Jose Silva.
MMS 2.0 - Mining Method Selection Tool. Version 1.0.0. 2026. MIT License.
```

Resumo do CFF:

- Titulo: `MMS 2.0 - Mining Method Selection Tool`
- Versao: `1.0.0`
- Ano: `2026`
- Licenca: `MIT`
- Instituicao: Universidade Federal do Rio Grande do Sul — LAPROM

## Contribuicao

Contribuicoes sao bem-vindas. Para manter o projeto organizado:

1. Crie uma branch para a alteracao.
2. Mantenha a mudanca focada em um problema ou recurso.
3. Nao altere as tabelas de pesos sem validacao cruzada contra o MMS 1.0.
4. Rode `npm run lint` e `npm run build` antes de propor a alteracao.
5. Atualize este README e `CITATION.cff` quando a mudanca afetar instalacao, uso, autoria, citacao ou metodologia.

Evite versionar artefatos gerados como `node_modules/` e `dist/`.

## Licenca

Este projeto e distribuido sob a licenca MIT. Consulte [`LICENSE`](LICENSE) para detalhes.

## Agradecimentos

Ao **LAPROM** e ao corpo docente da Universidade Federal do Rio Grande do Sul pela orientacao e infraestrutura. Aos autores das publicacoes originais de UBC (1995), Nicholas (1981, 1992) e SH&B (2007), cujas tabelas de classificacao fundamentam os algoritmos deste projeto.
