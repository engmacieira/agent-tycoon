import { DialogueContext } from '../types/office';

export const IDLE_DIALOGUES: Record<DialogueContext, string[]> = {
  na_copa: [
    'Expresso duplo: zero tokens gastos, 100% de foco!',
    'Alguém viu se sobrou pão de queijo na copa?',
    'Recarregando cafeína antes de revisar o Kanban...',
    'Café preto sem açúcar para manter a latência baixa.',
    'Pausa estratégica na copa. Produtividade sobe 12%!',
  ],
  no_cpd: [
    'LEDs do Rack 03 piscando normal. Temperatura ok!',
    'Auditando cofre .env... orçamento segue intacto em $0.00.',
    'Ar-condicionado no ponto certo para os servidores.',
    'Nenhuma chamada externa detectada. Tudo 100% local.',
    'Checando integridade das portas e chaves de API.',
  ],
  encontro_corredor: [
    'Bom dia! As ilhas estão prontas para receber demandas.',
    'Tudo sob controle por aqui. Zero gargalos no fluxo!',
    'Opa! Se precisar escalar equipe, é só acionar a Sala Norte.',
    'Fala, chefe! Custos travados em $0.00 no modo simulação.',
    'Atravessando a ala central — arquitetura bem fluida!',
  ],
  trabalhando: [
    'Mapeando capacidade das 4 ilhas operacionais...',
    'Se um Flash resolve, não precisa chamar modelo Pro!',
    'Organizando backlog de vagas no quadro Kanban.',
    'Planilha de FinOps batendo centavo por centavo.',
    'Conferindo alocação futura de Backend, Frontend e QA.',
  ],
};

export function pickDialogue(
  context: DialogueContext,
  agentId: string,
  indexSeed: number
): string {
  const list = IDLE_DIALOGUES[context];
  // Slight personalization bias for Atlas vs Vega
  if (context === 'trabalhando') {
    if (agentId === 'coord-team') {
      const teamLines = [
        'Mapeando capacidade das 4 ilhas operacionais...',
        'Organizando backlog de vagas no quadro Kanban.',
        'Conferindo alocação futura de Backend, Frontend e QA.',
      ];
      return teamLines[indexSeed % teamLines.length];
    }
    if (agentId === 'coord-finance') {
      const finLines = [
        'Se um Flash resolve, não precisa chamar modelo Pro!',
        'Planilha de FinOps batendo centavo por centavo.',
        'Auditando teto de gastos por departamento.',
      ];
      return finLines[indexSeed % finLines.length];
    }
  }
  return list[indexSeed % list.length];
}
