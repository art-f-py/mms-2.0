# Uso de IA no desenvolvimento

O MMS 2.0 foi desenvolvido com auxílio de IA generativa, em dois papéis distintos:

- o **Claude Code** (Anthropic), um assistente de programação que lê o repositório, executa
  comandos e propõe ou aplica alterações. É o papel principal;
- o **Claude**, no claude.ai (Anthropic), usado para refinar prompts e fazer pesquisas
  pontuais.

Este documento descreve como esse auxílio foi usado, o que ele
produziu, o que ficou fora do seu alcance, e o que dele não pode ser verificado a partir do
repositório.

## Como o trabalho foi conduzido

1. **Decisão antes da execução.** Arquitetura, escopo e prioridades de cada etapa são
   decisões do autor. Dali saía um prompt de execução com escopo fechado: o que fazer, o que
   não tocar, e as travas da seção seguinte. Os prompts são do autor. Numa conversa separada
   com o Claude, no claude.ai, o assistente ajudou a refiná-los e fez pesquisas pontuais,
   como localizar o capítulo original de Nicholas (1981) usado nas tabelas de espaçamento e
   condição de fraturas.
2. **Execução via Claude Code.** O assistente executava o prompt no repositório: lia o
   código, implementava, rodava testes, lint e build, e fazia o commit na branch indicada.
3. **Relatório e revisão.** Cada execução terminava num relatório do que foi feito, do que
   foi verificado e do que ficou em aberto. O autor revisava o relatório (e o diff) antes de
   aprovar o passo seguinte. Nenhum merge em `main` foi feito sem aprovação explícita do
   autor.
4. **Parada em ambiguidade.** Quando o prompt não cobria um caso, ou quando uma premissa do
   prompt não batia com o código, o assistente parava e reportava em vez de decidir. A
   decisão voltava ao autor e, quando necessário, ao orientador ou aos colaboradores.

## Travas aplicadas a toda execução

- Confirmar a branch antes de qualquer commit.
- Nunca usar force push; nunca fazer merge em `main` sem aprovação explícita.
- Suíte de testes, lint e build passando antes do commit.
- Parar e reportar em qualquer ambiguidade.
- Não tocar em nada fora do escopo pedido.

As travas e as convenções do projeto estão registradas em [`CLAUDE.md`](../CLAUDE.md), na
raiz do repositório, que o Claude Code lê no início de cada sessão.

## Princípio de validação

Nenhum valor numérico, direção de critério ou regra de conversão entrou no código por
suposição, nem do assistente nem do autor. Cada um tem fonte primária (publicação) ou
confirmação explícita de um colaborador. Quando isso ainda não existe, o valor fica marcado
como pendente no próprio código. O mecanismo para isso é `PENDING_CONFIRMATION`, em
`src/algorithms/mcdmCriteria.js`, travado por teste.

Onde a paridade com uma referência externa pôde ser automatizada, ela foi:

- o cenário de regressão do carvão fixa os resultados do SH&B contra o MMS 1.0;
- o TOPSIS e a ponderação por entropia são comparados com o motor de referência em R.

Ver [`docs/TESTES.md`](TESTES.md).

## Onde a IA contribuiu

Sempre sob revisão e aprovação do autor antes de entrar no repositório:

- **Implementação de código**: algoritmos, pipeline de decisão multicritério, estado da
  aplicação, interface e tradução.
- **Testes**: escrita de testes automatizados, incluindo os comentários que explicam o
  contrato de cada arquivo.
- **Propostas de arquitetura e de interface**: organização de módulos, separação entre lógica
  pura e componentes, desenho de telas. Essas propostas eram submetidas ao autor, que as
  aceitava, ajustava ou recusava.
- **Diagnóstico de bugs**: localização da causa e proposta de correção.
- **Investigação de premissas**: conferir no código se uma premissa de um pedido era
  verdadeira antes de agir sobre ela, e reportar quando não era.
- **Documentação**: rascunho de documentos como este, `docs/TESTES.md` e comentários de
  código.
- **Refinamento de prompts e pesquisas pontuais** (Claude, no claude.ai): ajuda a refinar os
  prompts escritos pelo autor, e localização de fontes, como o capítulo original de
  Nicholas (1981).

## Onde a IA não decidiu

As decisões metodológicas vieram de pessoas e de fontes identificadas:

- **Métodos clássicos e tabelas de peso** (UBC 1995, Nicholas 1981/1992, SH&B 2007): da
  literatura publicada e do MMS 1.0.
- **Metodologia de decisão multicritério** (Pro D.M.): **Francisco Vargas**. São dele:
  - as tabelas de conversão dos scores clássicos para a escala de Saaty (UBC e SH&B), além
    da conversão linear usada no Nicholas, que ele confirmou;
  - os seis critérios fixos e seus valores;
  - as duas exceções do SH&B, isto é, o artefato de escala −7 e o valor fixado para a célula
    SQS / valor do minério;
  - a confirmação de que Enfoque e Entropy são modos mutuamente exclusivos.
- **Convenção do caso degenerado do TOPSIS** (todas as alternativas empatadas → 0): segue o
  motor de referência do Francisco, em R.
- **Desempenho do Top Slicing** (critério fixo): a célula está vazia na planilha de origem. O
  valor usado é uma **estimativa do autor**, registrada em `PENDING_CONFIRMATION` como
  pendente de confirmação.
- **Escopo, prioridades e o que entra em cada publicação**: do autor, com o orientador.

## Limitações desta declaração

- **O histórico do git não marca os commits assistidos.** `.claude/settings.json` desliga a
  atribuição automática do Claude Code, então nenhum commit indica se foi escrito com
  auxílio de IA. Não é possível separar, commit a commit, o que foi escrito pelo autor e o
  que foi escrito pelo assistente.
- **As conversas não estão arquivadas no repositório.** Nem as conversas no claude.ai
  nem as sessões do Claude Code. O que fica verificável é o resultado: o código, os testes e as
  mensagens de commit.
