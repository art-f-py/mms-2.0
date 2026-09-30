// ---------------------------------------------------------------------------
// SNAPSHOT DO BELGRAVIA ANTES DA EXTRAÇÃO VISUAL — só para teste
// ---------------------------------------------------------------------------
// Vários testes exercitavam comportamentos (profundidade null, Forma ausente,
// geomecânica no formato antigo, grade_pct no lugar da distribuição) lendo o
// arquivo REAL do Belgravia, que tinha essas lacunas. O arquivo real evoluiu —
// profundidade, forma, distribuição e geomecânica foram extraídas — e os testes
// quebraram sem que o código tivesse mudado.
//
// O comportamento continua merecendo teste; o arquivo real é que não é lugar de
// fixar lacuna. Este snapshot reconstrói o estado anterior EM MEMÓRIA, a partir
// do arquivo atual, desfazendo só os campos que a extração preencheu. Os testes
// do estado ATUAL do caso real ficam separados, e são os únicos que devem mudar
// quando o arquivo mudar.

export function belgraviaLegado(atual) {
  const geometria = { ...atual.geometry, depth_m: null };
  delete geometria.shape;
  delete geometria.grade_distribution;
  return {
    ...atual,
    geometry: geometria,
    geomechanical: {
      status: "NÃO EXTRAÍDO — texto de status do formato antigo, anterior ao schema v1.",
    },
  };
}
