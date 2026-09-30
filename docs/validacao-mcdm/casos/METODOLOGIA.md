# Metodologia de extração — validação MCDM com casos reais

Resumo do que foi estabelecido nesta rodada, para consumo do Claude Code.

## Fonte dos dados
Pasta do Drive com relatórios técnicos (NI 43-101) indexados pela aba "OP" (índice) e
"UG" (índice + dados já tabulados, mas incompletos — faltam Forma/Teor e geomecânica por
domínio, então a aba UG sozinha NÃO é fonte suficiente; os PDFs originais são).

## Regra de inclusão/exclusão de caso
- **Pular** relatórios com múltiplas zonas/domínios de teor ou espessura sem
  representante único (ex: Almaden/Ixtaca — 6 zonas mineralizadas com médias diferentes,
  espessura de veio 2-20m sem redução honesta a um número). Sinal de alerta: relatório
  descreve o depósito com múltiplos nomes de zona (MHG/NHG/MLG/etc) ou usa linguagem como
  "vein swarm", "multiple zones".
- **Bom sinal de caso limpo**: relatório classifica o depósito explicitamente como
  "bedded", "stratiform", "tabular" (linguagem técnica direta, não inferência) — nos dois
  casos assim encontrados (Belgravia/potássio, Highland/cobre), a geometria ficou
  utilizável.
- Quando existir FAIXA (não número único) mas estreita e coerente — usar o valor mais
  conservador (o que menos favorece a lavra), preferindo o sub-valor que o texto já
  identifica como "principal"/representativo quando essa pista existir (não é escolha
  arbitrária do extremo).
- **NÃO forçar** um valor único quando o dado é estruturalmente não-único (ex:
  profundidade por painel de lavra, não do depósito) — marcar como propriedade real do
  dado, não como lacuna de busca.

## Schema do caso (JSON)

```json
{
  "case_id": "string",
  "status": "usable | parcial",
  "source": { "report_title", "company", "drive_file", "report_date", "drive_file_id" },
  "real_method": { "code", "confidence", "quote", "location" },
  "geometry": {
    "shape": null,
    "shape_status": "AINDA NÃO RESOLVIDO EM NENHUM CASO — nenhum dos 3 relatórios 
      processados confirmou uma categoria de Forma no vocabulário exato que o formulário 
      usa. Precisa: 1) ler as opções reais de 'shape' em nicholasWeights.js/ubcWeights.js 
      (ex: Tabular/Lenticular/Irregular, ou o que quer que seja), 2) mapear a descrição 
      textual do relatório (ex: 'sediment-hosted stratiform', 'bedded evaporite') pra uma 
      dessas opções — SEM inventar a correspondência sem base textual clara.",
    "thickness_m": null, "thickness_provenance": "",
    "dip_deg": null, "dip_provenance": "",
    "grade_pct": null, "grade_provenance": "",
    "depth_m": null, "depth_provenance": ""
  },
  "geomechanical": {
    "status": "por domínio (ob/hw/fw), formato ainda não resolvido em nenhum caso — 
      mesma pendência em todos os 3: relatórios reais tendem a dar RMR/UCS agregado ou 
      por unidade litológica, não no formato ob/hw/fw que o MMS pede. Precisa decisão de 
      mapeamento, não só busca."
  },
  "gaps": ["lista do que falta"],
  "usable_now": false
}
```

## Casos processados nesta rodada

| Caso | Método real | Geometria | Geomecânica | Status |
|---|---|---|---|---|
| Almaden/Ixtaca (OP) | Open Pit (implícito) | **Descartado** — múltiplas zonas, sem número único | — | Excluído, corretamente |
| Belgravia/Ochoa (UG) | R&P (confirmado em texto) | Completa (espessura 1.55m, mergulho 2°, teor 83.9%) | Não extraída | Parcial |
| Highland/Copperwood (UG) | R&P (confirmado em texto) | Espessura/teor resolvidos; mergulho e profundidade não são valor único | Tabela existe (16.2), conteúdo não extraído por texto | Parcial |

Nenhum caso está 100% pronto pra rodar. Os dois casos parciais são referência de método
válida (mostram a extração funcionando), não fixtures de teste ainda.

## O que falta resolver, na ordem que mais destrava trabalho

1. **Vocabulário exato de "shape"** — sem isso, nenhum caso preenche o formulário
   completo, para nenhum relatório, nunca. É o bloqueio mais genérico de todos.
2. **Mapeamento de geomecânica (RMR/UCS agregado → categorias por domínio ob/hw/fw)** —
   mesmo bloqueio em todos os 3 casos.
3. Profundidade e mergulho são mais variáveis caso a caso — não há um padrão único a
   resolver de antemão, dependem de cada relatório.

## Atualização — vocabulário confirmado (Item 1 do Claude Code + pesquisa na fonte primária)

Fonte primária localizada e consultada: Nicholas, D.E. (1981) "Method Selection — A 
Numerical Approach", Chapter 4, *Design and Operation of Caving and Sublevel Stoping 
Mines*, SME-AIME. Disponível em: 
https://www.cnitucson.com/publications/1981_Nicholas_436-Method%20Selection%20-%20A%20Numerical%20Approach%201981.pdf

### Espaçamento de fratura (jointSpacing) — Nicholas, Table 2

| Categoria (app) | Fraturas/metro | RQD equivalente |
|---|---|---|
| Muito Perto | >16 | 0–20% |
| Perto | 10–16 | 20–40% |
| Longe | 3–10 | 40–70% |
| Muito Longe | <3 | 70–100% |

Nota de caixa (já sinalizada pelo Claude Code): a chave no app é "Muito Perto"/"Perto" 
com P e L maiúsculos — única exceção de caixa no projeto. Comparação é literal.

### Condição de fratura (jointCondition) — Nicholas, Table 2 (Fracture Shear Strength)

- **Fraca**: junta limpa de superfície lisa, OU preenchida com material de resistência 
  MENOR que a rocha substância.
- **Média**: junta limpa de superfície rugosa.
- **Forte**: junta preenchida com material de resistência IGUAL OU MAIOR que a rocha 
  substância.

Qualitativo por definição (mesma natureza da fonte original) — não é correlação nova, é 
a definição publicada.

### Espessura (thickness) — confirmação, não descoberta nova

As 4 faixas já presentes como dica i18n do Nicholas batem exatamente com a Table 1 do 
original: narrow <10m, intermediate 10-30m, thick 30-100m, very thick >100m. Fonte 
primária confirma que não eram texto solto.

### Ainda em aberto

- **UBC "Muito estreito"** (5ª categoria de espessura, que Nicholas não tem): fonte 
  seria Miller, Pakalnis & Poulin (1995) "UBC Mining Method Selection", Mine Planning 
  and Equipment Selection, pp. 163-16 — não localizada/consultada ainda. **Ver a nota de 
  busca abaixo: não é mais "não procurei".**
- **oreValue → Baixo/Médio/Alto**: não é critério do Nicholas/UBC/SH&B clássico, é dos 
  6 critérios do Francisco. Precisa confirmação dele, não tem fonte pública equivalente.

### Nota de busca — "Muito estreito" (registrado em 2026-09-24)

**Status: procurado, não encontrado em acesso aberto.** Registrado aqui para ninguém 
repetir a mesma busca do zero.

Referência completa: Miller-Tait, L., Pakalnis, R. & Poulin, R. (1995), "UBC Mining 
Method Selection", em *Mine Planning and Equipment Selection (MPES 1995)*, Balkema, 
pp. 163-168.

É capítulo de anais publicados pela Balkema (hoje sob a Taylor & Francis/CRC), não 
artigo de periódico: não tem DOI aberto, não está em repositório institucional, e não 
aparece em cópia legítima de acesso livre. O volume existe em acervo impresso e em 
catálogo pago.

Dois caminhos, nesta ordem de custo:

1. **Perguntar ao Higor.** A referência já circula no material dele; é provável que 
   tenha o PDF ou o número de corte anotado. Caminho mais barato, e o primeiro a tentar.
2. **Acervo institucional (UFRGS).** Biblioteca do sistema ou comutação bibliográfica 
   (COMUT/EEB) para o capítulo específico. Leva dias, não minutos.

**O que exatamente se precisa da fonte**: um único número — o limite superior em metros 
da faixa "Muito estreito", isto é, onde ela termina e começa o "Estreito" (<10 m do 
Nicholas). Nada mais do capítulo é necessário.

**Por que isso trava trabalho real, e não é detalhe**: sem esse limite, todo depósito 
com menos de 10 m de espessura fica sem categoria decidível para UBC e SH&B — o 
mapeador (`src/validation/mapCaseToFormData.js`) recusa em vez de adivinhar. Os dois 
casos reais já extraídos caem exatamente aí: Belgravia 1,55 m e Highland 1,6 m. Não é 
faixa de borda: é onde mora a lavra de camada (potássio, cobre estratiforme, carvão), 
que é justamente onde o R&P aparece. Enquanto o número não vier, esses casos só rodam 
com o Nicholas sozinho — ou com `geometry.thickness_category` declarada à mão por quem 
tiver a fonte.
