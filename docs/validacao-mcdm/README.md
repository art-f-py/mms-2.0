# Validação empírica do MCDM com casos reais

Infraestrutura para responder a uma pergunta só: **o método que a mina de fato usa fica
mais perto do topo do ranking com o MCDM do que sem ele?**

Cada caso é um relatório técnico (NI 43-101) reduzido a um JSON com os valores do
depósito e a provenância de cada número. O mesmo formulário mapeado atravessa os dois
caminhos — as três tabelas clássicas e o pipeline MCDM — e o que sai são as seis posições
do método real, lado a lado.

**Nada disto altera o app.** Os módulos em `src/validation/` só leem `src/algorithms`,
`src/data` e `src/utils`; nenhum arquivo do app importa de lá.

## Onde está o quê

| Caminho | O que é |
| --- | --- |
| `docs/validacao-mcdm/casos/METODOLOGIA.md` | A metodologia de extração — regra de descarte, valor conservador, provenância, e as tabelas do Nicholas (1981) confirmadas na fonte primária |
| `docs/validacao-mcdm/casos/*.json` | Os casos reais processados |
| `docs/validacao-mcdm/VOCABULARIO-FORMULARIO.md` | Levantamento do vocabulário categórico real do app, com arquivo e linha |
| `docs/validacao-mcdm/ESCALA-EM-LOTE.md` | Como um lote replicaria a metodologia (decisão pendente, não implementado) |
| `src/validation/caseSchema.js` | O schema v1 documentado + `validateCase` |
| `src/validation/caseLoader.js` | Leitura de arquivo e de diretório (único módulo com I/O) |
| `src/validation/mapCaseToFormData.js` | Caso → `formData`, com as regras de corte e suas fontes |
| `src/validation/compareRanking.js` | O harness: as seis posições |
| `src/validation/report.js` | Relatório de uma pasta inteira |
| `src/validation/fixtures/` | Fixture sintética — dados inventados, não é caso real |

## Como rodar

```
npx vitest run src/validation
```

Não há binário de linha de comando: os módulos de `src/` importam sem extensão, que o
Vite resolve e o Node puro não — um `node script.mjs` falharia no primeiro import. Um CLI
exigiria `vite-node` como devDependency, que é decisão de quem mantém o projeto.

## Estado hoje

Os dois casos reais estão **parciais** — o que falta em cada um sai nomeado por
`validateCase`, e é essa lista que diz o que procurar no próximo PDF. O harness é
exercitado por uma fixture sintética, claramente marcada como tal.

Dois bloqueios externos valem para qualquer caso, e estão detalhados na §4 de
`ESCALA-EM-LOTE.md`: o limite numérico de `"Muito estreito"` (sem ele, depósitos com
menos de 10 m não rodam UBC/SH&B) e a classificação de `ore_value_class` (sem ela, nenhum
caso roda SH&B).
